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
2. Set restaurant type to "principal"
3. Link admins to the account
4. Set `canCreateRestaurant=true` for the main admin

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ENABLE_PUBLIC_RESTAURANT_REGISTRATION` | `false` | Gate public registration |
| `ALLOW_AUTO_SEED` | `true` | Allow demo auto-seed |
| `ALLOW_LOGIN_AUTO_SEED` | (not set) | Allow auto-seed from login (disabled by default) |
