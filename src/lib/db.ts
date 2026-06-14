import { PrismaClient } from '@prisma/client'

// Ensure DATABASE_URL is set for SQLite (Render free plan doesn't always set it)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./data/kfm-delice.db'
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db