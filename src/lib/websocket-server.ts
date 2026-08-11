import { logger } from "@/lib/logger";
import { isLocalRealtimeEnabled, resolveRealtimeMode } from "@/lib/realtime-policy";
import { WebSocketServer, WebSocket } from 'ws';

// The built-in WebSocket server is deliberately dev/local only. In production
// we keep the public API as a no-op so existing callers continue to function
// while HTTP/polling remains the reliable fallback.
const LOCAL_REALTIME_ENABLED = isLocalRealtimeEnabled();

const WS_CONFIG = {
  port: 3001,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
  maxConnections: 200,
  maxConnectionsPerUser: 3,
  clientMaxAge: 24 * 60 * 60 * 1000,
} as const;

interface WSClient {
  ws: WebSocket;
  userId: string;
  userType: string;
  connectedAt: number;
  lastPing: number;
  lastPong: number;
  isAlive: boolean;
}

let wss: WebSocketServer | null = null;
const clients = new Map<string, WSClient>();
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let disabledModeLogged = false;

function logDisabledModeOnce() {
  if (disabledModeLogged) return;
  disabledModeLogged = true;
  logger.warn('[WS] Local realtime disabled; using HTTP/polling fallback.');
}

function startHeartbeat() {
  if (!LOCAL_REALTIME_ENABLED || heartbeatTimer) return;

  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    const expiredClients: string[] = [];

    clients.forEach((client, clientId) => {
      if (!client.isAlive) {
        expiredClients.push(clientId);
        return;
      }
      if (now - client.connectedAt > WS_CONFIG.clientMaxAge) {
        client.ws.close(4003, 'Session expired, please reconnect');
        expiredClients.push(clientId);
        return;
      }
      if (client.lastPing > client.lastPong && (now - client.lastPing) > WS_CONFIG.heartbeatTimeout) {
        client.ws.terminate();
        expiredClients.push(clientId);
        return;
      }

      client.isAlive = false;
      client.lastPing = now;
      if (client.ws.readyState === WebSocket.OPEN) client.ws.ping();
    });

    expiredClients.forEach((clientId) => clients.delete(clientId));
    if (expiredClients.length > 0) {
      logger.debug(`[WS] Cleaned up ${expiredClients.length} expired client(s) (total: ${clients.size})`);
    }
  }, WS_CONFIG.heartbeatInterval);
}

function stopHeartbeat() {
  if (!heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

export function getWebSocketServer(): WebSocketServer {
  if (!LOCAL_REALTIME_ENABLED) {
    logDisabledModeOnce();
    if (!wss) wss = new WebSocketServer({ noServer: true });
    return wss;
  }

  if (!wss) {
    try {
      wss = new WebSocketServer({ port: WS_CONFIG.port, maxPayload: 1024 * 1024 });
      logger.debug(`[WS] Local development WebSocket server started on port ${WS_CONFIG.port}`);

      wss.on('connection', (ws, req) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const userId = url.searchParams.get('userId') || '';
        const userType = url.searchParams.get('userType') || '';

        if (!userId || !userType) {
          ws.close(4001, 'Missing userId or userType');
          return;
        }

        if (clients.size >= WS_CONFIG.maxConnections) {
          ws.close(4004, 'Server at maximum capacity');
          return;
        }

        let userConnectionCount = 0;
        clients.forEach((c) => {
          if (c.userId === userId && c.userType === userType) userConnectionCount++;
        });
        if (userConnectionCount >= WS_CONFIG.maxConnectionsPerUser) {
          let oldestClientId: string | null = null;
          let oldestTime = Infinity;
          clients.forEach((c, cid) => {
            if (c.userId === userId && c.userType === userType && c.connectedAt < oldestTime) {
              oldestTime = c.connectedAt;
              oldestClientId = cid;
            }
          });
          if (oldestClientId) {
            const oldest = clients.get(oldestClientId);
            if (oldest) oldest.ws.close(4002, 'Replaced by newer connection');
            clients.delete(oldestClientId);
          }
        }

        const clientId = `${userType}:${userId}`;
        const now = Date.now();
        const existing = clients.get(clientId);
        if (existing && existing.ws.readyState === WebSocket.OPEN) {
          existing.ws.close(4002, 'Replaced by new connection');
        }

        const client: WSClient = {
          ws,
          userId,
          userType,
          connectedAt: now,
          lastPing: now,
          lastPong: now,
          isAlive: true,
        };
        clients.set(clientId, client);
        logger.debug(`[WS] Client connected: ${clientId} (total: ${clients.size})`);

        ws.on('pong', () => {
          const current = clients.get(clientId);
          if (current) {
            current.isAlive = true;
            current.lastPong = Date.now();
          }
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.event === 'ping') {
              ws.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }));
            }
          } catch {
            // Ignore malformed development messages.
          }
        });

        ws.on('close', () => {
          const current = clients.get(clientId);
          if (current && current.ws === ws) clients.delete(clientId);
          logger.debug(`[WS] Client disconnected: ${clientId} (total: ${clients.size})`);
        });

        ws.on('error', (err) => {
          logger.error(`[WS] Error for ${clientId}:`, err.message);
          const current = clients.get(clientId);
          if (current && current.ws === ws) clients.delete(clientId);
        });

        ws.send(JSON.stringify({
          event: 'ws:connected',
          data: { userId, userType, clientId, heartbeatInterval: WS_CONFIG.heartbeatInterval },
          timestamp: Date.now(),
        }));
      });

      wss.on('error', (err) => {
        logger.error('[WS] Server error:', err.message);
        stopHeartbeat();
        wss = null;
      });
      wss.on('close', stopHeartbeat);
      startHeartbeat();
    } catch (err) {
      logger.error('[WS] Failed to start local WebSocket server:', err);
      wss = new WebSocketServer({ noServer: true });
    }
  }
  return wss;
}

