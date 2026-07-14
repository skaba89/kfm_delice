# Render Production Cutover — KFM Delice

Guide pour passer KFM Delice du mode démo au mode production.

---

## 1. Avant le cutover

### 1.1 Sauvegarder la base de données

```bash
pg_dump "$DATABASE_URL" | gzip > backup-avant-cutover.sql.gz
```

### 1.2 Vérifier que toutes les migrations sont appliquées

```bash
npx prisma migrate status
```

Toutes les migrations doivent être "applied". Si une est "pending", exécuter `npx prisma migrate deploy`.

### 1.3 Créer le PlatformAdmin de production

```bash
PLATFORM_ADMIN_EMAIL="admin@kfm-delice.com" \
PLATFORM_ADMIN_PASSWORD="MotDePasseFort123!" \
PLATFORM_ADMIN_NAME="Super Admin KFM" \
node scripts/create-platform-admin.cjs
```

---

## 2. Changer les variables d'environnement sur Render

Dans Render → Environment, changer :

| Variable | Avant (démo) | Après (production) |
|----------|-------------|-------------------|
| `APP_MODE` | `demo` | `production` |
| `ALLOW_AUTO_SEED` | `true` | `false` |
| `ALLOW_DEFAULT_TENANT` | `true` | `false` |
| `ALLOW_PRISMA_DB_PUSH_FALLBACK` | `true` | `false` |
| `ENABLE_PUBLIC_RESTAURANT_REGISTRATION` | `false` | `false` |
| `NEXT_PUBLIC_SHOW_DEMO_CREDS` | `false` | `false` |

---

## 3. Désactiver les comptes démo

Après le cutover, les comptes démo (`admin@kfm-delice.com`, `manager@kfm-delice.com`, etc.) doivent être désactivés ou avoir leurs mots de passe changés.

Via SQL :
```sql
UPDATE "Admin" SET status = 'inactive' WHERE email IN (
  'admin@kfm-delice.com',
  'manager@kfm-delice.com',
  'staff@kfm-delice.com'
);
```

Ou via le dashboard admin → Utilisateurs → Désactiver.

---

## 4. Rotation des mots de passe

Pour tous les comptes admin encore actifs :
1. Dashboard admin → Utilisateurs → bouton 🔑 (reset password)
2. Générer un nouveau mot de passe (12+ caractères)
3. L'utilisateur devra le changer à la prochaine connexion (`mustChangePassword=true`)

---

## 5. Migration stricte

En production, `render-start.sh` exécute :
```bash
node_modules/.bin/prisma migrate deploy
```

Si ça échoue → **FATAL** (le service ne démarre pas). Pas de fallback `db push`.

---

## 6. Smoke tests

Après le déploiement :

```bash
BASE_URL=https://votre-domaine.com bash scripts/smoke-render.sh
```

Résultat attendu :
```
[smoke] ✓ /api/status
[smoke] ✓ /menu
[smoke] ✓ /api/menu?limit=1000
[smoke] ✓ All smoke tests passed
```

---

## 7. Rollback

Si le déploiement échoue :

1. Render → Manual Deploy → déployer le commit précédent
2. Si la DB est corrompue :
   ```bash
   gunzip < backup-avant-cutover.sql.gz | psql "$DATABASE_URL"
   ```
3. Remettre `APP_MODE=demo` temporairement si nécessaire

---

## 8. Vérification finale

- [ ] `/api/status` = 200
- [ ] `/menu` = 200
- [ ] `/api/menu?limit=1000` = 200
- [ ] Login platform admin = 200
- [ ] `ALLOW_AUTO_SEED=false`
- [ ] `ALLOW_DEFAULT_TENANT=false`
- [ ] `ALLOW_PRISMA_DB_PUSH_FALLBACK=false`
- [ ] Comptes démo désactivés
- [ ] SMTP configuré
- [ ] Backups configurés
- [ ] Monitoring actif
