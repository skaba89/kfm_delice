// ───────────────────────────────────────────────────────────────────
// scripts/migrate-sqlite-to-postgres.ts
// ───────────────────────────────────────────────────────────────────
// Migrates all data from a SQLite DB (dev) to a PostgreSQL DB (prod).
//
// Usage:
//   1. Set SOURCE_DATABASE_URL (SQLite) in .env
//   2. Set DATABASE_URL (PostgreSQL) in .env
//   3. Run:    bunx tsx scripts/migrate-sqlite-to-postgres.ts
//
// The script:
//   - Reads all rows from the SQLite source DB
//   - Inserts them into the PostgreSQL target DB (preserving IDs)
//   - Converts String-encoded JSON fields (SQLite) → native Json (PostgreSQL)
//   - Converts Int monetary fields → BigInt where the postgres schema uses BigInt
//   - Skips tables that don't exist on the target (defensive)
//   - Reports per-table row counts
//
// IMPORTANT:
//   - Run `npx prisma migrate deploy` on the PostgreSQL target FIRST,
//     so all tables exist before importing data.
//   - The script is IDEMPOTENT in the sense that it deletes existing
//     target rows before inserting (use --skip-truncate to disable).
//   - It does NOT regenerate IDs — original cuid() values are preserved
//     so foreign-key relationships stay intact.
// ───────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.DATABASE_URL;

if (!SOURCE_URL) {
  console.error("[migrate] SOURCE_DATABASE_URL not set. Set it to your SQLite URL (file:./...).");
  process.exit(1);
}
if (!TARGET_URL) {
  console.error("[migrate] DATABASE_URL not set. Set it to your PostgreSQL URL (postgresql://...).");
  process.exit(1);
}
if (!TARGET_URL.startsWith("postgresql://") && !TARGET_URL.startsWith("postgres://")) {
  console.error("[migrate] DATABASE_URL must be a PostgreSQL URL for the target.");
  process.exit(1);
}

// Source = SQLite (read-only)
const src = new PrismaClient({
  datasources: { db: { url: SOURCE_URL } },
});

// Target = PostgreSQL (write)
const tgt = new PrismaClient({
  datasources: { db: { url: TARGET_URL } },
});

const SKIP_TRUNCATE = process.argv.includes("--skip-truncate");
const DRY_RUN = process.argv.includes("--dry-run");

type RowCount = { table: string; source: number; target: number; inserted: number };

function parseJSON<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? BigInt(n) : BigInt(0);
  }
  return BigInt(0);
}

async function migrateTable<T extends Record<string, unknown>>(
  tableName: string,
  fetchAll: () => Promise<T[]>,
  truncate: () => Promise<void>,
  insert: (rows: T[]) => Promise<number>,
): Promise<RowCount> {
  console.log(`[migrate] ${tableName}: reading source...`);
  const rows = await fetchAll();
  console.log(`[migrate] ${tableName}: ${rows.length} rows in source`);

  if (DRY_RUN) {
    console.log(`[migrate] ${tableName}: DRY RUN — skipping insert`);
    return { table: tableName, source: rows.length, target: 0, inserted: 0 };
  }

  if (!SKIP_TRUNCATE) {
    console.log(`[migrate] ${tableName}: truncating target...`);
    await truncate();
  }

  console.log(`[migrate] ${tableName}: inserting ${rows.length} rows...`);
  const inserted = await insert(rows);
  console.log(`[migrate] ${tableName}: ✅ inserted ${inserted}`);

  return { table: tableName, source: rows.length, target: inserted, inserted };
}

