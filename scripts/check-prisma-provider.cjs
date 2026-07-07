/**
 * check-prisma-provider.cjs — Verify prisma schema AND generated client.
 *
 * Checks two things:
 *   1. prisma/schema.prisma has the correct provider
 *   2. node_modules/.prisma/client was generated with the correct provider
 *      (by inspecting the generated client's internal schema dump)
 *
 * Fails fast if either is SQLite when DATABASE_URL is PostgreSQL.
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

const schemaProvider = providerMatch[1];
const dbUrl = process.env.DATABASE_URL || '';

// Detect expected provider from DATABASE_URL
let expectedProvider = 'postgresql'; // default (Render production)
if (dbUrl.startsWith('file:')) {
  expectedProvider = 'sqlite';
}

console.log(`[check-prisma-provider] Schema provider:    ${schemaProvider}`);
console.log(`[check-prisma-provider] Expected provider: ${expectedProvider}`);
console.log(`[check-prisma-provider] DATABASE_URL:      ${dbUrl ? '(set)' : '(not set)'}`);

if (schemaProvider !== expectedProvider) {
  console.error('[check-prisma-provider] ────────────────────────────────────────');
  console.error(`[check-prisma-provider] FATAL: schema provider mismatch!`);
  console.error(`[check-prisma-provider] Schema has:     provider = "${schemaProvider}"`);
  console.error(`[check-prisma-provider] Expected:       provider = "${expectedProvider}"`);
  console.error('[check-prisma-provider] ────────────────────────────────────────');
  process.exit(1);
}

// ── Also verify the generated Prisma Client matches ─────────────
// The generated client stores its schema in node_modules/.prisma/client/schema.prisma
// If this doesn't match, `next start` will load the wrong client.
const clientSchemaPath = path.join(process.cwd(), 'node_modules', '.prisma', 'client', 'schema.prisma');
if (fs.existsSync(clientSchemaPath)) {
  const clientSchema = fs.readFileSync(clientSchemaPath, 'utf8');
  const clientProviderMatch = clientSchema.match(/provider\s*=\s*"(sqlite|postgresql)"/);
  if (clientProviderMatch) {
    const clientProvider = clientProviderMatch[1];
    console.log(`[check-prisma-provider] Client provider:   ${clientProvider}`);
    if (clientProvider !== expectedProvider) {
      console.error('[check-prisma-provider] ────────────────────────────────────────');
      console.error(`[check-prisma-provider] FATAL: generated client provider mismatch!`);
      console.error(`[check-prisma-provider] Client has:    provider = "${clientProvider}"`);
      console.error(`[check-prisma-provider] Expected:      provider = "${expectedProvider}"`);
      console.error('[check-prisma-provider] The Prisma Client in node_modules/.prisma/client/');
      console.error('[check-prisma-provider] was generated with the WRONG provider.');
      console.error('[check-prisma-provider] Run: rm -rf node_modules/.prisma && npx prisma generate');
      console.error('[check-prisma-provider] ────────────────────────────────────────');
      process.exit(1);
    }
    console.log('[check-prisma-provider] ✓ Generated client matches schema');
  } else {
    console.warn('[check-prisma-provider] WARNING: could not parse provider from generated client schema');
  }
} else {
  console.warn('[check-prisma-provider] WARNING: node_modules/.prisma/client/schema.prisma not found');
  console.warn('[check-prisma-provider] The Prisma Client may not be generated yet.');
}

console.log('[check-prisma-provider] ✓ Prisma provider OK');
