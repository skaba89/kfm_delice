# Render 503 Troubleshooting — KFM Delice

This document lists the most common causes of HTTP 503 errors on Render and how to diagnose each one.

---

## Quick diagnostic commands

```bash
# 1. Lightweight health check (public, no DB)
curl -i https://kfm-delice-ggb4.onrender.com/api/status
# Expected: HTTP 200 {"status":"ok",...}

# 2. Frontend page
curl -i https://kfm-delice-ggb4.onrender.com/menu
# Expected: HTTP 200 (HTML)

# 3. Menu API (DB-backed)
curl -i "https://kfm-delice-ggb4.onrender.com/api/menu?limit=1000"
# Expected: HTTP 200 {"data":[...]}

# 4. Login admin
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@kfm-delice.com","password":"kfm2024"}' \
  https://kfm-delice-ggb4.onrender.com/api/login
# Expected: {"id":"...","token":"eyJ..."}
```

If `/api/status` returns 503, the server is not running at all.
If `/api/status` returns 200 but `/api/menu` returns 503/500, the DB is unreachable.

---

## Cause 1: Next.js not listening on 0.0.0.0

**Symptoms**: 502 Bad Gateway on all routes, but logs show "Your service is live 🎉".

**Cause**: Render sets `HOSTNAME` to the Kubernetes pod name (e.g. `srv-xxx-hibernate-yyy`). If `render-start.sh` uses `$HOSTNAME` instead of `0.0.0.0`, Next.js only listens on that internal interface and Render's load balancer cannot reach it.

**Diagnostic**: Search Render logs for:
```
[render-start] Starting Next.js server on srv-...
```
If you see a pod name instead of `0.0.0.0`, this is the cause.

**Fix**: `render-start.sh` must end with:
```bash
exec node_modules/.bin/next start -p "$PORT" -H 0.0.0.0
```
(NOT `exec npx next start -p "$PORT" -H "$HOSTNAME"`)

---

## Cause 2: Wrong port

**Symptoms**: 502 on all routes.

**Cause**: Render expects the service to listen on the port defined by the `PORT` env var (usually 10000). If the app hardcodes a different port (e.g. 3000), Render's health check fails.

**Diagnostic**: Check Render logs for:
```
==> Detected service running on port 10000   ← OK
==> No open ports detected, continuing to scan...  ← WRONG PORT
```

**Fix**: `render-start.sh` must use `"$PORT"` (not a hardcoded number):
```bash
export PORT="${PORT:-3000}"
exec node_modules/.bin/next start -p "$PORT" -H 0.0.0.0
```

---

## Cause 3: Prisma Client generated with SQLite instead of PostgreSQL

**Symptoms**: Login returns 500 with `provider = "sqlite"` and `URL must start with the protocol file:`.

**Cause**: The Prisma Client in `node_modules/.prisma/client/` was generated with the SQLite schema, but `DATABASE_URL` points to PostgreSQL. Prisma validates the datasource at query time and refuses to connect.

**Diagnostic**: Call `/api/diagnose`:
```bash
curl -s https://kfm-delice-ggb4.onrender.com/api/diagnose
```
If you see `dbConnection: ERROR: provider = "sqlite"`, this is the cause.

**Fix**:
1. Ensure `render-build.sh` copies `schema.postgres.prisma` to `schema.prisma` BEFORE running `prisma generate`.
2. Use `node_modules/.bin/prisma generate` (NOT `npx prisma generate` — npx may download Prisma 7+).
3. Do **Clear build cache & deploy** on Render (the cache may hold a stale SQLite client).

---

## Cause 4: Prisma 7 downloaded by npx

**Symptoms**: Build fails with:
```
Error: The datasource property `url` is no longer supported in schema files.
Move connection URLs for Migrate to `prisma.config.ts`
Prisma CLI Version : 7.8.0
```

**Cause**: `npx prisma generate` downloads the latest Prisma version (7.x) which has breaking schema changes. The project is designed for Prisma 6.x.

**Fix**:
1. Pin Prisma versions in `package.json` (no caret):
   ```json
   "prisma": "6.19.2",
   "@prisma/client": "6.19.2"
   ```
2. Use `node_modules/.bin/prisma` in all scripts (NOT `npx prisma`).
3. `render-build.sh` verifies the installed Prisma version and fails fast if 7.x is detected.

---

## Cause 5: `.next/BUILD_ID` missing

**Symptoms**: 503 on all routes; logs show the server started but no requests are served.

**Cause**: The Next.js build did not complete successfully. Either `next build` failed silently, or the `.next/` directory was not created.

**Diagnostic**: `render-start.sh` checks for this:
```
[render-start] WARNING: .next directory missing
[render-start] WARNING: .next/BUILD_ID missing
```

**Fix**:
1. Check `render-build.sh` logs above for build errors.
2. Re-run with **Clear build cache & deploy**.
3. Ensure `render-build.sh` runs `next build` (not `npm run build` which adds `prisma generate` and may conflict).

---

## Cause 6: `DATABASE_URL` absent in production

