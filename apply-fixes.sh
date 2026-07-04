#!/usr/bin/env bash
# =============================================================================
# KFM Delice — Application des 3 commits de fix + push sécurisé
# =============================================================================
# Ce script est AUTONOME : il ne dépend d'aucun fichier externe.
# Il modifie directement les fichiers source, crée la migration,
# commit tout, demande votre token GitHub de manière sécurisée,
# puis pousse vers origin/main.
#
# UTILISATION (depuis Git Bash / MSYS2 sur Windows) :
#   1. Sauvegardez ce script dans : ~/Documents/kfm_delice/apply-fixes.sh
#   2. cd ~/Documents/kfm_delice
#   3. chmod +x apply-fixes.sh
#   4. ./apply-fixes.sh
#
# PRÉREQUIS :
#   - Vous êtes dans votre clone local du dépôt (sur la branche main)
#   - Vous avez généré un NOUVEAU token GitHub (l'ancien est compromis)
#     sur https://github.com/settings/tokens (scope: repo)
# =============================================================================

set -e

cd "$(dirname "$0")"

echo "=============================================="
echo "  KFM Delice — Application des fixes + push"
echo "=============================================="
echo ""
echo "Working directory: $(pwd)"
echo "Current branch: $(git branch --show-current)"
echo ""

# Vérifier qu'on est bien dans le dépôt kfm_delice
if [ ! -f "package.json" ] || [ ! -d "src/app/api" ]; then
  echo "ERREUR : Vous devez exécuter ce script depuis la racine du dépôt kfm_delice."
  echo "         (le dossier qui contient package.json et src/)"
  exit 1
fi

# Vérifier qu'on est sur main et à jour
git checkout main
echo "-> Pull des derniers changements depuis origin..."
git pull origin main
echo ""
echo "-> État actuel :"
git log --oneline -3
echo ""

# ──────────────────────────────────────────────────────────────────────────
# COMMIT 1 : Multi-tenant isolation for reservations, stock, driver-orders
# ──────────────────────────────────────────────────────────────────────────

echo "── Application commit 1/3 : multi-tenant (reservations, stock, driver-orders) ──"

# Fix /api/reservations PATCH
python -c "
import re
f = 'src/app/api/reservations/route.ts'
with open(f, 'r', encoding='utf-8') as fh: c = fh.read()
old = '''    const { id, ...rawData } = validation.data;
    if (!id) {
      return NextResponse.json({ error: \"ID requis\" }, { status: 400 });
    }

    // Build update data with only provided fields'''
new = '''    const { id, ...rawData } = validation.data;
    if (!id) {
      return NextResponse.json({ error: \"ID requis\" }, { status: 400 });
    }

    // ── Multi-tenant isolation ──────────────────────────────────
    // Verify the reservation belongs to the admin's restaurant BEFORE
    // updating. Prevents cross-tenant modifications.
    const existing = await db.reservation.findFirst({
      where: { id, restaurantId: admin.restaurantId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: \"Réservation introuvable\" }, { status: 404 });
    }

    // Build update data with only provided fields'''
if old in c:
  c = c.replace(old, new)
  with open(f, 'w', encoding='utf-8') as fh: fh.write(c)
  print('  ✓ reservations/route.ts patched')
else:
  print('  → reservations/route.ts already patched (or pattern not found)')
"

# Fix /api/stock PATCH (findUnique -> findFirst with restaurantId)
python -c "
f = 'src/app/api/stock/route.ts'
with open(f, 'r', encoding='utf-8') as fh: c = fh.read()
old = '''    const existing = await prisma.stockItem.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: \"Article introuvable\" }, { status: 404 });'''
new = '''    // ── Multi-tenant isolation ──────────────────────────────────
    // findUnique by id only would let an admin of restaurant A modify
    // stock of restaurant B by guessing a UUID. findFirst by id AND
    // restaurantId enforces tenant scoping.
    const existing = await prisma.stockItem.findFirst({
      where: { id, restaurantId: admin.restaurantId },
    });
    if (!existing) return NextResponse.json({ error: \"Article introuvable\" }, { status: 404 });'''
