import { NextResponse } from 'next/server';

/**
 * GET /api/status — Lightweight public liveness/release endpoint.
 *
 * It intentionally does not touch the database. Database/schema compatibility
 * is checked by /api/ready and by the blocking startup pipeline.
 * `release` is the non-secret Git commit SHA supplied by Render and lets the
 * deployment workflow prove it is testing the revision it just requested.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      release: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
