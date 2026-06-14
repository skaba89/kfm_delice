import { NextResponse } from 'next/server';
import { getEventsSince, registerClient } from '@/lib/websocket-server';
import { authenticateAny } from '@/lib/auth';

// GET: Poll for new events since a timestamp (requires authentication)
export async function GET(request: Request) {
  try {
    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const url = new URL(request.url);
    const since = parseInt(url.searchParams.get('since') || '0', 10);
    const userType = url.searchParams.get('userType') || auth.type;
    const userId = url.searchParams.get('userId') || auth.id;

    // Force the authenticated user's type and ID — prevents impersonation
    const events = getEventsSince(since, auth.type, auth.id);

    return NextResponse.json({
      events,
      serverTime: Date.now(),
    });
  } catch (error) {
    console.error('[WS-Poll] Error:', error);
    return NextResponse.json({ events: [], error: 'Poll error' }, { status: 500 });
  }
}

// POST: Register a polling client (requires authentication)
export async function POST(request: Request) {
  try {
    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // Use authenticated user's info — prevents impersonation
    const clientId = `${auth.type}:${auth.id}`;

    if (action === 'register') {
      registerClient(clientId, auth.id, auth.type);
      return NextResponse.json({ success: true, clientId });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[WS-Poll] Register error:', error);
    return NextResponse.json({ error: 'Registration error' }, { status: 500 });
  }
}