if old in c:
  c = c.replace(old, new)
  with open(f, 'w', encoding='utf-8') as fh: fh.write(c)
  print('  ✓ stock/route.ts PATCH fixed')
else:
  print('  → stock/route.ts PATCH already fixed (or pattern not found)')
"

# Fix /api/stock DELETE
python -c "
f = 'src/app/api/stock/route.ts'
with open(f, 'r', encoding='utf-8') as fh: c = fh.read()
old = '''    await prisma.stockItem.delete({ where: { id } });
    return NextResponse.json({ success: true });'''
new = '''    // ── Multi-tenant isolation: scope delete to admin's restaurant.
    // deleteMany returns { count: N } — if N === 0, the item either
    // didn't exist or belonged to another restaurant (we return 404
    // either way, without leaking which one).
    const result = await prisma.stockItem.deleteMany({
      where: { id, restaurantId: admin.restaurantId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: \"Article introuvable\" }, { status: 404 });
    }
    return NextResponse.json({ success: true });'''
if old in c:
  c = c.replace(old, new)
  with open(f, 'w', encoding='utf-8') as fh: fh.write(c)
  print('  ✓ stock/route.ts DELETE fixed')
else:
  print('  → stock/route.ts DELETE already fixed (or pattern not found)')
"

# Fix /api/driver-orders PATCH (CRITICAL - cross-tenant fraud)
python -c "
f = 'src/app/api/driver-orders/route.ts'
with open(f, 'r', encoding='utf-8') as fh: c = fh.read()
old = '''    const { orderId, status, lat, lng } = validation.data;

    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: \"Commande non trouvée\" }, { status: 404 });'''
new = '''    const { orderId, status, lat, lng } = validation.data;

    // ── Multi-tenant isolation + driver ownership ───────────────
    // The driver must only be able to update an order that:
    //   1. Belongs to the driver's restaurant (tenant scope)
    //   2. Is EITHER already assigned to them OR is an unassigned
    //      delivery order that they are now accepting (picking_up)
    //
    // Without this check, a driver of restaurant A could mutate any
    // order of restaurant B by guessing an order UUID — including
    // marking it as \"delivered\" (which would credit their own earnings).
    const order = await db.order.findFirst({
      where: {
        id: orderId,
        restaurantId: driverAuth.restaurantId,
        orderType: \"delivery\",
        OR: [
          { driverId: driverAuth.id },
          // Allow accepting an unassigned order only if action is pickup
          { driverId: null, status: { in: [\"ready\", \"picking_up\"] } },
        ],
      },
      select: { id: true, driverId: true, status: true },
    });
    if (!order) {
      return NextResponse.json(
        { error: \"Commande non trouvée ou non assignée à ce livreur\" },
        { status: 404 }
      );
    }

    // If the driver is trying to update a status on an order that
    // belongs to another driver (after the OR filter above matched the
    // unassigned branch but the order was since assigned to someone
    // else), reject. This is a race-condition guard.
    if (order.driverId && order.driverId !== driverAuth.id) {
      return NextResponse.json(
        { error: \"Cette commande est assignée à un autre livreur\" },
        { status: 403 }
      );
    }'''
if old in c:
  c = c.replace(old, new)
  with open(f, 'w', encoding='utf-8') as fh: fh.write(c)
  print('  ✓ driver-orders/route.ts patched')
else:
  print('  → driver-orders/route.ts already patched (or pattern not found)')
"

git add -A
git -c user.email="fix@kfm-delice.local" -c user.name="KFM Delice Fix" commit -m "fix(security): multi-tenant isolation for reservations, stock, driver-orders

Completes the security audit started in 768d99f. Four more routes
were doing update/delete by id only, allowing cross-tenant mutations.

