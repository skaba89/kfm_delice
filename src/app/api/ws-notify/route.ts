import { NextResponse } from 'next/server';
import { authenticateAdmin, hasRole } from '@/lib/auth';
import { broadcastToType, sendToUser, getWSStats } from '@/lib/websocket-server';

// POST /api/ws-notify — Trigger WebSocket broadcasts from API routes
// Requires Admin/Manager authentication
export async function POST(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (!hasRole(admin.role, ['admin', 'manager'])) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { event, data, targetType, targetUserId } = await request.json();

    if (!event) {
      return NextResponse.json({ error: 'Event name is required' }, { status: 400 });
    }

    // Validate event name to prevent arbitrary events
    const validEvents = [
      'ORDER_NEW', 'ORDER_STATUS_CHANGED', 'ORDER_ASSIGNED',
      'DRIVER_LOCATION_UPDATE', 'DRIVER_STATUS_CHANGED',
      'RESERVATION_NEW', 'RESERVATION_STATUS_CHANGED',
      'ADMIN_NOTIFICATION', 'TRACKING_UPDATE',
    ];
    if (!validEvents.includes(event)) {
      return NextResponse.json({ error: `Invalid event. Must be one of: ${validEvents.join(', ')}` }, { status: 400 });
    }

    let sent = 0;
    if (targetUserId && targetType) {
      sent = sendToUser(targetUserId, targetType, event, data) ? 1 : 0;
    } else if (targetType) {
      sent = broadcastToType(targetType, event, data);
    } else {
      return NextResponse.json({ error: 'targetType is required (with optional targetUserId)' }, { status: 400 });
    }

    return NextResponse.json({ sent, ...getWSStats() });
  } catch (error) {
    console.error('[WS-Notify] Error:', error);
    return NextResponse.json({ error: 'Notification failed' }, { status: 500 });
  }
}

// GET /api/ws-notify — Check WebSocket server status (admin only)
export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    return NextResponse.json({
      status: 'ok',
      ...getWSStats(),
    });
  } catch (error) {
    return NextResponse.json({ status: 'error', error: 'WS server not available' }, { status: 503 });
  }
}