export function broadcastToType(userType: string, event: string, data: unknown) {
  if (!LOCAL_REALTIME_ENABLED) {
    logDisabledModeOnce();
    return 0;
  }
  getWebSocketServer();
  const message = JSON.stringify({ event, data, timestamp: Date.now() });
  let sent = 0;
  clients.forEach((client) => {
    if (client.userType === userType && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
      sent++;
    }
  });
  return sent;
}

export function sendToUser(userId: string, userType: string, event: string, data: unknown) {
  if (!LOCAL_REALTIME_ENABLED) {
    logDisabledModeOnce();
    return false;
  }
  getWebSocketServer();
  const client = clients.get(`${userType}:${userId}`);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify({ event, data, timestamp: Date.now() }));
    return true;
  }
  return false;
}

export function broadcastAll(event: string, data: unknown) {
  if (!LOCAL_REALTIME_ENABLED) {
    logDisabledModeOnce();
    return 0;
  }
  getWebSocketServer();
  const message = JSON.stringify({ event, data, timestamp: Date.now() });
  let sent = 0;
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
      sent++;
    }
  });
  return sent;
}

export function getConnectedCount() {
  return LOCAL_REALTIME_ENABLED ? clients.size : 0;
}

export function getConnectedByType(userType: string) {
  if (!LOCAL_REALTIME_ENABLED) return 0;
  let count = 0;
  clients.forEach((client) => {
    if (client.userType === userType) count++;
  });
  return count;
}

// Polling fallback support. These helpers are kept for compatibility with
// existing clients; production correctness must come from persisted API state,
// not this process-local event log.
const eventLog: Array<{ timestamp: number; event: string; data: unknown; userType?: string; userId?: string }> = [];
const MAX_EVENTS = 500;

function logEvent(event: string, data: unknown, userType?: string, userId?: string) {
  eventLog.push({ timestamp: Date.now(), event, data, userType, userId });
  while (eventLog.length > MAX_EVENTS) eventLog.shift();
}

export function registerClient(clientId: string, userId: string, userType: string) {
  logEvent('poll:registered', { clientId, userId, userType }, userType, userId);
  logger.debug(`[WS-Poll] Client registered: ${clientId}`);
}

export function getEventsSince(since: number, userType: string, userId: string) {
  return eventLog.filter(e =>
    e.timestamp > since &&
    (!e.userType || e.userType === userType) &&
    (!e.userId || e.userId === userId)
  );
}

const _origBroadcastToType = broadcastToType;
export { _origBroadcastToType as _broadcastToTypeOrig };

export function getWSStats() {
  const byType: Record<string, number> = {};
  if (LOCAL_REALTIME_ENABLED) {
    clients.forEach((client) => {
      byType[client.userType] = (byType[client.userType] || 0) + 1;
    });
  }
  return {
    mode: resolveRealtimeMode(),
    total: LOCAL_REALTIME_ENABLED ? clients.size : 0,
    byType,
    maxConnections: LOCAL_REALTIME_ENABLED ? WS_CONFIG.maxConnections : 0,
    heartbeatInterval: LOCAL_REALTIME_ENABLED ? WS_CONFIG.heartbeatInterval : 0,
  };
}