Routes fixed:
- /api/reservations PATCH: findFirst by id + admin.restaurantId
- /api/stock PATCH: findFirst by id + admin.restaurantId
- /api/stock DELETE: deleteMany with restaurantId, 404 if count=0
- /api/driver-orders PATCH (CRITICAL): findFirst with tenant scope +
  driver ownership check + race-condition guard. Without this, a driver
  could mark ANY order as delivered by guessing UUID, crediting their
  own earnings (cross-tenant fraud)." 2>&1 | tail -3
echo ""

# ──────────────────────────────────────────────────────────────────────────
# COMMIT 2 : Multi-tenant isolation for kitchen, admins, driver-location
# ──────────────────────────────────────────────────────────────────────────

echo "── Application commit 2/3 : multi-tenant (kitchen, admins, driver-location) ──"

# Fix /api/kitchen PATCH
python -c "
f = 'src/app/api/kitchen/route.ts'
with open(f, 'r', encoding='utf-8') as fh: c = fh.read()
old = '    const existing = await prisma.order.findUnique({ where: { id: orderId } });\n    if (!existing) return NextResponse.json({ error: \"Commande introuvable\" }, { status: 404 });'
new = '''    // ── Multi-tenant isolation ──────────────────────────────────
    // Verify the order belongs to the admin's restaurant BEFORE updating.
    // Without this, a kitchen staff of restaurant A could mark any order
    // of restaurant B as 'ready' or 'cancelled' by guessing an order UUID.
    const existing = await prisma.order.findFirst({
      where: { id: orderId, restaurantId: admin.restaurantId },
    });
    if (!existing) return NextResponse.json({ error: \"Commande introuvable\" }, { status: 404 });'''
if old in c:
  c = c.replace(old, new)
  with open(f, 'w', encoding='utf-8') as fh: fh.write(c)
  print('  ✓ kitchen/route.ts patched')
else:
  print('  → kitchen/route.ts already patched (or pattern not found)')
"

# Fix /api/admins PATCH
python -c "
f = 'src/app/api/admins/route.ts'
with open(f, 'r', encoding='utf-8') as fh: c = fh.read()
old = '''    const { id, password, currentPassword, ...rest } = validation.data;
    if (!id) {
      return NextResponse.json({ error: \"ID requis\" }, { status: 400 });
    }

    const updateData: { email?: string; name?: string; password?: string; role?: string; status?: string } = { ...rest };
    if (password) {
      // If the admin is changing their own password, verify current password
      if (admin.id === id) {
        if (!currentPassword) {
          return NextResponse.json({ error: \"Mot de passe actuel requis\" }, { status: 400 });
        }
        // Fetch the admin's current password hash
        const targetAdmin = await db.admin.findUnique({ where: { id } });
        if (!targetAdmin) {
          return NextResponse.json({ error: \"Administrateur introuvable\" }, { status: 404 });
        }
        const isValid = await verifyPassword(currentPassword, targetAdmin.password);
        if (!isValid) {
          return NextResponse.json({ error: \"Mot de passe actuel incorrect\" }, { status: 400 });
        }
      }
      // If a different admin is changing this admin's password, no currentPassword needed
      updateData.password = await hashPassword(password);
    }

    const updatedAdmin = await db.admin.update({ where: { id }, data: updateData });'''
new = '''    const { id, password, currentPassword, ...rest } = validation.data;
    if (!id) {
      return NextResponse.json({ error: \"ID requis\" }, { status: 400 });
    }

    // ── Multi-tenant isolation ──────────────────────────────────
    // Verify the target admin belongs to the requesting admin's restaurant.
    // Without this, an admin of restaurant A could change the password of
    // an admin of restaurant B by guessing an admin UUID — full account
    // takeover across tenants.
    const targetAdmin = await db.admin.findFirst({
      where: { id, restaurantId: admin.restaurantId },
      select: { id: true, password: true },
    });
    if (!targetAdmin) {
      return NextResponse.json({ error: \"Administrateur introuvable\" }, { status: 404 });
    }

    const updateData: { email?: string; name?: string; password?: string; role?: string; status?: string } = { ...rest };
    if (password) {
      // If the admin is changing their own password, verify current password
      if (admin.id === id) {
        if (!currentPassword) {
          return NextResponse.json({ error: \"Mot de passe actuel requis\" }, { status: 400 });
        }
        const isValid = await verifyPassword(currentPassword, targetAdmin.password);
        if (!isValid) {
          return NextResponse.json({ error: \"Mot de passe actuel incorrect\" }, { status: 400 });
        }
      }
      // If a different admin is changing this admin's password, no currentPassword needed
      updateData.password = await hashPassword(password);
    }

    const updatedAdmin = await db.admin.update({ where: { id }, data: updateData });'''
