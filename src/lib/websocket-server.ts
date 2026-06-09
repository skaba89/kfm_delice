import { WebSocketServer, WebSocket } from 'ws';

// Configuration
const WS_CONFIG = {
  port: 3001,
  heartbeatInterval: 30000,    // 30s — send ping to clients
  heartbeatTimeout: 10000,     // 10s — if no pong received, terminate
  maxConnections: 200,         // Maximum simultaneous connections
  maxConnectionsPerUser: 3,    // Max connections per userId:userType
  clientMaxAge: 24 * 60 * 60 * 1000, // 24h — force reconnect after this time
} as const;

// Client metadata with heartbeat tracking
interface WSClient {
  ws: WebSocket;
  userId: string;
  userType: string;
  connectedAt: number;
  lastPing: number;
  lastPong: number;
  isAlive: boolean;
}

// Singleton WebSocket server
let wss: WebSocketServer | null = null;
const clients = new Map<string, WSClient>();

// Heartbeat timer
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the heartbeat checker that pings all clients periodically
 * and terminates unresponsive connections.
 */
function startHeartbeat() {
  if (heartbeatTimer) return; // Already running

  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    const expiredClients: string[] = [];

    clients.forEach((client, clientId) => {
      // Check if client is still alive
      if (!client.isAlive) {
        expiredClients.push(clientId);
        return;
      }

      // Check if client has been connected too long (force refresh)
      if (now - client.connectedAt > WS_CONFIG.clientMaxAge) {
        client.ws.close(4003, 'Session expired, please reconnect');
        expiredClients.push(clientId);
        return;
      }

      // Check if previous pong was too long ago
      if (client.lastPing > client.lastPong && (now - client.lastPing) > WS_CONFIG.heartbeatTimeout) {
        client.ws.terminate();
        expiredClients.push(clientId);
        return;
      }

      // Send ping
      client.isAlive = false;
      client.lastPing = now;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    });

    // Clean up expired clients
    expiredClients.forEach((clientId) => {
      clients.delete(clientId);
    });

    if (expiredClients.length > 0) {
      console.log(`[WS] Cleaned up ${expiredClients.length} expired client(s) (total: ${clients.size})`);
    }
  }, WS_CONFIG.heartbeatInterval);
}

/**
 * Stop the heartbeat checker
 */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function getWebSocketServer(): WebSocketServer {
  if (!wss) {
    try {
      wss = new WebSocketServer({ port: WS_CONFIG.port, maxPayload: 1024 * 1024 }); // 1MB max payload
      console.log(`[WS] WebSocket server started on port ${WS_CONFIG.port}`);

      wss.on('connection', (ws, req) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const userId = url.searchParams.get('userId') || '';
        const userType = url.searchParams.get('userType') || '';

        if (!userId || !userType) {
          ws.close(4001, 'Missing userId or userType');
          return;
        }

        // Check max connections
        if (clients.size >= WS_CONFIG.maxConnections) {
          ws.close(4004, 'Server at maximum capacity');
          return;
        }

        // Check connections per user
        let userConnectionCount = 0;
        clients.forEach((c) => {
          if (c.userId === userId && c.userType === userType) userConnectionCount++;
        });
        if (userConnectionCount >= WS_CONFIG.maxConnectionsPerUser) {
          // Close the oldest connection for this user
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
            clients.delete(oldestClientId!);
          }
        }

        const clientId = `${userType}:${userId}`;
        const now = Date.now();

        // If same client reconnects, close old connection
        const existing = clients.get(clientId);
        if (existing && existing.ws.readyState === WebSocket.OPEN) {
          existing.ws.close(4002, 'Replaced by new connection');
        }

        // Register client with heartbeat metadata
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
        console.log(`[WS] Client connected: ${clientId} (total: ${clients.size})`);

        // Pong handler — mark client as alive
        ws.on('pong', () => {
          const current = clients.get(clientId);
          if (current) {
            current.isAlive = true;
            current.lastPong = Date.now();
          }
        });

        // Handle incoming messages (for future bidirectional communication)
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            // Handle client->server messages if needed
            if (message.event === 'ping') {
              // Client-initiated ping, respond with pong
              ws.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }));
            }
          } catch {
            // Ignore malformed messages
          }
        });

        ws.on('close', () => {
          // Only delete if this is the current socket for this client
          const current = clients.get(clientId);
          if (current && current.ws === ws) {
            clients.delete(clientId);
          }
          console.log(`[WS] Client disconnected: ${clientId} (total: ${clients.size})`);
        });

        ws.on('error', (err) => {
          console.error(`[WS] Error for ${clientId}:`, err.message);
          const current = clients.get(clientId);
          if (current && current.ws === ws) {
            clients.delete(clientId);
          }
        });

        // Send welcome message
        ws.send(JSON.stringify({
          event: 'ws:connected',
          data: { userId, userType, clientId, heartbeatInterval: WS_CONFIG.heartbeatInterval },
          timestamp: Date.now(),
        }));
      });

      wss.on('error', (err) => {
        console.error('[WS] Server error:', err.message);
        if ('code' in err && (err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
          console.error('[WS] Port 3001 already in use. Is another WS server running?');
        }
        stopHeartbeat();
        wss = null;
      });

      wss.on('close', () => {
        stopHeartbeat();
      });

      // Start heartbeat monitoring
      startHeartbeat();

    } catch (err) {
      console.error('[WS] Failed to start WebSocket server:', err);
      wss = new WebSocketServer({ noServer: true });
    }
  }
  return wss;
}

// Broadcast to all connected clients of a specific type
export function broadcastToType(userType: string, event: string, data: unknown) {
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

// Send to a specific user
export function sendToUser(userId: string, userType: string, event: string, data: unknown) {
  getWebSocketServer();

  const clientId = `${userType}:${userId}`;
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify({ event, data, timestamp: Date.now() }));
    return true;
  }
  return false;
}

// Broadcast to all connected clients
export function broadcastAll(event: string, data: unknown) {
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

// Get connected clients count
export function getConnectedCount() {
  return clients.size;
}

// Get connected clients by type
export function getConnectedByType(userType: string) {
  let count = 0;
  clients.forEach((client) => {
    if (client.userType === userType) count++;
  });
  return count;
}

// Get server stats
export function getWSStats() {
  const byType: Record<string, number> = {};
  clients.forEach((client) => {
    byType[client.userType] = (byType[client.userType] || 0) + 1;
  });
  return {
    total: clients.size,
    byType,
    maxConnections: WS_CONFIG.maxConnections,
    heartbeatInterval: WS_CONFIG.heartbeatInterval,
  };
}
