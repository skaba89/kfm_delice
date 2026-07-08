# Production Readiness Checklist — KFM Delice

This checklist defines what "production-ready" means for KFM Delice. Each item must be verified before going live with real customers.

---

## ✅ Render Stability

- [ ] Service deployed and reachable at the production URL
- [ ] `/api/status` returns 200 `{"status":"ok"}`
- [ ] `/menu` returns 200 (HTML page loads)
- [ ] `/api/menu?limit=1000` returns 200 with menu items
- [ ] No 503 errors in Render logs
- [ ] No 502 errors (server listens on `0.0.0.0`)
- [ ] Service survives a DB restart (Render free tier maintenance)
- [ ] `render-build.sh` uses PostgreSQL provider
- [ ] `render-start.sh` uses `node_modules/.bin/prisma` (not `npx`)
- [ ] Prisma version is 6.x (not 7.x)

## ✅ Authentication

- [ ] Admin login works: `admin@kfm-delice.com` / `kfm2024`
- [ ] Platform admin login works: `admin@restaurantpro.com` / `platform2024`
- [ ] Customer registration works (with `x-restaurant-slug` header)
- [ ] Customer login works (with `x-restaurant-slug` header)
- [ ] Driver login works (with `x-restaurant-slug` header)
- [ ] JWT tokens are issued and validated correctly
- [ ] Rate limiting is active on auth routes

## ✅ SaaS Account

- [ ] Every restaurant has a non-null `accountId`
- [ ] Every restaurant has `type` ∈ {`principal`, `secondary`}
- [ ] Every admin has a non-null `accountId`
- [ ] Admin role has `canCreateRestaurant=true` and `restaurantCreationLimit > 0`
- [ ] Manager/staff have `canCreateRestaurant=false` and `restaurantCreationLimit=0`
- [ ] `/api/account/me` returns account info
- [ ] `/api/account/quota` returns quota info
- [ ] Secondary restaurant creation works
- [ ] Secondary restaurant creation is blocked when quota is reached
- [ ] Secondary restaurant creation is blocked for managers

## ✅ Database

- [ ] `prisma migrate deploy` runs without errors
- [ ] `ensure-postgres-columns.cjs` runs without errors
- [ ] `backfill-accounts.cjs` is idempotent (safe to run multiple times)
- [ ] `auto-seed.cjs` creates SaaS-coherent data on empty DB
- [ ] No `--accept-data-loss` anywhere in the codebase
- [ ] `ALLOW_PRISMA_DB_PUSH_FALLBACK=false` in real production

## ✅ CI/CD

- [ ] GitHub Actions CI runs on every push/PR
- [ ] SQLite CI job passes (lint, build, test)
- [ ] PostgreSQL CI job passes (build, test with real Postgres)
- [ ] No secrets in CI logs
- [ ] CI uses `npm ci` (not `npm install`) for reproducible builds

## ✅ E2E Tests

- [ ] `scripts/e2e-live.py` passes against the production URL
- [ ] `scripts/e2e-saas.py` passes against the production URL
- [ ] E2E tests use configurable credentials (no hardcoded production passwords)
- [ ] `E2E_SAFE_MODE=true` skips destructive tests when running against production

## ✅ Security

- [ ] No hardcoded secrets in source code
- [ ] `JWT_SECRET` is 64+ characters and unique per environment
- [ ] `DATABASE_URL` is never logged
- [ ] `JWT_SECRET` is never logged
- [ ] Passwords are never logged
- [ ] API keys are never logged
- [ ] Audit logs are written for all critical actions (login, create, update, delete)
- [ ] Audit log writes are non-blocking (never fail the business action)
- [ ] HTTPS is enforced (Render does this automatically)
- [ ] Rate limiting is active on auth and API routes

## ✅ Demo vs Production

- [ ] `ALLOW_AUTO_SEED=false` in real production
- [ ] `NEXT_PUBLIC_SHOW_DEMO_CREDS=false` in real production
- [ ] `ENABLE_PUBLIC_RESTAURANT_REGISTRATION=false` in real production
- [ ] First PlatformAdmin created via `scripts/create-platform-admin.cjs` (not auto-seed)
- [ ] Demo accounts (`admin@kfm-delice.com`, etc.) are removed or have changed passwords
- [ ] `docs/demo-vs-production.md` is read and understood by the team

## ✅ Observability

- [ ] Render logs are monitored (at least weekly)
- [ ] `[render-start]` logs show all steps completing
- [ ] `[auto-seed]` logs show SaaS-coherent seed
- [ ] `[backfill-accounts]` logs show idempotent operation
- [ ] `[audit]` logs show audit entries being written
- [ ] No `prisma:error` entries in normal operation
- [ ] `/api/diagnose` returns `dbConnection: "ok"`

## ✅ Backups

- [ ] PostgreSQL backups are configured (Render automated backups or pg_dump cron)
- [ ] Backup restore has been tested at least once
- [ ] Backup retention policy is defined (e.g. 7 daily + 4 weekly)

## ✅ Monitoring

- [ ] Render deploy notifications are enabled (email/Slack)
- [ ] Uptime monitoring is configured (e.g. uptimerobot.com pinging `/api/status`)
- [ ] Alert on 5xx error rate > 1%
- [ ] Alert on service downtime > 1 minute

## ✅ Documentation

- [ ] `docs/render-deploy-checklist.md` is up to date
- [ ] `docs/render-503-troubleshooting.md` is up to date
- [ ] `docs/demo-vs-production.md` is up to date
- [ ] `docs/saas-account-rules.md` is up to date
- [ ] `docs/production-readiness.md` (this file) is up to date
- [ ] README.md has quick-start instructions

---

## Score: 9.5/10 target

This checklist represents the bar for a 9.5/10 production readiness score. Items not checked represent risk. The more items checked, the closer to 9.5/10.

**Current status**: Most items are verified. Remaining work:
- Configure PostgreSQL automated backups
- Set up uptime monitoring (uptimerobot.com)
- Test backup restore procedure
- Activate 2FA on PlatformAdmin account