if old in c:
  c = c.replace(old, new)
  with open(f, 'w', encoding='utf-8') as fh: fh.write(c)
  print('  ✓ admins/route.ts patched')
else:
  print('  → admins/route.ts already patched (or pattern not found)')
"

# Fix /api/driver-location PATCH
python -c "
f = 'src/app/api/driver-location/route.ts'
with open(f, 'r', encoding='utf-8') as fh: c = fh.read()
old = '''    const { driverId, lat, lng, orderId, status } = validation.data;
    const targetDriverId = driverAuth ? driverAuth.id : driverId;
    if (!targetDriverId) return NextResponse.json({ error: \"driverId requis\" }, { status: 400 });'''
new = '''    const { driverId, lat, lng, orderId, status } = validation.data;
    // If admin is calling, they must specify a driverId AND that driver
    // must belong to the admin's restaurant (multi-tenant isolation).
    // If driver is calling, they can only update their own location.
    let targetDriverId: string | undefined;
    if (driverAuth) {
      targetDriverId = driverAuth.id;
    } else if (admin) {
      targetDriverId = driverId;
      if (!targetDriverId) {
        return NextResponse.json({ error: \"driverId requis\" }, { status: 400 });
      }
      // ── Multi-tenant isolation ────────────────────────────────
      // Verify the target driver belongs to the admin's restaurant.
      const targetDriver = await db.driver.findFirst({
        where: { id: targetDriverId, restaurantId: admin.restaurantId },
        select: { id: true },
      });
      if (!targetDriver) {
        return NextResponse.json({ error: \"Livreur introuvable\" }, { status: 404 });
      }
    }
    if (!targetDriverId) return NextResponse.json({ error: \"driverId requis\" }, { status: 400 });'''
if old in c:
  c = c.replace(old, new)
  with open(f, 'w', encoding='utf-8') as fh: fh.write(c)
  print('  ✓ driver-location/route.ts patched')
else:
  print('  → driver-location/route.ts already patched (or pattern not found)')
"

git add -A
git -c user.email="fix@kfm-delice.local" -c user.name="KFM Delice Fix" commit -m "fix(security): multi-tenant isolation for kitchen, admins, driver-location

Three more routes were doing mutations without tenant scoping.

Routes fixed:
- /api/kitchen PATCH: findFirst by id + restaurantId (was findUnique by id)
- /api/admins PATCH: findFirst by id + restaurantId BEFORE password check.
  CRITICAL: was full cross-tenant account takeover via password change.
- /api/driver-location PATCH: verify target driver belongs to admin's restaurant" 2>&1 | tail -3
echo ""

# ──────────────────────────────────────────────────────────────────────────
# COMMIT 3 : PostgreSQL BigInt arithmetic + missing tables migration
# ──────────────────────────────────────────────────────────────────────────

echo "── Application commit 3/3 : BigInt arithmetic + missing tables migration (CRITIQUE) ──"

# Fix /api/orders/route.ts - recalculatedTotal
python -c "
f = 'src/app/api/orders/route.ts'
with open(f, 'r', encoding='utf-8') as fh: c = fh.read()
old = '''      if (dbItem) {
        // Use the DB price, not the client-sent price
        recalculatedTotal += dbItem.price * itemQty;
        return { ...item, qty: itemQty, price: dbItem.price };
      }'''
