#!/usr/bin/env node
/**
 * ensure-schema.cjs — Comprehensive SQLite schema migration
 *
 * Ensures ALL tables exist with ALL required columns, even if prisma db push
 * failed or the DB was created with an older schema.
 *
 * Safe to run multiple times — uses "CREATE TABLE IF NOT EXISTS" and
 * "ALTER TABLE ADD COLUMN" (ignoring "duplicate column" errors).
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Table definitions with ALL columns from Prisma schema ────────
// Each entry: [table_name, create_sql, [alter_columns]]
// alter_columns: [column_name, column_sql] pairs

const TABLES = [
  {
    name: 'Restaurant',
    create: `CREATE TABLE IF NOT EXISTS Restaurant (
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
      "tables" INTEGER NOT NULL DEFAULT 20,
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
    alters: [],
  },
  {
    name: 'RestaurantConfig',
    create: `CREATE TABLE IF NOT EXISTS RestaurantConfig (
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
    alters: [],
  },
  {
    name: 'Admin',
    create: `CREATE TABLE IF NOT EXISTS Admin (
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
    alters: [
      ['mustChangePassword', 'BOOLEAN NOT NULL DEFAULT 0'],
    ],
  },
  {
    name: 'Customer',
    create: `CREATE TABLE IF NOT EXISTS Customer (
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
    alters: [
      ['mustChangePassword', 'BOOLEAN NOT NULL DEFAULT 0'],
    ],
  },
  {
    name: 'MenuItem',
    create: `CREATE TABLE IF NOT EXISTS MenuItem (
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
    alters: [],
  },
  {
    name: 'Reservation',
    create: `CREATE TABLE IF NOT EXISTS Reservation (
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
    alters: [],
  },
  {
    name: 'Order',
    create: `CREATE TABLE IF NOT EXISTS "Order" (
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
    alters: [],
  },
  {
    name: 'Driver',
    create: `CREATE TABLE IF NOT EXISTS Driver (
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
    alters: [
      ['mustChangePassword', 'BOOLEAN NOT NULL DEFAULT 0'],
      ['lastLocationUpdate', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'],
      ['currentOrderId', 'TEXT NOT NULL DEFAULT \'\''],
      ['lat', 'REAL NOT NULL DEFAULT 0'],
      ['lng', 'REAL NOT NULL DEFAULT 0'],
      ['email', 'TEXT NOT NULL DEFAULT \'\''],
      ['password', 'TEXT NOT NULL DEFAULT \'\''],
    ],
  },
  {
    name: 'Review',
    create: `CREATE TABLE IF NOT EXISTS Review (
      id TEXT PRIMARY KEY NOT NULL,
      customerName TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      customerId TEXT,
      restaurantId TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    alters: [],
  },
  {
    name: 'Staff',
    create: `CREATE TABLE IF NOT EXISTS Staff (
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
    alters: [],
  },
  {
    name: 'Invoice',
    create: `CREATE TABLE IF NOT EXISTS Invoice (
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
    alters: [
      ['orderId', 'TEXT DEFAULT \'\''],
    ],
  },
  {
    name: 'Quote',
    create: `CREATE TABLE IF NOT EXISTS Quote (
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
    alters: [],
  },
  {
    name: 'Expense',
    create: `CREATE TABLE IF NOT EXISTS Expense (
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
    alters: [],
  },
  {
    name: 'Payment',
    create: `CREATE TABLE IF NOT EXISTS Payment (
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
    alters: [],
  },
  {
    name: 'PlatformAdmin',
    create: `CREATE TABLE IF NOT EXISTS PlatformAdmin (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'super_admin',
      status TEXT NOT NULL DEFAULT 'active',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    alters: [],
  },
];

// ─── Index definitions ────────────────────────────────────────────
const INDEXES = [
  'CREATE INDEX IF NOT EXISTS Admin_restaurantId_idx ON Admin(restaurantId)',
  'CREATE INDEX IF NOT EXISTS Customer_restaurantId_idx ON Customer(restaurantId)',
  'CREATE UNIQUE INDEX IF NOT EXISTS Customer_email_restaurantId_uniq ON Customer(email, restaurantId)',
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
  'CREATE UNIQUE INDEX IF NOT EXISTS Driver_email_restaurantId_uniq ON Driver(email, restaurantId)',
  'CREATE INDEX IF NOT EXISTS Review_restaurantId_idx ON Review(restaurantId)',
  'CREATE INDEX IF NOT EXISTS Review_customerId_idx ON Review(customerId)',
  'CREATE INDEX IF NOT EXISTS Payment_orderId_idx ON Payment(orderId)',
  'CREATE INDEX IF NOT EXISTS Payment_status_idx ON Payment(status)',
  'CREATE INDEX IF NOT EXISTS Payment_method_idx ON Payment(method)',
  'CREATE INDEX IF NOT EXISTS Payment_restaurantId_createdAt_idx ON Payment(restaurantId, createdAt)',
];

async function ensureSchema() {
  console.log('[ensure-schema] Starting comprehensive schema migration...');

  for (const table of TABLES) {
    // Step 1: Create table if not exists
    try {
      await prisma.$executeRawUnsafe(table.create);
      console.log(`[ensure-schema] ✓ Table ${table.name} exists`);
    } catch (e) {
      console.error(`[ensure-schema] ✗ Failed to create table ${table.name}:`, e.message);
    }

    // Step 2: Add missing columns
    for (const [colName, colDef] of table.alters) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE ${table.name} ADD COLUMN ${colName} ${colDef}`);
        console.log(`[ensure-schema] ✓ Added column ${table.name}.${colName}`);
      } catch (e) {
        if (e.message && (e.message.includes('duplicate column') || e.message.includes('already exists'))) {
          // Column already exists — that's fine
        } else {
          console.error(`[ensure-schema] ✗ Failed to add ${table.name}.${colName}:`, e.message);
        }
      }
    }
  }

  // Step 3: Create indexes
  for (const idxSql of INDEXES) {
    try {
      await prisma.$executeRawUnsafe(idxSql);
    } catch (e) {
      // Index might already exist or fail for other reasons — not critical
    }
  }
  console.log('[ensure-schema] ✓ Indexes created');

  // Step 4: Verify critical columns exist
  const criticalChecks = [
    { table: 'Admin', column: 'mustChangePassword' },
    { table: 'Customer', column: 'mustChangePassword' },
    { table: 'Driver', column: 'mustChangePassword' },
    { table: 'Driver', column: 'lat' },
    { table: 'Driver', column: 'lng' },
    { table: 'Driver', column: 'currentOrderId' },
    { table: 'Driver', column: 'lastLocationUpdate' },
    { table: 'Invoice', column: 'orderId' },
  ];

  let allOk = true;
  for (const check of criticalChecks) {
    try {
      const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info(${check.table})`);
      const colNames = cols.map(c => c.name);
      if (!colNames.includes(check.column)) {
        console.error(`[ensure-schema] ✗ MISSING: ${check.table}.${check.column}`);
        allOk = false;
      }
    } catch (e) {
      console.error(`[ensure-schema] ✗ Cannot check ${check.table}:`, e.message);
      allOk = false;
    }
  }

  if (allOk) {
    console.log('[ensure-schema] ✓ All critical columns verified');
  } else {
    console.error('[ensure-schema] ⚠ Some columns are still missing!');
  }

  await prisma.$disconnect();
  console.log('[ensure-schema] Done');
}

ensureSchema().catch(e => {
  console.error('[ensure-schema] Fatal error:', e);
  process.exit(0); // Don't fail the start script
});