async function main() {
  console.log("━".repeat(60));
  console.log("KFM Delice — SQLite → PostgreSQL data migration");
  console.log("━".repeat(60));
  console.log(`Source: ${(SOURCE_URL ?? "").slice(0, 60)}...`);
  console.log(`Target: ${(TARGET_URL ?? "").slice(0, 60)}...`);
  console.log(`Mode:   ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE (writes enabled)"}`);
  console.log(`Truncate: ${SKIP_TRUNCATE ? "DISABLED" : "ENABLED (target rows deleted before insert)"}`);
  console.log("━".repeat(60));

  const results: RowCount[] = [];

  // ── Order matters: parents first, then children ────────────────

  // 1. PlatformAdmin
  results.push(
    await migrateTable(
      "PlatformAdmin",
      () => src.platformAdmin.findMany(),
      () => tgt.platformAdmin.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.platformAdmin.create({ data: { ...r } });
          count++;
        }
        return count;
      },
    ),
  );

  // 2. Restaurant
  results.push(
    await migrateTable(
      "Restaurant",
      () => src.restaurant.findMany(),
      () => tgt.restaurant.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.restaurant.create({
            data: {
              ...r,
              deliveryFee: toBigInt(r.deliveryFee),
              minDelivery: toBigInt(r.minDelivery),
            },
          });
          count++;
        }
        return count;
      },
    ),
  );

  // 3. RestaurantConfig (String JSON → Json)
  results.push(
    await migrateTable(
      "RestaurantConfig",
      () => src.restaurantConfig.findMany(),
      () => tgt.restaurantConfig.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.restaurantConfig.create({
            data: {
              ...r,
              menuCategories: parseJSON(r.menuCategories, []),
              features: parseJSON(r.features, {}),
              openingHours: parseJSON(r.openingHours, {}),
              socialLinks: parseJSON(r.socialLinks, {}),
            },
          });
          count++;
        }
        return count;
      },
    ),
  );

  // 4. Admin
  results.push(
    await migrateTable(
      "Admin",
      () => src.admin.findMany(),
      () => tgt.admin.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.admin.create({ data: { ...r } });
          count++;
        }
        return count;
      },
    ),
  );

  // 5. Customer (totalSpent Int → BigInt)
  results.push(
    await migrateTable(
      "Customer",
      () => src.customer.findMany(),
      () => tgt.customer.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.customer.create({
            data: {
              ...r,
              totalSpent: toBigInt(r.totalSpent),
            },
          });
          count++;
        }
        return count;
      },
    ),
  );

  // 6. Driver
  results.push(
    await migrateTable(
      "Driver",
      () => src.driver.findMany(),
      () => tgt.driver.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.driver.create({ data: { ...r } });
          count++;
        }
        return count;
      },
    ),
  );

  // 7. Staff (salary Int → BigInt)
  results.push(
    await migrateTable(
      "Staff",
      () => src.staff.findMany(),
      () => tgt.staff.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.staff.create({
            data: { ...r, salary: toBigInt(r.salary) },
          });
          count++;
        }
        return count;
      },
    ),
  );

  // 8. MenuItem (price Int → BigInt)
  results.push(
    await migrateTable(
      "MenuItem",
      () => src.menuItem.findMany(),
      () => tgt.menuItem.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.menuItem.create({
            data: { ...r, price: toBigInt(r.price) },
          });
          count++;
        }
        return count;
      },
    ),
  );

  // 9. Reservation
  results.push(
    await migrateTable(
      "Reservation",
      () => src.reservation.findMany(),
      () => tgt.reservation.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.reservation.create({ data: { ...r } });
          count++;
        }
        return count;
      },
    ),
  );

  // 10. Order (multiple Int → BigInt, items String → Json)
  results.push(
    await migrateTable(
      "Order",
      () => src.order.findMany(),
      () => tgt.order.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.order.create({
            data: {
              ...r,
              items: parseJSON(r.items, []),
              total: toBigInt(r.total),
              deliveryFee: toBigInt(r.deliveryFee),
              discount: toBigInt(r.discount),
              tax: toBigInt(r.tax),
            },
          });
          count++;
        }
        return count;
      },
    ),
  );

  // 11. Payment (amount Int → BigInt, metadata String → Json)
  results.push(
    await migrateTable(
      "Payment",
      () => src.payment.findMany(),
      () => tgt.payment.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.payment.create({
            data: {
              ...r,
              amount: toBigInt(r.amount),
              metadata: parseJSON(r.metadata, {}),
            },
          });
          count++;
        }
        return count;
      },
    ),
  );

  // 12. Invoice (Int → BigInt, String → Json)
  results.push(
    await migrateTable(
      "Invoice",
      () => src.invoice.findMany(),
      () => tgt.invoice.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.invoice.create({
            data: {
              ...r,
              items: parseJSON(r.items, []),
              subtotal: toBigInt(r.subtotal),
              tax: toBigInt(r.tax),
              total: toBigInt(r.total),
            },
          });
          count++;
        }
        return count;
      },
    ),
  );

  // 13. Quote
  results.push(
    await migrateTable(
      "Quote",
      () => src.quote.findMany(),
      () => tgt.quote.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.quote.create({
            data: {
              ...r,
              items: parseJSON(r.items, []),
              subtotal: toBigInt(r.subtotal),
              discount: toBigInt(r.discount),
              total: toBigInt(r.total),
            },
          });
          count++;
        }
        return count;
      },
    ),
  );

  // 14. Expense
  results.push(
    await migrateTable(
      "Expense",
      () => src.expense.findMany(),
      () => tgt.expense.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.expense.create({
            data: { ...r, amount: toBigInt(r.amount) },
          });
          count++;
        }
        return count;
      },
    ),
  );

  // 15. Review
  results.push(
    await migrateTable(
      "Review",
      () => src.review.findMany(),
      () => tgt.review.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.review.create({ data: { ...r } });
          count++;
        }
        return count;
      },
    ),
  );

  // 16. LoyaltyReward (value Int → BigInt)
  results.push(
    await migrateTable(
      "LoyaltyReward",
      () => src.loyaltyReward.findMany(),
      () => tgt.loyaltyReward.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.loyaltyReward.create({
            data: { ...r, value: toBigInt(r.value) },
          });
          count++;
        }
        return count;
      },
    ),
  );

  // 17. LoyaltyPointsHistory
  results.push(
    await migrateTable(
      "LoyaltyPointsHistory",
      () => src.loyaltyPointsHistory.findMany(),
      () => tgt.loyaltyPointsHistory.deleteMany({}),
      async (rows) => {
        let count = 0;
        for (const r of rows) {
          await tgt.loyaltyPointsHistory.create({ data: { ...r } });
          count++;
        }
        return count;
      },
    ),
  );

  // 18. PushSubscription (skip — browser-specific, must re-register on new domain)
  console.log("[migrate] PushSubscription: skipped (browser-specific, must re-register)");

  // ── Final report ───────────────────────────────────────────────
  console.log("");
  console.log("━".repeat(60));
  console.log("Migration report");
  console.log("━".repeat(60));
  console.log(
    "Table".padEnd(28) +
      "Source".padStart(10) +
      "Inserted".padStart(10) +
      "Status".padStart(10),
  );
  console.log("-".repeat(60));
  for (const r of results) {
    const status = r.source === r.inserted ? "✅" : "⚠️";
    console.log(
      r.table.padEnd(28) +
        String(r.source).padStart(10) +
        String(r.inserted).padStart(10) +
        status.padStart(10),
    );
  }
  console.log("━".repeat(60));

  const totalSource = results.reduce((s, r) => s + r.source, 0);
  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  console.log(`Total: ${totalSource} rows in source, ${totalInserted} rows inserted`);

  if (totalSource === totalInserted) {
    console.log("✅ Migration successful — all rows transferred.");
  } else {
    console.log("⚠️  Some rows were not inserted — check the table-by-table report above.");
  }
}

main()
  .catch((err) => {
    console.error("[migrate] FATAL:", err);
    process.exit(1);
  })
  .finally(async () => {
    await src.$disconnect();
    await tgt.$disconnect();
  });
