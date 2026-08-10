import { NextResponse } from 'next/server';
import { db, dbReady } from '@/lib/db';

const IS_PRODUCTION = process.env.APP_MODE === 'production' || process.env.NODE_ENV === 'production';

/**
 * Public diagnostic endpoint.
 * Production returns only service/database availability — no counts, emails,
 * environment inventory or schema information. Development keeps small counts
 * to help local setup. Never disconnect the shared Prisma client from a request.
 */
export async function GET() {
  try {
    await dbReady;
    await db.$queryRawUnsafe('SELECT 1');

    if (IS_PRODUCTION) {
      return NextResponse.json({ status: 'ok', database: 'connected' });
    }

    const [restaurants, admins, menuItems] = await Promise.all([
      db.restaurant.count(),
      db.admin.count(),
      db.menuItem.count(),
    ]);
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      provider: (process.env.DATABASE_URL || '').startsWith('postgres') ? 'postgres' : 'sqlite',
      counts: { restaurants, admins, menuItems },
    });
  } catch (error) {
    console.error('[diagnose] health check failed:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ status: 'error', database: 'unavailable' }, { status: 503 });
  }
}
