// Next.js Instrumentation — runs once at server startup (before any request)
// This is the earliest possible hook to fix environment variables

export async function register() {
  // Fix DATABASE_URL for SQLite: Prisma requires 'file:' protocol
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith('file:')) {
    process.env.DATABASE_URL = 'file:./data/kfm-delice.db';
    console.log('[instrumentation] DATABASE_URL was missing or invalid, defaulted to: file:./data/kfm-delice.db');
  } else {
    console.log('[instrumentation] DATABASE_URL:', url);
  }

  // Ensure data directory exists for SQLite
  const fs = await import('fs');
  const path = await import('path');
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('[instrumentation] Created data directory:', dataDir);
  }
}
