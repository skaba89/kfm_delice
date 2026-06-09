"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

const WS_PORT = 3001;

interface WSMessage {
  event: string;
  data: unknown;
  timestamp: number;
}

interface UseWebSocketOptions {
  /** Enable/disable WebSocket (default: true). */
  enabled?: boolean;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Base reconnect delay in ms (default: 1000). With exponential backoff, actual delay grows. */
  reconnectBaseDelay?: number;
  /** Maximum reconnect delay in ms (default: 30000) */
  reconnectMaxDelay?: number;
  /** Maximum reconnect attempts before giving up (default: 10) */
  maxReconnectAttempts?: number;
}

/**
 * React hook for WebSocket real-time communication.
 * Features:
 * - Connects through the Caddy gateway using XTransformPort
 * - Exponential backoff reconnection (1s → 2s → 4s → ... → 30s max)
 * - Client-side heartbeat ping to detect dead connections early
 * - Typed event listener system
 */
export function useWebSocket(
  userId: string | null,
  userType: 'admin' | 'customer' | 'driver',
  options: UseWebSocketOptions = {}
) {
  const {
    enabled = true,
    autoReconnect = true,
    reconnectBaseDelay = 1000,
    reconnectMaxDelay = 30000,
    maxReconnectAttempts = 10,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());
  const mountedRef = useRef(true);

  // Register a listener for a specific event
  const on = useCallback((event: string, callback: (data: unknown) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);
  }, []);

  // Remove a listener for a specific event
  const off = useCallback((event: string, callback: (data: unknown) => void) => {
    const listeners = listenersRef.current.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        listenersRef.current.delete(event);
      }
    }
  }, []);

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback(() => {
    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(reconnectBaseDelay * Math.pow(2, attempt), reconnectMaxDelay);
    // Add jitter (±25%) to prevent thundering herd
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }, [reconnectBaseDelay, reconnectMaxDelay]);

  // Clean up timers
  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  // Start client-side heartbeat (send server a ping every 25s)
  const startHeartbeat = useCallback((ws: WebSocket) => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }
    heartbeatTimerRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ event: 'ping', timestamp: Date.now() }));
        } catch {
          // Connection might be closing
        }
      }
    }, 25000);
  }, []);

  // Main connection effect
  useEffect(() => {
    mountedRef.current = true;

    if (!enabled || !userId) return;

    let ws: WebSocket | null = null;

    function scheduleReconnect() {
      if (!autoReconnect || !mountedRef.current) return;

      if (reconnectAttemptRef.current >= maxReconnectAttempts) {
        console.log(`[WS] Max reconnect attempts (${maxReconnectAttempts}) reached. Giving up.`);
        return;
      }

      const delay = getReconnectDelay();
      reconnectAttemptRef.current++;
      console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${maxReconnectAttempts})...`);
      reconnectTimerRef.current = setTimeout(doConnect, delay);
    }

    function doConnect() {
      if (!mountedRef.current || !enabled || !userId) return;

      // Don't connect if already connected
      if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/?XTransformPort=${WS_PORT}&userId=${encodeURIComponent(userId)}&userType=${encodeURIComponent(userType)}`;

      try {
        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current) return;
          setConnected(true);
          reconnectAttemptRef.current = 0; // Reset attempt counter on successful connection
          console.log(`[WS] Connected as ${userType}:${userId}`);
          startHeartbeat(ws!);
        };

        ws.onmessage = (event) => {
          if (!mountedRef.current) return;
          try {
            const message: WSMessage = JSON.parse(event.data);

            // Handle pong response (heartbeat)
            if (message.event === 'pong') return;

            setLastMessage(message);
            // Call registered event listeners
            const listeners = listenersRef.current.get(message.event);
            if (listeners) {
              listeners.forEach((cb) => {
                try { cb(message.data); } catch (e) { console.error('[WS] Listener error:', e); }
              });
            }
          } catch (e) {
            console.error('[WS] Parse error:', e);
          }
        };

        ws.onclose = (closeEvent) => {
          if (!mountedRef.current) return;
          setConnected(false);
          ws = null;
          wsRef.current = null;
          cleanup();

          // 4001 = missing credentials (don't retry)
          // 4003 = session expired (reconnect immediately)
          // 4004 = server at capacity (retry with backoff)
          if (closeEvent.code === 4001) {
            console.log('[WS] Connection rejected (invalid credentials). Not reconnecting.');
            return;
          }

          if (closeEvent.code === 4003) {
            // Session expired, reconnect immediately
            reconnectAttemptRef.current = 0;
            console.log('[WS] Session expired, reconnecting immediately...');
            reconnectTimerRef.current = setTimeout(doConnect, 500);
          } else {
            console.log(`[WS] Disconnected (code: ${closeEvent.code}), will reconnect...`);
            scheduleReconnect();
          }
        };

        ws.onerror = () => {
          // onclose will fire after onerror, so we handle reconnection there
          console.error('[WS] Connection error');
        };
      } catch (e) {
        console.error('[WS] Connection failed:', e);
        scheduleReconnect();
      }
    }

    doConnect();

    return () => {
      mountedRef.current = false;
      cleanup();
      if (ws) {
        ws.close();
        ws = null;
      }
      wsRef.current = null;
      setConnected(false);
    };
  }, [enabled, userId, userType, autoReconnect, maxReconnectAttempts, getReconnectDelay, startHeartbeat, cleanup]);

  // Manually reconnect (resets backoff)
  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    if (wsRef.current) {
      wsRef.current.close();
    }
    cleanup();
    // Trigger reconnect by closing the connection; the onclose handler will schedule a reconnect
  }, [cleanup]);

  return { connected, lastMessage, on, off, reconnect };
}
