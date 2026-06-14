import { NextResponse } from "next/server";

export async function GET() {
  // Fix DATABASE_URL for SQLite at the earliest possible moment
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
    process.env.DATABASE_URL = 'file:./data/kfm-delice.db';
  }

  return NextResponse.json({
    status: "ok",
    databaseUrl: process.env.DATABASE_URL?.startsWith('file:') ? 'file:***' : 'INVALID',
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
