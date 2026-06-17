# Migration PostgreSQL — KFM Delice

Ce guide explique comment migrer KFM Delice de SQLite (dev) vers PostgreSQL (production).

## Pourquoi migrer ?

SQLite est parfait pour le développement local mais présente plusieurs limites en production :

1. **Pas de mode `insensitive`** pour les recherches case-insensitive (les logins email sont sensibles à la casse)
2. **Pas de concurrence native** — un seul writer à la fois, ce qui pose problème avec plusieurs utilisateurs simultanés
3. **Pas de `Json` natif** — les champs JSON sont stockés en String et ne peuvent pas être requêtés avec les opérateurs Prisma (`path`, `array_contains`…)
4. **Pas de `BigInt` natif** — les montants en GNF (Franc Guinéen) peuvent dépasser 2,1 milliards (Int32 max), ce qui provoquerait des overflows sur `totalSpent`, `deliveryFee`, etc.
5. **Pas de migrations transactionnelles** — `prisma migrate deploy` ne fonctionne pas correctement en SQLite
6. **Pas de réplication / backup hot** — impossibilité de scaler horizontalement

## Pré-requis

- Un serveur PostgreSQL 14+ (Render, Railway, Supabase, Neon, ou self-hosted)
- `psql` installé localement pour valider la connexion (optionnel)
- Le code à jour sur la branche `main`

## Étapes de migration

### 1. Préparer la base PostgreSQL

Créez une base PostgreSQL sur votre provider préféré. Exemple avec Render :

```bash
# Via render.yaml (inclus dans le repo) — Render crée la DB automatiquement
# Ou manuellement via le dashboard Render → New → PostgreSQL
```

Récupérez l'URL de connexion au format :
```
postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=public
```

### 2. Configurer les variables d'environnement

Copiez `.env.production.example` vers `.env` et remplissez :

```bash
cp .env.production.example .env
# Éditez .env avec vos valeurs réelles
```

Variables critiques :
- `DATABASE_URL=postgresql://...` (obligatoire)
- `JWT_SECRET=$(openssl rand -hex 64)` (obligatoire)
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (pour les emails)
- `PUBLIC_APP_URL=https://votre-domaine.com` (pour les liens dans les emails)

### 3. Basculer le schéma Prisma vers PostgreSQL

```bash
# Vérifier l'état actuel
bash scripts/switch-schema.sh status

# Basculer vers PostgreSQL
bash scripts/switch-schema.sh postgres
```

Le script :
- Copie `prisma/schema.postgres.prisma` vers `prisma/schema.prisma`
- Régénère le client Prisma avec l'engine PostgreSQL
- Affiche les prochaines étapes

### 4. Créer la migration initiale

**Premier déploiement uniquement** :

```bash
# Créer le SQL de migration à partir du diff schema vs DB
npx prisma migrate dev --name init_postgres

# Cela crée prisma/migrations/<timestamp>_init_postgres/migration.sql
# Et applique la migration à la DB PostgreSQL
```

**Déploiements suivants** (CI/CD, Render) :

```bash
# Applique toutes les migrations en attente (sans regeneration)
npx prisma migrate deploy
```

### 5. Seeder la base (premier déploiement)

```bash
# Comptes de test (admin@platform.com, admin@monrestaurant.com, etc.)
bunx tsx prisma/clean-seed.ts
```

### 6. Migrer les données existantes (optionnel)

Si vous avez des données production en SQLite à migrer :

```bash
# 1. Export SQLite → JSON
node scripts/export-sqlite-to-json.js   # (à créer si besoin)

# 2. Import JSON → PostgreSQL
node scripts/import-json-to-postgres.js # (à créer si besoin)
```

Pour un fresh start (recommandé en phase de lancement), ignorez cette étape.

### 7. Démarrer l'application

```bash
npm run build
npm start
```

Vérifiez que tout fonctionne :
- `GET /api/health` → 200 OK
- `POST /api/login` avec `admin@platform.com / Platform2024!` → 200 avec token JWT
- `GET /api/stats` (avec header `Authorization: Bearer <token>`) → 200 avec stats

### 8. Tester l'envoi d'emails

```bash
# Récupérez un token admin
TOKEN=$(curl -s -X POST https://votre-domaine.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@monrestaurant.com","password":"Admin2024!"}' \
  | jq -r .token)

# Vérifiez la config SMTP
curl -H "Authorization: Bearer $TOKEN" \
     https://votre-domaine.com/api/email-test

# Envoyez un email de test
curl -X POST -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"to":"votre@email.com","template":"welcome"}' \
     https://votre-domaine.com/api/email-test
```

## Différences entre les schémas