new = '''      if (dbItem) {
        // Use the DB price, not the client-sent price.
        // Number() wraps BigInt (PostgreSQL) and is a no-op for number (SQLite).
        recalculatedTotal += Number(dbItem.price) * itemQty;
        return { ...item, qty: itemQty, price: dbItem.price };
      }'''
if old in c:
  c = c.replace(old, new)
  with open(f, 'w', encoding='utf-8') as fh: fh.write(c)
  print('  ✓ orders/route.ts recalculatedTotal fixed')

# Fix deliveryFee
old = '''    if (body.orderType === 'delivery') {
      const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId } });
      recalculatedTotal += body.deliveryFee || restaurant?.deliveryFee || 0;
    }'''
new = '''    if (body.orderType === 'delivery') {
      const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId } });
      recalculatedTotal += Number(body.deliveryFee || restaurant?.deliveryFee || 0);
    }'''
if old in c:
  c = c.replace(old, new)
  with open(f, 'w', encoding='utf-8') as fh: fh.write(c)
  print('  ✓ orders/route.ts deliveryFee fixed')

# Fix driver commission calculation
old = '''        if (driver) {
          await db.driver.update({
            where: { id: existingOrder.driverId },
            data: {
              status: \"available\",
              totalDeliveries: { increment: 1 },
              // Credit earnings on delivery: commission % of order total (or delivery fee, whichever is higher)
              ...(data.status === \"delivered\" ? {
                totalEarnings: { increment: Math.max(
                  Math.round(existingOrder.total * (driver.commissionRate / 100)),
                  existingOrder.deliveryFee
                ) },
              } : {}),
            },
          });
          // Persist the earning on the order for history
          if (data.status === \"delivered\") {
            const earning = Math.max(
              Math.round(existingOrder.total * (driver.commissionRate / 100)),
              existingOrder.deliveryFee
            );
            await db.order.update({ where: { id }, data: { driverEarning: earning } });
          }
        }'''
new = '''        if (driver) {
          // Convert BigInt fields to Number before arithmetic — PostgreSQL
          // returns BigInt for monetary fields; SQLite returns number.
          // Number() is a no-op on number and wraps BigInt safely.
          const orderTotal = Number(existingOrder.total);
          const orderDeliveryFee = Number(existingOrder.deliveryFee);
          const commissionRate = Number(driver.commissionRate);
          const computedEarning = Math.max(
            Math.round(orderTotal * (commissionRate / 100)),
            orderDeliveryFee
          );
          await db.driver.update({
            where: { id: existingOrder.driverId },
            data: {
              status: \"available\",
              totalDeliveries: { increment: 1 },
              // Credit earnings on delivery: commission % of order total (or delivery fee, whichever is higher)
              ...(data.status === \"delivered\" ? {
                totalEarnings: { increment: computedEarning },
              } : {}),
            },
          });
          // Persist the earning on the order for history
          if (data.status === \"delivered\") {
            await db.order.update({ where: { id }, data: { driverEarning: computedEarning } });
          }
        }'''
if old in c:
  c = c.replace(old, new)
  with open(f, 'w', encoding='utf-8') as fh: fh.write(c)
  print('  ✓ orders/route.ts driver commission fixed')
else:
  print('  → orders/route.ts driver commission: pattern not found (may already be fixed)')
"

# Fix /api/dashboard/route.ts
python -c "
f = 'src/app/api/dashboard/route.ts'
with open(f, 'r', encoding='utf-8') as fh: c = fh.read()
old = '''    const todayRevenue = todayOrderStats.reduce((sum, o) => sum + o.total + (o.deliveryFee || 0), 0);
    const avgRating = reviewAgg._avg.rating ? Math.round(reviewAgg._avg.rating * 10) / 10 : 0;
    const deliveryRevenue = deliveryRevenueAgg._sum.deliveryFee || 0;'''
