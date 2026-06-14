import { PrismaClient } from '@prisma/client'

// Ensure DATABASE_URL is correctly set for SQLite
// The URL MUST start with "file:" for Prisma SQLite
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = 'file:./data/kfm-delice.db'
  console.log('[db] DATABASE_URL was missing or invalid, defaulting to: file:./data/kfm-delice.db')
} else {
  console.log('[db] DATABASE_URL:', process.env.DATABASE_URL)
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