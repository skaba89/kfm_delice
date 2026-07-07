/**
 * create-platform-admin.cjs — Create or update a PlatformAdmin securely.
 *
 * This is the SAFE way to create the first super-admin for a real production
 * deployment (instead of relying on auto-seed with hardcoded demo passwords).
 *
 * Reads credentials from environment variables ONLY — never from CLI args
 * (which leak into shell history and process listings) and never hardcoded.
 *
 * Required env vars:
 *   PLATFORM_ADMIN_EMAIL
 *   PLATFORM_ADMIN_PASSWORD  (must be >= 12 characters)
 *   PLATFORM_ADMIN_NAME      (optional, defaults to "Super Admin")
 *
 * Optional env vars:
 *   PLATFORM_ADMIN_ROLE      (defaults to "super_admin")
 *
 * Usage:
 *   PLATFORM_ADMIN_EMAIL="admin@kfm-delice.com" \
 *   PLATFORM_ADMIN_PASSWORD="ThisIsAStrongPassword123!" \
 *   PLATFORM_ADMIN_NAME="Super Admin KFM" \
 *   node scripts/create-platform-admin.cjs
 *
 * Security:
 *   - Password is NEVER logged, even on error.
 *   - Password must be >= 12 chars (refuses short passwords).
 *   - Uses bcrypt with cost factor 10.
 *   - Upsert: if email exists, password is updated; otherwise created.
 *   - Exits non-zero on any error so CI/CD can detect failure.
 */

const { PrismaClient } = require('@prisma/client');
const { hashSync } = require('bcryptjs');

const prisma = new PrismaClient({ log: ['error', 'warn'] });

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME || 'Super Admin';
  const role = process.env.PLATFORM_ADMIN_ROLE || 'super_admin';

  // ── Validate inputs ──
  if (!email) {
    console.error('[create-platform-admin] FATAL: PLATFORM_ADMIN_EMAIL environment variable is required.');
    console.error('[create-platform-admin] Example: PLATFORM_ADMIN_EMAIL="admin@example.com" node scripts/create-platform-admin.cjs');
    process.exit(1);
  }

  if (!password) {
    console.error('[create-platform-admin] FATAL: PLATFORM_ADMIN_PASSWORD environment variable is required.');
    console.error('[create-platform-admin] The password is read from the env and never logged.');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error(`[create-platform-admin] FATAL: Password must be at least 12 characters long (got ${password.length}).`);
    console.error('[create-platform-admin] Use a strong, unique password. Never reuse a personal password.');
    process.exit(1);
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`[create-platform-admin] FATAL: Invalid email format: "${email}"`);
    process.exit(1);
  }

  console.log('[create-platform-admin] Starting...');
  console.log(`[create-platform-admin] Email: ${email}`);
  console.log(`[create-platform-admin] Name:  ${name}`);
  console.log(`[create-platform-admin] Role:  ${role}`);
  console.log('[create-platform-admin] Password: (hidden)');

  await prisma.$connect();

  // Hash password with bcrypt (cost factor 10 — same as auto-seed)
  const hashedPassword = hashSync(password, 10);

  // Upsert: create or update by email
  const result = await prisma.platformAdmin.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      name,
      role,
      status: 'active',
    },
    create: {
      email,
      password: hashedPassword,
      name,
      role,
      status: 'active',
    },
    select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, updatedAt: true },
  });

  const wasCreated = result.createdAt === result.updatedAt;
  console.log('[create-platform-admin] ─────────────────────────────────');
  console.log(`[create-platform-admin] ✓ ${wasCreated ? 'PlatformAdmin created' : 'PlatformAdmin updated'}`);
  console.log(`[create-platform-admin]   id:        ${result.id}`);
  console.log(`[create-platform-admin]   email:     ${result.email}`);
  console.log(`[create-platform-admin]   name:      ${result.name}`);
  console.log(`[create-platform-admin]   role:      ${result.role}`);
  console.log(`[create-platform-admin]   status:    ${result.status}`);
  console.log('[create-platform-admin] Done.');
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[create-platform-admin] FATAL:', e.message);
    console.error('[create-platform-admin] Stack:', e.stack);
    prisma.$disconnect().finally(() => process.exit(1));
  });