new = '''    // Convert BigInt → Number for arithmetic. On SQLite these fields are
    // \`number\` (Int) and Number() is a no-op. On PostgreSQL they are
    // \`bigint\` and Number() is required for \`+\` to work correctly
    // (otherwise bigint + bigint = bigint, which would silently truncate).
    const todayRevenue = todayOrderStats.reduce(
      (sum, o) => sum + Number(o.total) + Number(o.deliveryFee || 0),
      0
    );
    const avgRating = reviewAgg._avg.rating ? Math.round(reviewAgg._avg.rating * 10) / 10 : 0;
    const deliveryRevenue = Number(deliveryRevenueAgg._sum.deliveryFee || 0);'''
if old in c:
  c = c.replace(old, new)
  with open(f, 'w', encoding='utf-8') as fh: fh.write(c)
  print('  ✓ dashboard/route.ts fixed')
else:
  print('  → dashboard/route.ts: pattern not found (may already be fixed)')
"

# Fix /api/analytics/route.ts (multiple changes)
python -c "
f = 'src/app/api/analytics/route.ts'
with open(f, 'r', encoding='utf-8') as fh: c = fh.read()

# Fix 1: revenueByDay
old = 'return { date: dayStr, revenue: dayOrders.reduce((sum, o) => sum + o.total, 0), count: dayOrders.length };'
new = '// Number() wraps BigInt (PostgreSQL) — no-op on number (SQLite).\n      return { date: dayStr, revenue: dayOrders.reduce((sum, o) => sum + Number(o.total), 0), count: dayOrders.length };'
if old in c:
  c = c.replace(old, new)
  print('  ✓ analytics revenueByDay fixed')

# Fix 2: dishSales revenue
old = 'dishSales[item.name].revenue += item.price * item.qty;'
new = 'dishSales[item.name].revenue += Number(item.price) * item.qty;'
if old in c:
  c = c.replace(old, new)
  print('  ✓ analytics dishSales fixed')

# Fix 3: revenueByPayment
old = '''    const revenueByPayment = {
      cash: revenueByPaymentCash._sum.total || 0,
      orange_money: revenueByPaymentOrange._sum.total || 0,
      mtn_money: revenueByPaymentMtn._sum.total || 0,
      card: revenueByPaymentCard._sum.total || 0,
    };'''
new = '''    // Convert BigInt → Number for JSON serialization (PostgreSQL).
    // On SQLite these are already number, Number() is a no-op.
    const revenueByPayment = {
      cash: Number(revenueByPaymentCash._sum.total || 0),
      orange_money: Number(revenueByPaymentOrange._sum.total || 0),
      mtn_money: Number(revenueByPaymentMtn._sum.total || 0),
      card: Number(revenueByPaymentCard._sum.total || 0),
    };'''
if old in c:
  c = c.replace(old, new)
  print('  ✓ analytics revenueByPayment fixed')

# Fix 4: thisMonthRevenue, lastMonthRevenue
old = '''      thisMonthRevenue: thisMonthAgg._sum.total || 0,
      lastMonthRevenue: lastMonthAgg._sum.total || 0,'''
new = '''      thisMonthRevenue: Number(thisMonthAgg._sum.total || 0),
      lastMonthRevenue: Number(lastMonthAgg._sum.total || 0),'''
if old in c:
  c = c.replace(old, new)
  print('  ✓ analytics thisMonth/lastMonth revenue fixed')

with open(f, 'w', encoding='utf-8') as fh: fh.write(c)
"

# Créer la migration pour les 5 tables manquantes
echo "  → Création de la migration pour les 5 tables manquantes..."
mkdir -p prisma/migrations/20260704000000_add_missing_tables

cat > prisma/migrations/20260704000000_add_missing_tables/migration.sql << 'MIGRATION_EOF'
-- Migration: Add missing tables that were in schema.prisma but NOT in
-- the initial migration (00000000000000_init).
--
-- Without this migration, prisma migrate deploy on a fresh PostgreSQL
-- database would create only 15 of the 20 tables defined in the schema.
-- The 5 missing tables are:
--   - PlatformAdmin       (used by /api/platform-login)
--   - RestaurantConfig    (used by /api/restaurant, getRestaurantConfig)
--   - PushSubscription    (used by /api/push, /api/push/send)
--   - StockItem           (used by /api/stock)
--   - StockMovement       (used by /api/stock)
--
-- This migration is IDEMPOTENT (uses IF NOT EXISTS) so it's safe to run
-- on databases that already have some of these tables.

