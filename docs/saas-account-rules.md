# SaaS Account Rules — KFM Delice

## Architecture

```
PlatformAdmin (super admin plateforme)
  → Account (compte client / organisation)
    → Restaurant principal (type="principal")
      → Restaurants secondaires (type="secondary", parentRestaurantId)
    → Admins (avec quotas de création)
```

## Roles

| Role | Scope | Can create restaurants? | Can manage quotas? |
|---|---|---|---|
| `platform_admin` | Platform-wide | Yes (main restaurants) | Yes |
| `admin` (account) | Account + restaurant | Yes (secondary, if canCreateRestaurant=true) | No |
| `manager` | Restaurant | No | No |
| `staff`, `cashier`, etc. | Restaurant | No | No |

## Quota Rules

### Default limits by plan

| Plan | maxRestaurants | maxSecondaryRestaurants | maxAdmins | maxUsers |
|---|---|---|---|---|
| free | 1 | 0 | 2 | 5 |
| starter | 2 | 1 | 5 | 15 |
| pro | 5 | 4 | 15 | 50 |
| enterprise | 20 | 19 | 50 | 200 |
| custom | configurable | configurable | configurable | configurable |

### Over-quota behavior

If `maxRestaurants` is reduced below the current number of restaurants:
- No restaurants are deleted
- Account status changes to `over_quota`
- New restaurant creation is blocked
- Alert is shown to the account admin

## API Routes

### Platform Admin routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/platform/accounts` | List all accounts |
| POST | `/api/platform/accounts` | Create a new account |
| GET | `/api/platform/accounts/[id]` | Get account details |
| PATCH | `/api/platform/accounts/[id]/quotas` | Update quotas |
| POST | `/api/platform/restaurants/main` | Create main restaurant + account + admin |

### Account Admin routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/account/me` | Get account info + restaurants + quotas |
| GET | `/api/account/quota` | Get quota summary |
| POST | `/api/account/restaurants/secondary` | Create secondary restaurant |

## Secondary restaurant creation conditions

1. Admin must be authenticated
2. `admin.accountId` must exist
3. `admin.canCreateRestaurant` must be `true`
4. `account.status` must be `active` or `trial`
5. Total restaurants < `account.maxRestaurants`
6. Secondary restaurants < `account.maxSecondaryRestaurants`
7. `admin.restaurantsCreatedCount` < `admin.restaurantCreationLimit`
8. A principal restaurant must exist in the account

## Audit Log

All business actions are logged to the `AuditLog` table:

- `account_create` — Platform admin creates an account
- `quota_change` — Platform admin modifies quotas
- `restaurant_main_create` — Platform admin creates a main restaurant
- `restaurant_secondary_create` — Account admin creates a secondary restaurant
- Account suspension/reactivation
- Plan changes

## Backfill

Run `node scripts/backfill-accounts.cjs` to:

1. Create an Account for each existing restaurant without one
2. Set restaurant type to "principal" if null/empty
3. Link admins to the account
4. Set `canCreateRestaurant=true` for the main admin (role='admin')
5. Set `restaurantCreationLimit = account.maxSecondaryRestaurants` for admin role
6. Set `restaurantsCreatedCount = 0` if null

**Idempotency guarantees:**
- Never deletes any data
- Never overwrites a non-zero `restaurantCreationLimit` (custom quota preserved)
- Never downgrades `canCreateRestaurant` from `true` to `false`
- Safe to run on every restart (called automatically by `render-start.sh`)

## Post-Seed / Post-Backfill Invariants

After `auto-seed.cjs` + `backfill-accounts.cjs` have run (in that order), the following invariants MUST hold. If any of them is violated, the SaaS hierarchy is broken and you should investigate immediately:

### Restaurants
- ✅ Every restaurant has a non-null `accountId`
- ✅ Every restaurant has `type` ∈ {`"principal"`, `"secondary"`} (never null or empty)
- ✅ Every principal restaurant has `parentRestaurantId = null`
- ✅ Every secondary restaurant has `parentRestaurantId` pointing to a principal restaurant in the same account

### Admins
- ✅ Every admin has a non-null `accountId`
- ✅ Every admin with `role = "admin"` has:
  - `canCreateRestaurant = true`
  - `restaurantCreationLimit > 0` (typically equals `account.maxSecondaryRestaurants`)
  - `restaurantsCreatedCount >= 0`
- ✅ Every admin with `role ∈ {manager, staff, cashier, driver}` has:
  - `canCreateRestaurant = false`
  - `restaurantCreationLimit = 0`
  - `restaurantsCreatedCount = 0`
- ✅ An admin's `accountId` matches their restaurant's `accountId`

### Accounts
- ✅ Every account has at least one restaurant (the principal)
- ✅ `account.maxRestaurants >= 1`
- ✅ `account.maxSecondaryRestaurants <= account.maxRestaurants - 1`
- ✅ The number of restaurants linked to an account is ≤ `account.maxRestaurants`
- ✅ The number of admins linked to an account is ≤ `account.maxAdmins`

### Verification queries

```sql
-- Find orphan restaurants (no accountId or null type)
SELECT id, name, accountId, type FROM "Restaurant"
WHERE "accountId" IS NULL OR "accountId" = '' OR type IS NULL OR type = '';

-- Find orphan admins (no accountId)
SELECT id, email, role, "accountId" FROM "Admin"
WHERE "accountId" IS NULL OR "accountId" = '';

-- Find admin-role admins without creation rights
SELECT id, email, "canCreateRestaurant", "restaurantCreationLimit"
FROM "Admin"
WHERE role = 'admin' AND ("canCreateRestaurant" = false OR "restaurantCreationLimit" = 0);

-- Find manager/staff with creation rights (should be empty)
SELECT id, email, role, "canCreateRestaurant"
FROM "Admin"
WHERE role IN ('manager', 'staff', 'cashier', 'driver') AND "canCreateRestaurant" = true;
```

All four queries should return **zero rows** after a successful seed + backfill.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ENABLE_PUBLIC_RESTAURANT_REGISTRATION` | `false` | Gate public registration |
| `ALLOW_AUTO_SEED` | `true` | Allow demo auto-seed. **Set `false` for real production.** See `docs/demo-vs-production.md` |
| `ALLOW_LOGIN_AUTO_SEED` | (not set) | Allow auto-seed from login (disabled by default) |

## Related Documentation

- `docs/render-deploy-checklist.md` — Render deployment step-by-step
- `docs/demo-vs-production.md` — Demo mode vs real production mode
- `scripts/create-platform-admin.cjs` — Secure PlatformAdmin creation for production
