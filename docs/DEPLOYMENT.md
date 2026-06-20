# KFM Delice - Deployment & Operations Guide

## Table of contents
1. [Architecture overview](#1-architecture-overview)
2. [Repository layout](#2-repository-layout)
3. [Environment variables](#3-environment-variables)
4. [CI/CD pipelines](#4-cicd-pipelines)
5. [Initial Render deployment](#5-initial-render-deployment)
6. [PostgreSQL migration](#6-postgresql-migration)
7. [SMTP (transactional email)](#7-smtp-transactional-email)
8. [Web Push notifications](#8-web-push-notifications)
9. [Orange Money & MTN MoMo](#9-orange-money--mtn-momo)
10. [Backups & disaster recovery](#10-backups--disaster-recovery)
11. [Pre-flight health check](#11-pre-flight-health-check)
12. [Monitoring & runbook](#12-monitoring--runbook)

## 1. Architecture overview
```
GitHub repo + workflows (ci, deploy, backup)
  -> GitHub Actions CI (6 stages)
  -> Render (Next.js + PostgreSQL)
     -> SMTP, Web Push, Orange/MTN
```

**Stack**: Next.js 16, React 19, Prisma 6, PostgreSQL 16 (prod) / SQLite (dev/CI),
Tailwind CSS 4, shadcn/ui, Vitest, WebSocket, nodemailer, web-push.

## 2. Repository layout
```
.github/workflows/{ci,deploy,backup}.yml
.github/ISSUE_TEMPLATE/{bug_report,feature_request}.md
.github/PULL_REQUEST_TEMPLATE.md
prisma/{schema.prisma, schema.sqlite.prisma, schema.postgres.prisma, clean-seed.ts, production-setup.ts}
scripts/{preflight-check.sh, smoke-test.sh, setup-vapid.sh, switch-schema.sh, backup-postgres.sh, restore-postgres.sh, migrate-sqlite-to-postgres.ts, run-e2e.sh, e2e-live.py}
docs/{MIGRATION_POSTGRES.md, DEPLOYMENT.md}
render.yaml, render.yaml.sqlite, render-build.sh, render-start.sh
SECURITY.md, .env.production.example
```

## 3. Environment variables

### Required
- `DATABASE_URL` - postgresql://... or file:./...
- `JWT_SECRET` - random 32+ char string

### Production features (recommended)
- `NEXT_PUBLIC_APP_NAME`, `PUBLIC_APP_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (Web Push)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (email)
- `ORANGE_MONEY_API_KEY`, `ORANGE_MERCHANT_KEY` (Orange Money)
- `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_API_USER`, `MTN_MOMO_API_KEY` (MTN MoMo)

### CI-only
- `API_RATE_LIMIT=1000`, `AUTH_RATE_LIMIT=1000`

Generate JWT secret: `openssl rand -base64 48`
Generate VAPID keys: `bash scripts/setup-vapid.sh --update-env`

## 4. CI/CD pipelines

### `ci.yml` - runs on every push & PR
6 sequential stages: lint, typecheck, build, unit tests, E2E tests, pre-flight.
Final `ci-pass` job fails workflow if any upstream stage failed.

### `deploy.yml` - auto-deploy on push to main
Triggers Render deploy webhook. Manual dispatch supports environment selector + clear_cache.
Setup: Render > Service > Settings > Deploy Hook > copy URL > GitHub secret `RENDER_DEPLOY_HOOK_URL`.

### `backup.yml` - daily at 02:00 UTC
Runs `scripts/backup-postgres.sh`, uploads `.dump` to GitHub Artifacts (30-day retention).
Optional S3 mirror: set `BACKUP_S3_*` secrets.

## 5. Initial Render deployment

### Option A - SQLite demo (free tier)
1. Render > New > Web Service > connect repo
2. Blueprint > select `render.yaml.sqlite`
3. Add env vars: `DATABASE_URL` (auto), `JWT_SECRET`
4. Deploy

### Option B - PostgreSQL production (recommended)
1. Render > New > Blueprint > select `render.yaml`
2. Render provisions PostgreSQL + web service
3. Add production secrets (JWT, VAPID, SMTP, Orange, MTN)
4. Trigger first deploy
5. After deploy: `bunx tsx prisma/production-setup.ts --non-interactive` to create initial admin

## 6. PostgreSQL migration
See `MIGRATION_POSTGRES.md`. Quick:
```bash
bash scripts/switch-schema.sh postgres
bunx prisma migrate dev --name init_postgres
bunx tsx scripts/migrate-sqlite-to-postgres.ts --dry-run
bunx tsx scripts/migrate-sqlite-to-postgres.ts
```

## 7. SMTP (transactional email)
Providers tried in order: Resend, SMTP, console fallback.

| Provider | Free tier | Notes |
|---|---|---|
| Brevo | 300/day | Easiest, EU-based |
| SendGrid | 100/day | Most mature |
| AWS SES | 62k from EC2 | Cheapest at scale |
| Mailgun | 100/day | Good EU/US |

Verify: `curl -X POST https://your-app.onrender.com/api/email-test?template=welcome -H "Cookie: token=<jwt>"`

## 8. Web Push notifications
Generate VAPID keys: `bash scripts/setup-vapid.sh --update-env` (writes 3 vars to .env).
Copy to Render dashboard and redeploy.
- `notifyNewOrder(order)` - alerts restaurant staff
- `notifyOrderStatusUpdate(order, newStatus)` - alerts customer
- `notifyNewReservation(reservation)` - alerts restaurant staff
- `notifyDeliveryAssigned(order, driver)` - alerts driver

Test: `curl -X POST https://your-app.onrender.com/api/push/test -H "Cookie: token=<jwt>"`

## 9. Orange Money & MTN MoMo
Requires developer accounts:
- Orange Money Guinea: https://developer.orange.com
- MTN MoMo Guinea: https://momodeveloper.mtn.com

Set credentials in Render. Payment endpoints auto-detect configured providers, fall back to `cash`.

## 10. Backups & disaster recovery

### Automated daily backup
- `backup.yml` at 02:00 UTC daily
- GitHub Artifacts (30-day retention)
- Optional S3 mirror

### Manual backup
```bash
DATABASE_URL=postgresql://... bash scripts/backup-postgres.sh
```

### Restore
```bash
DATABASE_URL=postgresql://... BACKUP_FILE=backups/xxx.dump bash scripts/restore-postgres.sh
```

### RTO/RPO
- RTO: ~15 min (GitHub Artifacts), ~5 min (S3)
- RPO: 24 hours max (daily backup)

## 11. Pre-flight health check
```bash
bash scripts/preflight-check.sh
```
44 checks across 10 categories: env vars, binaries, build, unit tests, E2E tests,
Prisma schema, DB connectivity, artefacts, git state, security sweep.
Exit 0 (pass/warnings) or 1 (failures).
Flags: `--skip-tests`, `--skip-build`.

### Post-deploy smoke test
```bash
bash scripts/smoke-test.sh https://your-app.onrender.com
```
19 checks across 6 categories: availability, public API, auth flow, negative tests,
static assets, security headers.

## 12. Monitoring & runbook

### Health endpoints
- `GET /api/health` - public in dev, admin-only in prod
- `GET /api/diagnose` - full diagnostic (admin-only)

### Common incidents

**Build failed on Render**: check Render > Events > build log. Most common: missing env var.

**Database connection errors**: Render > PostgreSQL > Status. Check `DATABASE_URL`. Run `bunx prisma migrate status`.

**Emails not sent**: hit `/api/email-test?template=welcome` as admin. Check `SMTP_*` env vars.

**Push notifications not arriving**: verify `VAPID_*` env vars. `GET /api/push` shows subscriptions.

**Payments failing**: verify provider credentials. Test with `method: "cash"` to isolate.

### On-call checklist
- [ ] Render dashboard all green
- [ ] Last CI run on main is green
- [ ] Last `backup.yml` succeeded within 24h
- [ ] `/api/health` returns 200
- [ ] Test login works
- [ ] No 5xx in Render > Logs > last 1h