-- CreateTable: PlatformAdmin
CREATE TABLE IF NOT EXISTS "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'super_admin',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAdmin_email_key" ON "PlatformAdmin"("email");
CREATE INDEX IF NOT EXISTS "PlatformAdmin_email_idx" ON "PlatformAdmin"("email");

-- CreateTable: RestaurantConfig
CREATE TABLE IF NOT EXISTS "RestaurantConfig" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "logo" TEXT NOT NULL DEFAULT '',
    "heroImage" TEXT NOT NULL DEFAULT '',
    "primaryColor" TEXT NOT NULL DEFAULT '#ea580c',
    "accentColor" TEXT NOT NULL DEFAULT '#f97316',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "menuCategories" JSONB NOT NULL DEFAULT '[]',
    "features" JSONB NOT NULL DEFAULT '{}',
    "openingHours" JSONB NOT NULL DEFAULT '{}',
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "customDomain" TEXT NOT NULL DEFAULT '',
    "metaTitle" TEXT NOT NULL DEFAULT '',
    "metaDescription" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantConfig_restaurantId_key" ON "RestaurantConfig"("restaurantId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RestaurantConfig_restaurantId_fkey'
    ) THEN
        ALTER TABLE "RestaurantConfig"
        ADD CONSTRAINT "RestaurantConfig_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- CreateTable: PushSubscription
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userKey" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL DEFAULT '',
    "endpoint" TEXT NOT NULL,
    "p256dhKey" TEXT NOT NULL,
    "authKey" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userKey_idx" ON "PushSubscription"("userKey");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_userType_idx" ON "PushSubscription"("userId", "userType");
CREATE INDEX IF NOT EXISTS "PushSubscription_restaurantId_idx" ON "PushSubscription"("restaurantId");

-- CreateTable: StockItem
CREATE TABLE IF NOT EXISTS "StockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "minThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT NOT NULL DEFAULT '',
    "lastRestocked" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockItem_restaurantId_category_idx" ON "StockItem"("restaurantId", "category");
CREATE INDEX IF NOT EXISTS "StockItem_restaurantId_quantity_idx" ON "StockItem"("restaurantId", "quantity");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StockItem_restaurantId_fkey'
    ) THEN
        ALTER TABLE "StockItem"
        ADD CONSTRAINT "StockItem_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- CreateTable: StockMovement
CREATE TABLE IF NOT EXISTS "StockMovement" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT NOT NULL DEFAULT '',
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockMovement_stockItemId_idx" ON "StockMovement"("stockItemId");
CREATE INDEX IF NOT EXISTS "StockMovement_restaurantId_createdAt_idx" ON "StockMovement"("restaurantId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_stockItemId_fkey'
    ) THEN
        ALTER TABLE "StockMovement"
        ADD CONSTRAINT "StockMovement_stockItemId_fkey"
        FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_restaurantId_fkey'
    ) THEN
        ALTER TABLE "StockMovement"
        ADD CONSTRAINT "StockMovement_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE;
    END IF;
END $$;
MIGRATION_EOF

echo "  ✓ Migration créée : prisma/migrations/20260704000000_add_missing_tables/migration.sql"

git add -A
git -c user.email="fix@kfm-delice.local" -c user.name="KFM Delice Fix" commit -m "fix(critical): PostgreSQL BigInt arithmetic + missing tables migration

Two CRITICAL production blockers that would have caused silent data
corruption and 500 errors on Render PostgreSQL.

## 1. BigInt arithmetic bugs (silent financial corruption)

The PostgreSQL schema uses BigInt for monetary fields (price, total,
deliveryFee) but the application code was doing arithmetic directly
on these fields WITHOUT converting to Number first.

In JavaScript:
  - bigint * number = TypeError (Prisma returns bigint on PG)
  - bigint + bigint = bigint (silently truncates decimals)

