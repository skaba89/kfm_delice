# Known Issues — Separate Work (Mission 7)

These items are documented as separate work and are NOT part of the
QR migration fix. They do not cause the deployment failure.

## 1. Prisma 7 Upgrade Warning

```
Update available 6.19.3 -> 7.9.1
This is a major update - please follow the guide at
https://pris.ly/d/major-version-upgrade
```

**Status:** Deferred. Prisma 7 has breaking changes (datasource `url`
no longer supported in schema files). The project is pinned to Prisma 6.x
and works correctly. Upgrading to Prisma 7 requires a separate migration
effort (schema config file, client instantiation changes).

**Action:** Track as a separate issue. Do NOT upgrade in the middle of
a deployment fix.

## 2. Next.js Middleware → Proxy Deprecation

```
⚠ The "middleware" file convention is deprecated.
Please use "proxy" instead.
```

**Status:** Cosmetic warning. `src/middleware.ts` still works in
Next.js 16. The rename to `proxy.ts` is a future deprecation, not a
blocking error.

**Action:** Rename `middleware.ts` → `proxy.ts` in a separate PR after
testing that all middleware logic (rate limiting, JWT verification,
security headers) still works.

## 3. Missing Sentry DSN

```
⚠ SENTRY_DSN is not set — error monitoring will be limited
```

**Status:** Non-blocking. Error monitoring falls back to `console.error`.
Set `SENTRY_DSN` in the Render dashboard when ready.

## 4. Missing Redis/Upstash

```
⚠ No Redis/Upstash/KV URL found — rate limiting will be in-memory only
```

**Status:** Non-blocking for single-instance deployments. Rate limiting
uses in-memory storage. For multi-instance production, set `REDIS_URL`
or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.

## 5. npm audit Vulnerabilities

```
12 vulnerabilities (1 low, 2 moderate, 9 high)
```

**Status:** The audit runs with `--include=dev` (all dependencies).
The production-only audit (`--omit=dev`) shows 0 vulnerabilities.
These are dev-dependency warnings that don't affect the production
runtime.

**Action:** Track as a separate dependency-update issue.

## 6. "No open ports detected" Message

```
==> No open ports detected, continuing to scan...
```

**Status:** This is a **consequence**, not a cause. Render scans for
open ports while the service starts. If `prisma migrate deploy` fails
(exits with code 1), Next.js never starts, so port 10000 is never
opened. Once the migration issue is fixed, Next.js will start and
Render will detect the port.

**Action:** None — this message disappears once the migration succeeds.

## 7. `package.json#prisma` Deprecation Warning

```
warn The configuration property `package.json#prisma` is deprecated
and will be removed in Prisma 7.
```

**Status:** Cosmetic. The `prisma.seed` config in `package.json` works
with Prisma 6. Will be addressed during the Prisma 7 upgrade (item 1).
