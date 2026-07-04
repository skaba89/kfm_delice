import { NextResponse } from "next/server";

/**
 * GET /api — Root health check endpoint.
 *
 * SECURITY: This endpoint must NEVER override DATABASE_URL. Previously,
 * it forced SQLite when DATABASE_URL didn't start with 'file:', which
 * OVERWROTE the PostgreSQL URL on Render and caused the app to silently
 * fall back to a local SQLite file.
 *
 * Now it only REPORTS the provider (never the full URL, which contains
 * credentials) without modifying any environment variable.
 */
export async function GET() {
  const url = process.env.DATABASE_URL || '';
  const provider =
    url.startsWith('postgresql://') || url.startsWith('postgres://')
      ? 'postgres'
      : url.startsWith('file:')
        ? 'sqlite'
        : 'unknown';

  return NextResponse.json({
    status: "ok",
    // Log only the provider — never the full URL (contains credentials).
    databaseProvider: provider,
    databaseUrlSet: !!url,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