**Symptoms**: Server starts but all DB queries fail with 500. `/api/status` returns 200 (it's DB-free), but `/api/menu` returns 500.

**Cause**: `DATABASE_URL` is not set in Render's Environment tab, OR the PostgreSQL resource is not linked to the web service.

**Diagnostic**: Check `render-start.sh` logs:
```
[render-start] DATABASE_URL is NOT SET   ← problem
[render-start] DATABASE_URL is set (value hidden for security)   ← OK
```

**Fix**:
1. Render → your web service → Environment.
2. Add `DATABASE_URL` from the PostgreSQL resource (Render → your DB → copy `Internal Database URL`).
3. Redeploy.

---

## Cause 7: Blocking migration

**Symptoms**: Server never starts; logs show `prisma migrate deploy` running forever or failing.

**Cause**: A migration has a SQL error, or there's a pending migration that requires interactive prompt (which cannot happen on Render).

**Diagnostic**: Check logs for:
```
[render-start] Running prisma migrate deploy...
⚠️ prisma migrate deploy failed — falling back to db push
```

**Fix**:
1. Set `ALLOW_PRISMA_DB_PUSH_FALLBACK=true` in Render Environment to allow the fallback.
2. Investigate the migration error in the logs (the SQL error is printed above the failure message).
3. Fix the migration file in `prisma/migrations/`.
4. For real production, set `ALLOW_PRISMA_DB_PUSH_FALLBACK=false` once migrations are clean.

---

## Cause 8: Seed crashes

**Symptoms**: Server starts but takes a long time to respond, or `auto-seed.cjs` throws an error.

**Cause**: The seed script has a bug (e.g. BigInt mismatch, missing SaaS field, unique constraint violation).

**Diagnostic**: Check logs for:
```
[render-start] Running auto-seed...
[auto-seed] Error: ...
```

**Fix**:
1. The seed is non-fatal — the server should still start. If it doesn't, the error is elsewhere.
2. Read the `[auto-seed] Error:` message to identify the failing step.
3. Fix the seed script in `scripts/auto-seed.cjs`.
4. Common issues:
   - `totalSpent: 0` → must be `BigInt(0)` on PostgreSQL
   - Missing `accountId` field → ensure schema has SaaS fields
   - Duplicate email → the DB already has demo data; the seed should be idempotent

---

## Cause 9: Service hibernation (free tier)

**Symptoms**: First request after inactivity takes 30-60 seconds, then succeeds. Subsequent requests are fast.

**Cause**: Render free tier services hibernate after 15 minutes of inactivity. The first request wakes them up, which takes time.

**Fix**:
- This is expected behavior on the free tier.
- Upgrade to a paid plan for always-on service.
- Or set up a cron job to ping `/api/status` every 10 minutes (e.g. with uptimerobot.com).

---

## Cause 10: `output: "standalone"` removed but old bundle cached

**Symptoms**: After removing `output: "standalone"` from `next.config.ts`, the service still loads a stale SQLite Prisma Client.

**Cause**: Render's build cache holds the old `.next/standalone/` bundle with the SQLite client.

**Fix**: **Clear build cache & deploy** on Render (NOT just "Deploy latest commit").

---

## General diagnostic checklist

When you see a 503, follow this order:

1. **Check `/api/status`** — if it returns 200, the server is up; the issue is DB-related.
2. **Check `/api/diagnose`** — reveals the DB connection status and provider.
3. **Check Render logs** for `[render-start]` lines — they tell you which step succeeded/failed.
4. **Check Render Events tab** — to see if the last deploy succeeded or failed.
5. **Try Clear build cache & deploy** — fixes most cache-related issues.
6. **Verify environment variables** — especially `DATABASE_URL`, `JWT_SECRET`, `ALLOW_AUTO_SEED`.

---

## Cause 11: `x-render-routing: no-server` (URL points to no active service)

**Symptoms**: All requests return 404 with header `x-render-routing: no-server`.

```bash
curl -i https://kfm-delice-5ail.onrender.com/api/status
# HTTP/1.1 404 Not Found
# x-render-routing: no-server
# Not Found
```

**Cause**: The URL you are testing does NOT correspond to an active Render service. This happens when:
1. The original Render service was deleted and recreated with a new URL
2. You are using an old URL from documentation that was never updated
3. The service was suspended or never deployed

**Important**: This is NOT a Next.js error, NOT a Prisma error, NOT a code error. Render's load balancer cannot find any server to route your request to.

**Diagnostic**:
```bash
# Check the headers — if you see this, the URL is wrong
curl -sI https://YOUR-URL.onrender.com/api/status | grep -i "x-render-routing"
# x-render-routing: no-server  ← URL is wrong/inactive
```

**Fix**:
1. Go to **https://dashboard.render.com**
2. Find your KFM Delice web service
3. Click **Open** / **Visit** — this opens the CORRECT URL
4. Copy that URL (e.g. `https://kfm-delice-ggb4.onrender.com`)
5. Update all your bookmarks, scripts, and documentation with the correct URL
6. Test with `curl -i https://CORRECT-URL.onrender.com/api/status` — should return 200

**Current active URL** (as of 2026-07-08): `https://kfm-delice-ggb4.onrender.com`

**Old/inactive URL** (returns `no-server`): `https://kfm-delice-5ail.onrender.com`

If you recreate the service again, the URL will change again — always verify via the Render dashboard.

---

## Related documentation

- `docs/render-deploy-checklist.md` — step-by-step deploy guide
- `docs/demo-vs-production.md` — demo vs real production configuration
- `docs/saas-account-rules.md` — SaaS Account invariants and verification queries
