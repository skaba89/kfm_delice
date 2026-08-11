import { NextResponse } from 'next/server';
import { getEventsSince, registerClient } from '@/lib/websocket-server';
import { authenticateAny } from '@/lib/auth';
import { isLocalRealtimeEnabled } from '@/lib/realtime-policy';

function localRealtimeUnavailable() {
  return NextResponse.json(
    {
      events: [],
      error: 'Le journal temps réel local est désactivé en production',
      code: 'LOCAL_REALTIME_DISABLED',
    },
    { status: 410 }
  );
}

// GET: local development polling fallback only.
export async function GET(request: Request) {
  try {
    if (!isLocalRealtimeEnabled()) return localRealtimeUnavailable();

    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const url = new URL(request.url);
    const since = parseInt(url.searchParams.get('since') || '0', 10);

    // Always use the authenticated identity. Query-string userId/userType are
    // deliberately ignored so a caller cannot poll another user's local feed.
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

// POST: register a local development polling client only.
export async function POST(request: Request) {
  try {
    if (!isLocalRealtimeEnabled()) return localRealtimeUnavailable();

    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;
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
