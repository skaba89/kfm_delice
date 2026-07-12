# Incident Runbook — KFM Delice

## 🚨 Service down (502/503)

### Symptômes
- `/api/status` retourne 502 ou 503
- `x-render-routing: no-server` dans les headers

### Diagnostic
1. Render Dashboard → Events → vérifier le dernier deploy
2. Render Dashboard → Logs → chercher `[render-start]` et erreurs
3. `curl -i https://kfm-delice-ggb4.onrender.com/api/status`

### Actions
1. Si deploy failed → **Manual Deploy → Clear build cache & deploy**
2. Si service crashed → vérifier les logs pour `FATAL`
3. Si DB inaccessible → vérifier Render PostgreSQL → status
4. Si `provider = "sqlite"` → Clear build cache (Prisma Client stale)

---

## 🗄️ Base de données inaccessible

### Symptômes
- `/api/diagnose` retourne `dbConnection: ERROR`
- Toutes les routes DB retournent 500

### Actions
1. Render → PostgreSQL resource → Status
2. Vérifier `DATABASE_URL` dans Environment
3. Si DB suspendue (free tier) → redémarrer
4. Si DB corrompue → restaurer depuis backup

---

## 🔄 Migration échouée

### Symptômes
- `[render-start] prisma migrate deploy failed` dans les logs
- `P3005` ou `P3012` erreur Prisma

### Actions
1. Vérifier `prisma migrate status` localement avec la même DATABASE_URL
2. Si migration en conflit → `prisma migrate resolve --rolled-back <migration>`
3. Si colonne manquante → vérifier `ensure-postgres-columns.cjs` (demo/staging only)
4. En production → NE PAS utiliser `db push`. Corriger la migration SQL manuellement.

---

## 🔐 Compte admin bloqué

### Symptômes
- Login retourne 423 `Compte bloqué`
- `lockedUntil` est dans le futur

### Actions
1. Admin → Dashboard → Utilisateurs → bouton 🔓 unlock
2. Ou via API : `POST /api/admins/[id]/unlock` (admin auth requis)
3. Reset password : bouton 🔑 → nouveau mot de passe → `mustChangePassword=true`

---

## 💳 Paiement non confirmé

### Symptômes
- `paymentStatus` reste `processing` indéfiniment
- Client a payé mais la commande n'est pas confirmée

### Actions
1. Vérifier le webhook provider (Orange/MTN/Wave dashboard)
2. URL webhook : `https://kfm-delice-ggb4.onrender.com/api/webhooks/payment/[provider]`
3. Vérifier les logs Render pour `[webhook/orange_money]` ou `[webhook/stripe]`
4. Si webhook non reçu → contacter le provider ou faire un PATCH manuel

---

## 📊 Performance dégradée

### Symptômes
- Temps de réponse > 5s
- Timeouts sur le dashboard

### Actions
1. Vérifier Sentry pour les requêtes lentes
2. Render → Metrics → CPU/Memory
3. Si free tier → le service hiberne, attendre le réveil (~30-60s)
4. Vérifier les N+1 queries (utiliser `include` au lieu de requêtes séparées)
5. Considérer un plan payant Render (Starter ~$7/mois)

---

## 🔔 Contacts

- **Admin KFM Delice** : admin@kfm-delice.com / +224 622 34 56 78
- **Render Status** : https://status.render.com
- **Sentry** : https://sentry.io (si SENTRY_DSN configuré)
- **PostgreSQL** : Render → your DB resource → Info tab
