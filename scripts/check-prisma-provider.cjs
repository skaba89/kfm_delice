/**
 * check-prisma-provider.cjs — Verify prisma/schema.prisma provider
 *
 * Called from render-build.sh (after schema switch) and render-start.sh
 * (before prisma migrate deploy). Fails fast if production is running
 * with a SQLite schema, which is the root cause of the recurring
 * "the URL must start with the protocol file:" error on Render.
 *
 * Exit codes:
 *   0 = provider is correct for the environment
 *   1 = provider mismatch (FATAL in production)
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const isProduction = process.env.NODE_ENV === 'production';

if (!fs.existsSync(schemaPath)) {
  console.error('[check-prisma-provider] FATAL: prisma/schema.prisma not found.');
  console.error('[check-prisma-provider] Run this script from the project root.');
  process.exit(1);
}

const schema = fs.readFileSync(schemaPath, 'utf8');

// Extract provider from datasource block
const providerMatch = schema.match(/provider\s*=\s*"(sqlite|postgresql)"/);
if (!providerMatch) {
  console.error('[check-prisma-provider] FATAL: could not find provider in schema.prisma');
  process.exit(1);
}

const provider = providerMatch[1];
console.log(`[check-prisma-provider] Current provider: ${provider}`);
console.log(`[check-prisma-provider] NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);

if (isProduction && provider === 'sqlite') {
  console.error('[check-prisma-provider] ────────────────────────────────────────');
  console.error('[check-prisma-provider] FATAL: production is using SQLite schema!');
  console.error('[check-prisma-provider] This causes "URL must start with file:" error.');
  console.error('[check-prisma-provider] Expected: provider = "postgresql"');
  console.error('[check-prisma-provider] ────────────────────────────────────────');
  process.exit(1);
}

if (isProduction && provider !== 'postgresql') {
  console.error(`[check-prisma-provider] FATAL: production provider is "${provider}", expected "postgresql"`);
  process.exit(1);
}

console.log('[check-prisma-provider] ✓ Prisma provider OK');
process.exit(0);
