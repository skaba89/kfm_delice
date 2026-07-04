/**
 * check-prisma-provider.cjs — Verify prisma/schema.prisma provider
 *
 * Fails fast if the schema is SQLite when DATABASE_URL is PostgreSQL.
 * This is the definitive guard against the recurring
 * "the URL must start with the protocol file:" error on Render.
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');

if (!fs.existsSync(schemaPath)) {
  console.error('[check-prisma-provider] FATAL: prisma/schema.prisma not found.');
  process.exit(1);
}

const schema = fs.readFileSync(schemaPath, 'utf8');
const providerMatch = schema.match(/provider\s*=\s*"(sqlite|postgresql)"/);

if (!providerMatch) {
  console.error('[check-prisma-provider] FATAL: could not find provider in schema.prisma');
  process.exit(1);
}

const provider = providerMatch[1];
const dbUrl = process.env.DATABASE_URL || '';

// Detect expected provider from DATABASE_URL
let expectedProvider = 'postgresql'; // default (Render production)
if (dbUrl.startsWith('file:')) {
  expectedProvider = 'sqlite';
}

console.log(`[check-prisma-provider] Schema provider:  ${provider}`);
console.log(`[check-prisma-provider] Expected provider: ${expectedProvider}`);
console.log(`[check-prisma-provider] DATABASE_URL: ${dbUrl ? '(set)' : '(not set)'}`);

if (provider !== expectedProvider) {
  console.error('[check-prisma-provider] ────────────────────────────────────────');
  console.error(`[check-prisma-provider] FATAL: provider mismatch!`);
  console.error(`[check-prisma-provider] Schema has:     provider = "${provider}"`);
  console.error(`[check-prisma-provider] Expected:       provider = "${expectedProvider}"`);
  console.error('[check-prisma-provider] ────────────────────────────────────────');
  process.exit(1);
}

console.log('[check-prisma-provider] ✓ Prisma provider OK');
