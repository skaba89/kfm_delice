/**
 * ensure-schema.cjs — Comprehensive SQLite schema initialization
 *
 * This script ensures ALL tables exist with the correct columns,
 * matching the Prisma schema exactly. It runs BEFORE prisma db push
 * as a safety net, and also adds any missing columns to existing tables.
 *
 * Idempotent: safe to run multiple times.
 * Must succeed: exits with code 1 on failure (blocks server start).
 */

// Fix DATABASE_URL if it doesn't start with 'file:'
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
  process.env.DATABASE_URL = 'file:./data/kfm-delice.db';
  console.log('[ensure-schema] DATABASE_URL defaulted to: file:./data/kfm-delice.db');
}

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient({ log: ['error', 'warn'] });

// ─── Table Definitions (matching Prisma schema exactly) ──────────
const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS PlatformAdmin (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'super_admin',
    status TEXT NOT NULL DEFAULT 'active',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS Restaurant (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    tagline TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    whatsapp TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    hours TEXT NOT NULL DEFAULT '',
    rating REAL NOT NULL DEFAULT 4.5,
    tables INTEGER NOT NULL DEFAULT 20,
    deliveryFee INTEGER NOT NULL DEFAULT 5000,
    minDelivery INTEGER NOT NULL DEFAULT 15000,
    deliveryZones TEXT NOT NULL DEFAULT 'Conakry:Kaloum:Dixinn:Matam:Matoto',
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    trialEndsAt TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'GNF',
    locale TEXT NOT NULL DEFAULT 'fr',
    ownerEmail TEXT NOT NULL DEFAULT '',
    ownerName TEXT NOT NULL DEFAULT '',
    ownerPhone TEXT NOT NULL DEFAULT '',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS RestaurantConfig (
    id TEXT PRIMARY KEY NOT NULL,
    restaurantId TEXT NOT NULL UNIQUE,
    logo TEXT NOT NULL DEFAULT '',
    heroImage TEXT NOT NULL DEFAULT '',
    primaryColor TEXT NOT NULL DEFAULT '#ea580c',
    accentColor TEXT NOT NULL DEFAULT '#f97316',
    fontFamily TEXT NOT NULL DEFAULT 'Inter',
    menuCategories TEXT NOT NULL DEFAULT '[]',
    features TEXT NOT NULL DEFAULT '{}',
    openingHours TEXT NOT NULL DEFAULT '{}',
    socialLinks TEXT NOT NULL DEFAULT '{}',
    customDomain TEXT NOT NULL DEFAULT '',
    metaTitle TEXT NOT NULL DEFAULT '',
    metaDescription TEXT NOT NULL DEFAULT '',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS Admin (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'active',
    mustChangePassword BOOLEAN NOT NULL DEFAULT 0,
    restaurantId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS Customer (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    loyaltyPoints INTEGER NOT NULL DEFAULT 0,
    totalOrders INTEGER NOT NULL DEFAULT 0,
    totalSpent INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    mustChangePassword BOOLEAN NOT NULL DEFAULT 0,
    restaurantId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS MenuItem (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL,
    category TEXT NOT NULL,
    image TEXT NOT NULL DEFAULT '',
    badge TEXT NOT NULL DEFAULT '',
    popular BOOLEAN NOT NULL DEFAULT 0,
    available BOOLEAN NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    restaurantId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS Reservation (
    id TEXT PRIMARY KEY NOT NULL,
    customerName TEXT NOT NULL,
    phone TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    guests INTEGER NOT NULL DEFAULT 2,
    zone TEXT NOT NULL DEFAULT 'interieur',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    loyaltyPoint INTEGER NOT NULL DEFAULT 50,
    customerId TEXT,
    restaurantId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "Order" (
    id TEXT PRIMARY KEY NOT NULL,
    customerName TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    orderType TEXT NOT NULL DEFAULT 'dine_in',
    paymentMethod TEXT NOT NULL DEFAULT 'cash',
    paymentStatus TEXT NOT NULL DEFAULT 'pending',
    deliveryAddress TEXT NOT NULL DEFAULT '',
    deliveryFee INTEGER NOT NULL DEFAULT 0,
    tableNumber INTEGER NOT NULL DEFAULT 0,
    discount INTEGER NOT NULL DEFAULT 0,
    tax INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    estimatedDeliveryTime TEXT NOT NULL DEFAULT '',
    driverLat REAL NOT NULL DEFAULT 0,
    driverLng REAL NOT NULL DEFAULT 0,
    customerId TEXT,
    driverId TEXT,
    restaurantId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS Driver (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    password TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle TEXT NOT NULL DEFAULT 'moto',
    status TEXT NOT NULL DEFAULT 'available',
    rating REAL NOT NULL DEFAULT 5.0,
    totalDeliveries INTEGER NOT NULL DEFAULT 0,
    zone TEXT NOT NULL DEFAULT 'Conakry',
    lat REAL NOT NULL DEFAULT 0,
    lng REAL NOT NULL DEFAULT 0,
    lastLocationUpdate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    currentOrderId TEXT NOT NULL DEFAULT '',
    mustChangePassword BOOLEAN NOT NULL DEFAULT 0,
    restaurantId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS Review (
    id TEXT PRIMARY KEY NOT NULL,
    customerName TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    customerId TEXT,
    restaurantId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS Staff (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL,
    salary INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    hireDate TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    restaurantId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS Invoice (
    id TEXT PRIMARY KEY NOT NULL,
    number TEXT NOT NULL,
    customerName TEXT NOT NULL,
    customerPhone TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    tax INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    dueDate TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    orderId TEXT DEFAULT '',
    restaurantId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS Quote (
    id TEXT PRIMARY KEY NOT NULL,
    number TEXT NOT NULL,
    customerName TEXT NOT NULL,
    customerPhone TEXT NOT NULL DEFAULT '',
    items TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    discount INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    validUntil TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    restaurantId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS Expense (
    id TEXT PRIMARY KEY NOT NULL,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    paidBy TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    restaurantId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS Payment (
    id TEXT PRIMARY KEY NOT NULL,
    orderId TEXT NOT NULL,
    amount INTEGER NOT NULL,
    method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    transactionRef TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    customerName TEXT NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}',
    paidAt TEXT NOT NULL DEFAULT '',
    failedReason TEXT NOT NULL DEFAULT '',
    restaurantId TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

// ─── Indexes (created IF NOT EXISTS) ─────────────────────────────
const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS Admin_restaurantId_idx ON Admin(restaurantId)',
  'CREATE INDEX IF NOT EXISTS Customer_restaurantId_idx ON Customer(restaurantId)',
  'CREATE INDEX IF NOT EXISTS Customer_email_restaurantId_idx ON Customer(email, restaurantId)',
  'CREATE INDEX IF NOT EXISTS MenuItem_restaurantId_category_idx ON MenuItem(restaurantId, category)',
  'CREATE INDEX IF NOT EXISTS MenuItem_restaurantId_available_idx ON MenuItem(restaurantId, available)',
  'CREATE INDEX IF NOT EXISTS Reservation_restaurantId_date_idx ON Reservation(restaurantId, date)',
  'CREATE INDEX IF NOT EXISTS Reservation_restaurantId_status_idx ON Reservation(restaurantId, status)',
  'CREATE INDEX IF NOT EXISTS Reservation_customerId_idx ON Reservation(customerId)',
  'CREATE INDEX IF NOT EXISTS "Order_restaurantId_status_idx" ON "Order"(restaurantId, status)',
  'CREATE INDEX IF NOT EXISTS "Order_restaurantId_orderType_idx" ON "Order"(restaurantId, orderType)',
  'CREATE INDEX IF NOT EXISTS "Order_restaurantId_createdAt_idx" ON "Order"(restaurantId, createdAt)',
  'CREATE INDEX IF NOT EXISTS "Order_driverId_idx" ON "Order"(driverId)',
  'CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"(customerId)',
  'CREATE INDEX IF NOT EXISTS Driver_restaurantId_status_idx ON Driver(restaurantId, status)',
  'CREATE INDEX IF NOT EXISTS Driver_email_restaurantId_idx ON Driver(email, restaurantId)',
  'CREATE INDEX IF NOT EXISTS Review_restaurantId_idx ON Review(restaurantId)',
  'CREATE INDEX IF NOT EXISTS Review_customerId_idx ON Review(customerId)',
  'CREATE INDEX IF NOT EXISTS Payment_orderId_idx ON Payment(orderId)',
  'CREATE INDEX IF NOT EXISTS Payment_status_idx ON Payment(status)',
  'CREATE INDEX IF NOT EXISTS Payment_method_idx ON Payment(method)',
  'CREATE INDEX IF NOT EXISTS Payment_restaurantId_createdAt_idx ON Payment(restaurantId, createdAt)',
];

// ─── Missing columns to add (safety net for existing DBs) ────────
const MISSING_COLUMNS = [
  ['Admin', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT 0'],
  ['Customer', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT 0'],
  ['Driver', 'mustChangePassword', 'BOOLEAN NOT NULL DEFAULT 0'],
  ['Driver', 'lat', 'REAL NOT NULL DEFAULT 0'],
  ['Driver', 'lng', 'REAL NOT NULL DEFAULT 0'],
  ['Driver', 'lastLocationUpdate', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'],
  ['Driver', 'currentOrderId', "TEXT NOT NULL DEFAULT ''"],
  ['Driver', 'email', "TEXT NOT NULL DEFAULT ''"],
  ['Driver', 'password', "TEXT NOT NULL DEFAULT ''"],
  ['Invoice', 'orderId', "TEXT DEFAULT ''"],
  ['Order', 'driverLat', 'REAL NOT NULL DEFAULT 0'],
  ['Order', 'driverLng', 'REAL NOT NULL DEFAULT 0'],
  ['Order', 'estimatedDeliveryTime', "TEXT NOT NULL DEFAULT ''"],
  ['Order', 'note', "TEXT NOT NULL DEFAULT ''"],
  ['Order', 'tax', 'INTEGER NOT NULL DEFAULT 0'],
  ['Order', 'discount', 'INTEGER NOT NULL DEFAULT 0'],
  ['Order', 'deliveryFee', 'INTEGER NOT NULL DEFAULT 0'],
  ['Order', 'tableNumber', 'INTEGER NOT NULL DEFAULT 0'],
  ['Order', 'deliveryAddress', "TEXT NOT NULL DEFAULT ''"],
  ['Order', 'paymentMethod', "TEXT NOT NULL DEFAULT 'cash'"],
  ['Order', 'paymentStatus', "TEXT NOT NULL DEFAULT 'pending'"],
  ['Order', 'customerId', 'TEXT'],
  ['Order', 'driverId', 'TEXT'],
  ['Reservation', 'loyaltyPoint', 'INTEGER NOT NULL DEFAULT 50'],
  ['Reservation', 'customerId', 'TEXT'],
  ['Restaurant', 'plan', "TEXT NOT NULL DEFAULT 'free'"],
  ['Restaurant', 'status', "TEXT NOT NULL DEFAULT 'active'"],
  ['Restaurant', 'trialEndsAt', "TEXT NOT NULL DEFAULT ''"],
  ['Restaurant', 'currency', "TEXT NOT NULL DEFAULT 'GNF'"],
  ['Restaurant', 'locale', "TEXT NOT NULL DEFAULT 'fr'"],
  ['Restaurant', 'ownerEmail', "TEXT NOT NULL DEFAULT ''"],
  ['Restaurant', 'ownerName', "TEXT NOT NULL DEFAULT ''"],
  ['Restaurant', 'ownerPhone', "TEXT NOT NULL DEFAULT ''"],
  ['Customer', 'loyaltyPoints', 'INTEGER NOT NULL DEFAULT 0'],
  ['Customer', 'totalOrders', 'INTEGER NOT NULL DEFAULT 0'],
  ['Customer', 'totalSpent', 'INTEGER NOT NULL DEFAULT 0'],
  ['Customer', 'address', "TEXT NOT NULL DEFAULT ''"],
  ['Customer', 'phone', "TEXT NOT NULL DEFAULT ''"],
  ['Review', 'customerId', 'TEXT'],
  ['MenuItem', 'badge', "TEXT NOT NULL DEFAULT ''"],
  ['MenuItem', 'popular', 'BOOLEAN NOT NULL DEFAULT 0'],
  ['MenuItem', 'available', 'BOOLEAN NOT NULL DEFAULT 1'],
  ['MenuItem', '"order"', 'INTEGER NOT NULL DEFAULT 0'],
  ['Payment', 'transactionRef', "TEXT NOT NULL DEFAULT ''"],
  ['Payment', 'phone', "TEXT NOT NULL DEFAULT ''"],
  ['Payment', 'customerName', "TEXT NOT NULL DEFAULT ''"],
  ['Payment', 'metadata', "TEXT NOT NULL DEFAULT '{}'"],
  ['Payment', 'paidAt', "TEXT NOT NULL DEFAULT ''"],
  ['Payment', 'failedReason', "TEXT NOT NULL DEFAULT ''"],
];

async function ensureSchema() {
  console.log('[ensure-schema] Starting schema verification...');
  console.log('[ensure-schema] DATABASE_URL:', process.env.DATABASE_URL);

  // Ensure the data directory exists
  const dbPath = process.env.DATABASE_URL.replace('file:', '');
  const dbDir = path.dirname(dbPath);
  if (dbDir && !fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`[ensure-schema] Created directory: ${dbDir}`);
  }

  await prisma.$connect();
  console.log('[ensure-schema] Database connected.');

  // 1. Create all tables
  for (const sql of CREATE_TABLES) {
    try {
      await prisma.$executeRawUnsafe(sql);
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\S+)/)?.[1] || 'unknown';
      console.log(`[ensure-schema] ✓ Table ensured: ${tableName}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ensure-schema] ✗ Failed to create table: ${msg}`);
      // Don't exit — try to continue with other tables
    }
  }

  // 2. Create all indexes
  for (const sql of CREATE_INDEXES) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('already exists')) {
        console.warn(`[ensure-schema] Index warning: ${msg}`);
      }
    }
  }
  console.log('[ensure-schema] ✓ All indexes ensured.');

  // 3. Add missing columns (safety net for existing DBs with incomplete schema)
  let columnsAdded = 0;
  for (const [table, column, def] of MISSING_COLUMNS) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
      columnsAdded++;
      console.log(`[ensure-schema] ✓ Added column ${table}.${column}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        // Table might not exist, or other error
        if (msg.includes('no such table')) {
          // Table was supposed to be created above; this shouldn't happen
          console.warn(`[ensure-schema] ✗ Table ${table} does not exist!`);
        }
        // Ignore other errors (column already exists is expected)
      }
    }
  }
  if (columnsAdded > 0) {
    console.log(`[ensure-schema] ✓ Added ${columnsAdded} missing column(s).`);
  }

  // 4. Verify critical tables exist
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  const tableNames = tables.map(t => t.name);
  const requiredTables = ['PlatformAdmin', 'Restaurant', 'RestaurantConfig', 'Admin', 'Customer', 'MenuItem', 'Reservation', 'Order', 'Driver', 'Review', 'Staff', 'Invoice', 'Quote', 'Expense', 'Payment'];
  const missingTables = requiredTables.filter(t => !tableNames.includes(t));

  if (missingTables.length > 0) {
    console.error(`[ensure-schema] ✗ Missing tables: ${missingTables.join(', ')}`);
    // Don't exit — prisma db push might fix this
  } else {
    console.log('[ensure-schema] ✓ All 15 required tables exist.');
  }

  console.log('[ensure-schema] Schema verification complete.');
}

// Run and exit with appropriate code
ensureSchema()
  .then(() => {
    console.log('[ensure-schema] Success.');
    return prisma.$disconnect();
  })
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[ensure-schema] FATAL:', e.message);
    console.error('[ensure-schema] Stack:', e.stack);
    prisma.$disconnect().finally(() => process.exit(1));
  });
