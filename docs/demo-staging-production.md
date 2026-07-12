# Mode Démo, Staging et Production

KFM Delice supporte 3 modes de fonctionnement via la variable `APP_MODE`.

---

## 🎭 Mode Démo (`APP_MODE=demo`)

Pour démonstrations, tests et formation.

```env
APP_MODE=demo
ALLOW_DEFAULT_TENANT=true
ALLOW_AUTO_SEED=true
ALLOW_PRISMA_DB_PUSH_FALLBACK=true
ENABLE_PUBLIC_RESTAURANT_REGISTRATION=false
NEXT_PUBLIC_SHOW_DEMO_CREDS=false
```

**Comportement :**
- Auto-seed crée des comptes démo (admin@kfm-delice.com / kfm2024)
- `ALLOW_DEFAULT_TENANT=true` : fallback vers le 1er restaurant si pas de slug
- Safety net `ensure-postgres-columns.cjs` s'exécute au démarrage
- `db push` autorisé si `migrate deploy` échoue
- Politique mot de passe : 6 caractères minimum

---

## 🧪 Mode Staging (`APP_MODE=staging`)

Pour tests pré-production sur une base réelle.

```env
APP_MODE=staging
ALLOW_DEFAULT_TENANT=false
ALLOW_AUTO_SEED=true
ALLOW_PRISMA_DB_PUSH_FALLBACK=false
ENABLE_PUBLIC_RESTAURANT_REGISTRATION=false
NEXT_PUBLIC_SHOW_DEMO_CREDS=false
```

**Comportement :**
- Auto-seed autorisé (pour créer des données de test)
- `ALLOW_DEFAULT_TENANT=false` : tenant explicite requis
- Safety net s'exécute (pour rattraper les colonnes manquantes)
- `db push` INTERDIT — `migrate deploy` strict
- Politique mot de passe : 6 caractères minimum

---

## 🏛️ Mode Production (`APP_MODE=production`)

Pour la vraie production multi-clients.

```env
APP_MODE=production
ALLOW_DEFAULT_TENANT=false
ALLOW_AUTO_SEED=false
ALLOW_PRISMA_DB_PUSH_FALLBACK=false
ENABLE_PUBLIC_RESTAURANT_REGISTRATION=false
NEXT_PUBLIC_SHOW_DEMO_CREDS=false
```

**Comportement :**
- **Aucun auto-seed** — les comptes démo ne sont JAMAIS créés
- `ALLOW_DEFAULT_TENANT=false` : tenant explicite requis (pas de fallback)
- Safety net **désactivé** — `migrate deploy` strict uniquement
- `db push` **INTERDIT**
- Politique mot de passe **stricte** : 12 caractères + majuscule + minuscule + chiffre + caractère spécial
- `assertProductionSafety()` vérifie au démarrage que les flags dangereux ne sont pas activés

---

## 🔒 Vérifications de sécurité production

La fonction `assertProductionSafety()` dans `src/lib/runtime-mode.ts` vérifie au démarrage :

```ts
if (APP_MODE === 'production') {
  if (ALLOW_AUTO_SEED === 'true') → FATAL
  if (ALLOW_DEFAULT_TENANT === 'true') → FATAL
  if (ALLOW_PRISMA_DB_PUSH_FALLBACK === 'true') → FATAL
}
```

---

## 📋 Checklist passage démo → production

- [ ] `APP_MODE=production` défini
- [ ] `ALLOW_AUTO_SEED=false`
- [ ] `ALLOW_DEFAULT_TENANT=false`
- [ ] `ALLOW_PRISMA_DB_PUSH_FALLBACK=false`
- [ ] Comptes démo supprimés ou mots de passe changés
- [ ] PlatformAdmin créé via `scripts/create-platform-admin.cjs`
- [ ] `JWT_SECRET` ≥ 64 caractères aléatoires
- [ ] `DATABASE_URL` pointe vers une DB PostgreSQL de production
- [ ] SMTP configuré (notifications email)
- [ ] Backups PostgreSQL configurés et testés
- [ ] Monitoring uptime actif (UptimeRobot ou équivalent)
- [ ] Sentry DSN configuré (error tracking)
- [ ] Domaine personnalisé configuré (HTTPS)
