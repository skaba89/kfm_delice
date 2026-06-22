// Next.js Instrumentation — runs once at server startup (before any request)
// This is the earliest possible hook to fix environment variables
// NOTE: This runs in Edge Runtime, so we cannot use Node.js modules like 'fs' or 'path'

export async function register() {
  // Fix DATABASE_URL for SQLite: Prisma requires 'file:' protocol
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith('file:')) {
    process.env.DATABASE_URL = 'file:./data/kfm-delice.db';
    console.log('[instrumentation] DATABASE_URL was missing or invalid, defaulted to: file:./data/kfm-delice.db');
  } else {
    console.log('[instrumentation] DATABASE_URL:', url);
  }
}
