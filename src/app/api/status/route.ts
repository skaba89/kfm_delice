import { NextResponse } from 'next/server';

/**
 * GET /api/status — Lightweight public health check for Render.
 *
 * This endpoint is INTENTIONALLY public (no auth) and minimal so Render's
 * health-check pings succeed even when:
 *   - The database is unreachable (we still return 200 so Render doesn't
 *     restart the service in a loop)
 *   - JWT_SECRET is missing (we still return 200 to avoid masking the
 *     real error in /api/health which IS auth-protected)
 *
 * Use /api/health for the full diagnostic (DB connection, env vars,
 * admin count, restaurant count) — but /api/health requires admin JWT
 * in production, so it cannot be used as a Render health check.
 *
 * This endpoint never exposes secrets. It only returns:
 *   - status: "ok"
 *   - timestamp
 *   - env: NODE_ENV value (just the string, not the env vars themselves)
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