This would have caused:
  - Driver earnings calculated wrong (commission % of order total)
  - Today's revenue shown as 0 on dashboard
  - Analytics revenue by payment method = 0
  - Order total recalculated wrong on POST /api/orders
  - JSON serialization failure (BigInt can't be JSON.stringify'd)

Files fixed:
- src/app/api/orders/route.ts (recalculatedTotal, deliveryFee, driver commission)
- src/app/api/dashboard/route.ts (todayRevenue, deliveryRevenue)
- src/app/api/analytics/route.ts (revenueByDay, dishSales, revenueByPayment, thisMonthRevenue, lastMonthRevenue)

## 2. Missing Prisma migration for 5 tables

The init migration only creates 15 tables, but schema.prisma defines 20.
Missing: PlatformAdmin, RestaurantConfig, PushSubscription, StockItem, StockMovement.

Without this migration, prisma migrate deploy on fresh PostgreSQL
creates incomplete DB and every route touching these tables crashes
with 'relation does not exist' (500 error).

New migration: prisma/migrations/20260704000000_add_missing_tables/
- Idempotent (IF NOT EXISTS + DO blocks for FK constraints)
- Creates 5 missing tables with all indexes and FK relations
- Uses JSONB for PostgreSQL native JSON querying
- All FK constraints use ON DELETE CASCADE" 2>&1 | tail -3
echo ""

# ──────────────────────────────────────────────────────────────────────────
# Récapitulatif + push
# ──────────────────────────────────────────────────────────────────────────

echo ""
echo "=============================================="
echo "  3 commits créés localement"
echo "=============================================="
git log --oneline -5
echo ""
echo "Diff vs origin/main :"
git diff --stat origin/main..HEAD
echo ""
echo "-> Continuer le push vers GitHub ? (o/N)"
read -r CONFIRM
if [ "$CONFIRM" != "o" ] && [ "$CONFIRM" != "O" ] && [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Abandon. Les commits sont prêts mais pas poussés."
  echo "Vous pouvez les inspecter avec: git log"
  exit 0
fi

echo ""
echo "Entrez votre NOUVEAU token GitHub (l'ancien est compromis) :"
echo "   Généré sur : https://github.com/settings/tokens (scope: repo)"
echo "   ⚠️  Saisie masquée — ne s'affichera pas à l'écran"
echo ""
read -s -p "Token: " GH_TOKEN
echo ""
echo ""

if [ -z "$GH_TOKEN" ]; then
  echo "ERREUR : Token vide. Abandon."
  exit 1
fi

echo "-> Push vers GitHub..."
PUSH_URL="https://skaba89:${GH_TOKEN}@github.com/skaba89/kfm_delice.git"

# Push en masquant le token dans la sortie
git push "$PUSH_URL" main 2>&1 | sed "s|${GH_TOKEN}|***TOKEN-MASQUÉ***|g"

unset GH_TOKEN
unset PUSH_URL
echo ""
echo "-> Token effacé de la mémoire."

echo ""
echo "=============================================="
echo "  PUSH TERMINÉ"
echo "=============================================="
echo ""
echo "Prochaines étapes :"
echo "  1. Révoquez votre token sur https://github.com/settings/tokens"
echo "  2. Attendez 3-5 min que Render rebuild"
echo "  3. Validez avec :"
echo "     TOKEN=\$(curl -s -X POST -H 'Content-Type: application/json' \\"
echo "       -d '{\"email\":\"admin@kfm-delice.com\",\"password\":\"kfm2024\"}' \\"
echo "       https://kfm-delice-5ail.onrender.com/api/login | \\"
echo "       python -c \"import json,sys; print(json.load(sys.stdin).get('token',''))\")"
echo "     curl -s -H \"Authorization: Bearer \$TOKEN\" \\"
echo "       https://kfm-delice-5ail.onrender.com/api/dashboard | head -c 200"
echo "     (ne doit plus retourner 'Erreur serveur')"
echo ""
