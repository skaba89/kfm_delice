# 🍽️ KFM Delice — Plateforme SaaS Restaurant

Solution complète de gestion et commande pour restaurants, pensée pour le marché guinéen. Menu QR code, commandes en ligne, paiements mobile money, gestion livreurs avec géolocalisation temps réel, SaaS multi-tenant.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Prisma](https://img.shields.io/badge/Prisma-6.x-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Docker](https://img.shields.io/badge/Docker-ready-blue)

---

## 📋 Table des matières

- [Fonctionnalités](#-fonctionnalités)
- [Stack technique](#-stack-technique)
- [Déploiement rapide](#-déploiement-rapide)
- [Déploiement VPS (Docker)](#-déploiement-vps-docker)
- [Déploiement Render](#-déploiement-render)
- [Variables d'environnement](#-variables-denvironnement)
- [Comptes de démonstration](#-comptes-de-démonstration)
- [Structure du projet](#-structure-du-projet)
- [API Reference](#-api-reference)
- [Tests](#-tests)
- [Sécurité](#-sécurité)
- [Licence](#-licence)

---

## ✨ Fonctionnalités

### Restaurant
- **Menu QR Code** : générez des QR codes pour chaque table, les clients scannent et commandent
- **Commandes** : sur place (dine-in), à emporter (takeaway), livraison (delivery)
- **Réservations** : gestion des réservations avec zones (intérieur, terrasse, VIP)
- **Dashboard** : statistiques temps réel, plats populaires, revenus, commandes par heure
- **Menu CRUD** : gestion complète du menu avec catégories, badges, images
- **Factures & Devis** : génération de factures PDF, devis clients
- **Dépenses** : suivi des dépenses (ingrédients, loyer, salaires, etc.)
- **Personnel** : gestion du staff (cuisiniers, serveurs, barmans, gérants)
- **Programme fidélité** : points de fidélité, récompenses
- **Avis clients** : système de notation et commentaires

### Livraison
- **Géolocalisation temps réel** : les livreurs sont trackés en continu via GPS
- **Assignation intelligente** : le système propose automatiquement la livraison au livreur disponible le plus proche (rayon configurable, 10km par défaut)
- **Accepter / Refuser** : le livreur a 60 secondes pour accepter ou refuser une proposition
- **Suivi carte** : position du livreur sur la carte pendant la livraison
- **Gains** : calcul automatique des commissions par livreur

### SaaS Multi-tenant
- **Comptes SaaS** : un compte peut gérer plusieurs restaurants
- **Restaurants principaux & secondaires** : hiérarchie avec quotas
- **Quotas** : maxRestaurants, maxSecondaryRestaurants, maxAdmins, maxUsers
- **Platform Admin** : super-admin qui gère tous les comptes
- **Audit logs** : toutes les actions sensibles sont tracées
- **Plans** : Free, Starter, Pro, Enterprise

### Paiements
- **Espèces** (à la table ou livraison)
- **Orange Money** (Guinée) — via Orange Money Web Payment API
- **MTN MoMo** (Guinée) — via MTN MoMo Open API
- **Wave** (Guinée) — via Wave Checkout API
- **Carte bancaire** — via Stripe (Visa/Mastercard)
- **Webhook Stripe** — confirmation automatique des paiements carte

### Sécurité
- **2FA TOTP** : authentification à deux facteurs pour PlatformAdmin
- **Bcrypt** : mots de passe hachés (cost 12)
- **JWT** : tokens avec expiration 24h
- **Rate limiting** : 5 tentatives/min sur auth, 60 req/min sur API
- **Audit logs** : login, création, modification, suppression
- **Multi-tenant isolation** : chaque restaurant ne voit que ses données

### Marketing & Conformité
- **Landing page** commerciale avec features et CTA
- **Page Pricing** : 4 plans avec FAQ
- **Page Contact** : formulaire → WhatsApp
- **Pages légales** : Politique de confidentialité (RGPD), CGV, Mentions légales
- **Guide onboarding** : 5 étapes pour configurer son restaurant
- **SEO** : sitemap.xml, robots.txt, meta tags
- **Multi-langue** : Français / English (i18n)

### Technique
- **PWA** : installable sur mobile, fonctionne hors-ligne
- **Push notifications** : web push pour nouvelles commandes
- **Export CSV** : commandes, clients, factures, menu, réservations, comptes
- **Notifications email** : nouvelle commande, réservation, quota dépassé
- **CI/CD** : GitHub Actions (SQLite + PostgreSQL)
- **Monitoring** : Sentry (error tracking)
- **Docker** : déployable sur n'importe quel VPS

---

## 🛠️ Stack technique

| Domaine | Technologie |
|---------|-------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| ORM | Prisma 6.19 |
| Database | PostgreSQL 16 (prod) / SQLite (dev) |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| Animations | Framer Motion |
| Cartes | Leaflet |
| QR Codes | qrcode.react |
| 2FA | otpauth |
| Email | Nodemailer (SMTP / Resend) |
| Paiement | Stripe SDK |
| Monitoring | Sentry |
| Tests | Vitest (345 tests) |
| E2E | Python scripts (e2e-live.py, e2e-saas.py) |
| CI/CD | GitHub Actions |
| Container | Docker + docker-compose |

---

## 🚀 Déploiement rapide

### Prérequis
- Node.js 22+
- npm ou bun
- PostgreSQL 16+ (ou SQLite pour dev)

### Local (SQLite)

```bash
git clone https://github.com/skaba89/kfm_delice.git
cd kfm_delice
npm install
bash scripts/switch-schema.sh sqlite
npx prisma generate
npx prisma db push
npm run dev
```

→ Ouvrir http://localhost:3000

### Local (PostgreSQL avec Docker)

```bash
docker run --name kfm-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=kfm_delice \
  -p 5432:5432 -d postgres:16

export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kfm_delice?schema=public"
export JWT_SECRET="your-secret-at-least-16-chars"
export ALLOW_AUTO_SEED=true

bash scripts/switch-schema.sh postgres
npx prisma generate
npx prisma migrate deploy
npm run dev
```

---

## 🐳 Déploiement VPS (Docker)

Le projet est **100% déployable sur n'importe quel VPS** sans dépendance à Render.

### Étapes

```bash
# 1. Cloner le repo sur le VPS
git clone https://github.com/skaba89/kfm_delice.git
cd kfm_delice

# 2. Configurer les variables
cp .env.production.example .env.production
nano .env.production  # remplir POSTGRES_PASSWORD et JWT_SECRET au minimum

# 3. Lancer
docker compose up -d

# 4. Vérifier
curl http://localhost:3000/api/status
```

### Services Docker

| Service | Description |
|---------|-------------|
| `db` | PostgreSQL 16 Alpine avec persistance (volume `pgdata`) |
| `app` | KFM Delice Next.js (port 3000) |
| `backup` | Cron pg_dump quotidien à 2h (retention 7 jours) |

### Backup manuel

```bash
docker compose exec db pg_dump -U kfm_delice kfm_delice | gzip > backup.sql.gz
```

---

## ☁️ Déploiement Render

### Configuration Render

| Champ | Valeur |
|-------|--------|
| Build Command | `bash render-build.sh` |
| Start Command | `bash render-start.sh` |
| Branch | `main` |
| Runtime | Node |

### Après chaque changement de schéma Prisma

1. Render → **Manual Deploy** → **Clear build cache & deploy**
2. Attendre 5-7 minutes
3. Vérifier les logs : `[render-start] Running prisma migrate deploy...`

---

## 🔐 Variables d'environnement

### Obligatoires

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL de connexion DB | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret JWT (16+ chars) | `my-super-secret-64-chars...` |
| `NODE_ENV` | Environnement | `production` |

### App

| Variable | Défaut | Description |
|----------|--------|-------------|
| `ALLOW_AUTO_SEED` | `true` | Seed automatique des données démo |
| `ALLOW_PRISMA_DB_PUSH_FALLBACK` | `true` | Fallback `db push` si migration échoue |
| `ALLOW_DEFAULT_TENANT` | `true` | Fallback vers le 1er restaurant |
| `TENANT_STRATEGY` | `slug-header` | Stratégie multi-tenant |
| `ENABLE_PUBLIC_RESTAURANT_REGISTRATION` | `false` | Inscription publique restaurant |
| `NEXT_PUBLIC_SHOW_DEMO_CREDS` | `false` | Afficher les identifiants démo |

### Email (optionnel — sinon console.log)

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Votre email |
| `SMTP_PASS` | Mot de passe d'application |
| `EMAIL_FROM` | `KFM Delice <noreply@kfm-delice.com>` |
| `RESEND_API_KEY` | (alternative) Clé API Resend |

### Paiements (optionnel — sinon mode mock)

| Variable | Provider |
|----------|----------|
| `STRIPE_SECRET_KEY` | Stripe (cartes) |
| `STRIPE_WEBHOOK_SECRET` | Stripe (webhook) |
| `ORANGE_MONEY_CLIENT_ID` | Orange Money |
| `ORANGE_MONEY_CLIENT_SECRET` | Orange Money |
| `ORANGE_MONEY_MERCHANT_NUMBER` | Orange Money |
| `MTN_MOMO_SUBSCRIPTION_KEY` | MTN MoMo |
| `MTN_MOMO_USER_ID` | MTN MoMo |
| `MTN_MOMO_API_KEY` | MTN MoMo |
| `WAVE_API_KEY` | Wave |
| `WAVE_BUSINESS_ID` | Wave |

### Monitoring (optionnel)

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Sentry error tracking |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push notifications (clé publique) |
| `VAPID_PRIVATE_KEY` | Push notifications (clé privée) |
| `VAPID_SUBJECT` | `mailto:admin@kfm-delice.com` |

---

## 👤 Comptes de démonstration

| Rôle | Email | Mot de passe | URL |
|------|-------|--------------|-----|
| Platform Admin | `admin@restaurantpro.com` | `platform2024` | `/platform` |
| Restaurant Admin | `admin@kfm-delice.com` | `kfm2024` | `/admin/login` |
| Manager | `manager@kfm-delice.com` | `manager2024` | `/admin/login` |
| Staff | `staff@kfm-delice.com` | `staff2024` | `/admin/login` |
| Client | `aminata@gmail.com` | `client123` | `/client/login` |
| Livreur | `moussa@kfm-delice.com` | `driver123` | `/driver/login` |

⚠️ **Mode démo** : `ALLOW_AUTO_SEED=true` crée ces comptes. En production réelle, mettez `ALLOW_AUTO_SEED=false` et créez le PlatformAdmin via :

```bash
PLATFORM_ADMIN_EMAIL="admin@kfm-delice.com" \
PLATFORM_ADMIN_PASSWORD="MotDePasseFort123!" \
PLATFORM_ADMIN_NAME="Super Admin" \
node scripts/create-platform-admin.cjs
```

---

## 📁 Structure du projet

```
kfm_delice/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API routes (40+ endpoints)
│   │   │   ├── orders/           # Commandes + assign/accept/reject
│   │   │   ├── drivers/          # Livreurs + nearby
│   │   │   ├── platform/         # SaaS admin (accounts, restaurants, audit-logs)
│   │   │   ├── webhooks/         # Stripe webhook
│   │   │   ├── export/           # Export CSV
│   │   │   └── ...
│   │   ├── admin/                # Dashboard admin
│   │   ├── platform/             # Dashboard PlatformAdmin
│   │   ├── driver/               # Dashboard livreur
│   │   ├── table/[number]/       # Page QR code commande
│   │   ├── legal/                # Pages légales (RGPD, CGV, mentions)
│   │   ├── pricing/              # Page tarifs
│   │   ├── contact/              # Page contact
│   │   └── docs/onboarding/      # Guide onboarding
│   ├── components/
│   │   ├── admin/                # Composants dashboard admin
│   │   ├── platform/             # Composants dashboard PlatformAdmin
│   │   ├── driver/               # Composants dashboard livreur
│   │   └── ui/                   # shadcn/ui (48 composants)
│   └── lib/
│       ├── auth.ts               # Auth (JWT, bcrypt, 2FA)
│       ├── db.ts                 # Prisma client + safety net
│       ├── geo.ts                # Calcul distances GPS
│       ├── two-factor.ts         # 2FA TOTP
│       ├── payment-providers.ts  # Orange/MTN/Wave/Stripe
│       ├── email.ts              # Envoi email (SMTP/Resend)
│       ├── audit.ts              # Audit logs (non-bloquant)
│       └── i18n.ts               # Multi-langue FR/EN
├── prisma/
│   ├── schema.postgres.prisma    # Schéma PostgreSQL (production)
│   ├── schema.sqlite.prisma      # Schéma SQLite (dev)
│   └── migrations/               # 9 migrations SQL idempotentes
├── scripts/
│   ├── auto-seed.cjs             # Seed SaaS-cohérent
│   ├── backfill-accounts.cjs     # Rattachement Account
│   ├── create-platform-admin.cjs # Création PlatformAdmin sécurisé
│   ├── ensure-postgres-columns.cjs # Safety net colonnes DB
│   ├── backup-postgres.sh        # Backup PostgreSQL
│   ├── e2e-live.py               # Tests E2E (43 tests)
│   ├── e2e-saas.py               # Tests E2E SaaS (15 tests)
│   └── check-prisma-provider.cjs # Vérification provider Prisma
├── docker-compose.yml            # Stack VPS (app + DB + backup)
├── Dockerfile                    # Image Docker multi-stage
├── render-build.sh               # Script build Render/VPS
├── render-start.sh               # Script start Render/VPS
├── .github/workflows/ci.yml      # CI GitHub Actions
└── docs/                         # Documentation complète
```

---

## 🔌 API Reference

### Authentification

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/login` | Login admin (email + password) |
| POST | `/api/platform-login` | Login PlatformAdmin (avec 2FA si activé) |
| POST | `/api/customer-login` | Login client |
| POST | `/api/customer-register` | Inscription client |
| POST | `/api/driver-login` | Login livreur |
| GET | `/api/status` | Health check (public) |
| GET | `/api/health` | Diagnostic complet (admin only) |
| GET | `/api/diagnose` | Diagnostic DB (public) |

### Commandes

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/orders` | Liste commandes (paginé, filtré) |
| POST | `/api/orders` | Créer commande (public) |
| PATCH | `/api/orders` | Modifier statut commande |
| POST | `/api/orders/[id]/assign` | Assigner livraison au livreur le plus proche |
| POST | `/api/orders/[id]/accept` | Livreur accepte la livraison |
| POST | `/api/orders/[id]/reject` | Livreur refuse la livraison |

### Livreurs

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/drivers` | Liste livreurs |
| GET | `/api/drivers/nearby?lat=X&lng=Y` | Livreurs disponibles dans le rayon |
| GET | `/api/driver-me` | Profil livreur connecté |
| PATCH | `/api/driver-me` | Modifier profil/statut |
| PATCH | `/api/driver-location` | Update GPS (temps réel) |
| GET | `/api/driver-orders` | Commandes du livreur |
| GET | `/api/driver-orders/pending` | Livraisons proposées (avec auto-expire 60s) |

### Platform Admin (SaaS)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/platform/accounts` | Liste tous les comptes |
| POST | `/api/platform/accounts` | Créer un compte |
| GET | `/api/platform/accounts/[id]` | Détail compte |
| PATCH | `/api/platform/accounts/[id]/quotas` | Modifier quotas/plan |
| GET | `/api/platform/restaurants` | Liste tous les restaurants |
| POST | `/api/platform/restaurants/main` | Créer restaurant principal |
| GET | `/api/platform/audit-logs` | Logs d'audit (paginé, filtré) |
| POST | `/api/platform/2fa/setup` | Générer secret 2FA + QR code |
| POST | `/api/platform/2fa/verify` | Activer 2FA |
| POST | `/api/platform/2fa/disable` | Désactiver 2FA |
| GET | `/api/platform/2fa/status` | Statut 2FA |

### Autres

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/menu` | Menu public |
| GET | `/api/restaurant` | Infos restaurant |
| POST | `/api/reservations` | Créer réservation |
| GET | `/api/export?type=X` | Export CSV |
| POST | `/api/webhooks/stripe` | Webhook Stripe |

---

## 🧪 Tests

### Tests unitaires (Vitest)

```bash
npm test
# 345 tests / 20 fichiers
```

### Tests E2E Live

```bash
BASE_URL=https://kfm-delice-ggb4.onrender.com \
E2E_SAFE_MODE=true \
python3 scripts/e2e-live.py
# 43 tests couvrant toutes les API
```

### Tests E2E SaaS

```bash
BASE_URL=https://kfm-delice-ggb4.onrender.com \
E2E_PLATFORM_EMAIL=admin@restaurantpro.com \
E2E_PLATFORM_PASSWORD=platform2024 \
E2E_TEST_PREFIX="Test $(date +%s)" \
E2E_SAFE_MODE=true \
python3 scripts/e2e-saas.py
# 15 tests SaaS (comptes, quotas, restaurants secondaires)
```

### CI/CD (GitHub Actions)

La CI tourne sur chaque push/PR sur `main` :
- Job SQLite : lint, build, test
- Job PostgreSQL : build, test avec PostgreSQL 16 réel

---

## 🔒 Sécurité

- ✅ Mots de passe hachés (bcrypt, cost 12)
- ✅ JWT avec expiration 24h
- ✅ 2FA TOTP pour PlatformAdmin (Google Authenticator / Authy)
- ✅ Rate limiting (5 auth/min, 60 API/min)
- ✅ Multi-tenant isolation (chaque restaurant ne voit que ses données)
- ✅ Audit logs non-bloquants (login, création, modification, suppression)
- ✅ HTTPS/TLS forcé en production
- ✅ Headers de sécurité (CSP, XSS, Frame-Options, etc.)
- ✅ Aucun secret dans les logs
- ✅ Conformité RGPD/PDPO (politique de confidentialité)

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| `docs/render-deploy-checklist.md` | Guide de déploiement Render |
| `docs/render-503-troubleshooting.md` | Diagnostic des erreurs 503 |
| `docs/demo-vs-production.md` | Mode démo vs production |
| `docs/saas-account-rules.md` | Règles SaaS (Account, quotas, invariants) |
| `docs/production-readiness.md` | Checklist production |
| `docs/MIGRATION_POSTGRES.md` | Migration SQLite → PostgreSQL |

---

## 📄 Licence

Ce projet est propriétaire. Tous droits réservés.

© 2026 KFM Delice — Almamya, Corniche Nord, Conakry, République de Guinée.