| Champ | SQLite (Int) | PostgreSQL (BigInt) | Raison |
|-------|--------------|---------------------|--------|
| `Restaurant.deliveryFee` | Int | BigInt | GNF amounts > 2.1B |
| `Restaurant.minDelivery` | Int | BigInt | idem |
| `Customer.totalSpent` | Int | BigInt | cumul sur la vie du client |
| `MenuItem.price` | Int | BigInt | prix menu en GNF |
| `Order.total`, `deliveryFee`, `discount`, `tax` | Int | BigInt | montants commande |
| `Invoice.subtotal`, `tax`, `total` | Int | BigInt | factures |
| `Quote.subtotal`, `discount`, `total` | Int | BigInt | devis |
| `Expense.amount` | Int | BigInt | dépenses |
| `Payment.amount` | Int | BigInt | paiements |
| `Staff.salary` | Int | BigInt | salaires |
| `LoyaltyReward.value` | Int | BigInt | valeur récompense |

> **Note** : Le code applicatif doit être adapté pour gérer les `BigInt` côté client JSON (les BigInt ne sont pas sérialisables en JSON nativement). Le helper `bigIntToNumber()` déjà présent dans `src/lib/db.ts` gère cette conversion. Vérifiez que les API routes utilisent bien ce helper pour les nouveaux champs migrés.

## Différences JSON

| Champ | SQLite (String) | PostgreSQL (Json) | Bénéfice |
|-------|-----------------|-------------------|----------|
| `RestaurantConfig.menuCategories` | String `"[]"` | Json `[]` | requêtes `path`, `array_contains` |
| `RestaurantConfig.features` | String `"{}"` | Json `{}` | idem |
| `RestaurantConfig.openingHours` | String `"{}"` | Json `{}` | idem |
| `RestaurantConfig.socialLinks` | String `"{}"` | Json `{}` | idem |
| `Order.items` | String (JSON) | Json | requêtes sur items par id |
| `Invoice.items` | String | Json | idem |
| `Quote.items` | String | Json | idem |
| `Payment.metadata` | String `"{}"` | Json `{}` | idem |

## Retour-arrière (rollback)

Si PostgreSQL ne fonctionne pas, vous pouvez revenir à SQLite :

```bash
bash scripts/switch-schema.sh sqlite
npx prisma db push --accept-data-loss
bunx tsx prisma/clean-seed.ts
```

Mais **vous perdrez toutes les données** saisies pendant la période PostgreSQL. Pensez à exporter avant le rollback :

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql
```

## Dépannage

### `PrismaClientInitializationError: Database doesn't exist`

La base PostgreSQL n'existe pas encore. Créez-la via le dashboard de votre provider, ou :

```bash
psql "$DATABASE_URL" -c "CREATE DATABASE kfm_delice;"
```

### `Error: P1014: The underlying virtual table ... does not exist`

Vous avez basculé vers PostgreSQL mais le client Prisma utilise encore l'engine SQLite. Régénérez :

```bash
rm -rf node_modules/.prisma
npx prisma generate
```

### `Cannot read properties of null (reading 'map')` sur les endpoints items

Les champs JSON ont changé de type (`String` → `Json`). Le code qui fait `JSON.parse(order.items)` va casser. Adaptez :

```typescript
// Avant (SQLite)
const items = JSON.parse(order.items);

// Après (PostgreSQL)
const items = order.items; // déjà un objet/tableau
```

Pour une transition en douceur, vous pouvez garder le type `String` même en PostgreSQL (Prisma le supporte). La migration vers `Json` est optionnelle et peut se faire plus tard.

### ` BigInt is not JSON serializable`

Côté serveur, utilisez `bigIntToNumber()` :

```typescript
import { bigIntToNumber } from '@/lib/db';

const order = await db.order.findUnique({ where: { id } });
return NextResponse.json({
  ...order,
  total: bigIntToNumber(order.total),  // BigInt → number
});
```

Côté client, le code TypeScript existant devrait continuer à fonctionner car il reçoit déjà des `number`.

## Checklist de déploiement

- [ ] Base PostgreSQL provisionnée (Render / Railway / Supabase / Neon)
- [ ] `DATABASE_URL` défini en variable d'environnement (format `postgresql://`)
- [ ] `JWT_SECRET` défini (64+ caractères aléatoires)
- [ ] `PUBLIC_APP_URL` défini (URL publique HTTPS)
- [ ] Variables SMTP définies (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`)
- [ ] Optionnel : clés VAPID pour push notifications
- [ ] Optionnel : clés Orange Money / MTN MoMo pour paiements mobiles
- [ ] `bash scripts/switch-schema.sh postgres` exécuté
- [ ] `npx prisma migrate deploy` exécuté avec succès
- [ ] `bunx tsx prisma/clean-seed.ts` exécuté (premier déploiement)
- [ ] `npm run build` passe sans erreur
- [ ] Test de connexion : `curl https://votre-domaine.com/api/health` → 200
- [ ] Test de login : `POST /api/login` avec `admin@platform.com` → 200 + token
- [ ] Test d'email : `POST /api/email-test` avec template `welcome` → 200 + email reçu
- [ ] Backup automatique configuré (pg_dump cron ou backup managé du provider)

## Liens utiles

- [Prisma Migrate docs](https://www.prisma.io/docs/orm/prisma-migrate)
- [Render PostgreSQL](https://render.com/docs/databases)
- [Supabase](https://supabase.com/docs/guides/database)
- [Neon](https://neon.tech/docs/introduction)
