# 🚀 Guide de Mise en Production — KFM Delice

## ✅ État actuel

- **24/24 tests E2E** passent en production
- **362 tests unitaires** passent
- **80/80 tests multi-rôles** passent
- TypeScript : 0 erreur
- Build Next.js : succès
- Endpoints de réparation : supprimés (sécurité)
- `--accept-data-loss` : retiré

---

## 📋 Checklist de mise en production

### 1. Configuration Render (obligatoire)

Variables d'environnement à vérifier sur Render → Environment :

```env
DATABASE_URL=postgresql://...           # Déjà configuré
JWT_SECRET=<32+ chars aléatoire>        # Déjà configuré
NODE_ENV=production                     # Déjà configuré
APP_MODE=production                     # Déjà configuré
PUBLIC_APP_URL=https://kfm-delice-ggb4.onrender.com  # ⚠️ À CONFIGURER
ALLOW_DEFAULT_TENANT=false              # Multi-tenant strict
ALLOW_AUTO_SEED=false                   # Pas d'auto-seed en prod
```

**PUBLIC_APP_URL est critique** : sans cette variable, les QR codes des tables pointeront vers `http://localhost:3000` au lieu de l'URL Render.

### 2. Post-déploiement (une seule fois)

```bash
# 1. Vérifier que le serveur répond
curl https://kfm-delice-ggb4.onrender.com/api/status

# 2. Lancer le test complet (24/24 attendu)
BASE_URL=https://kfm-delice-ggb4.onrender.com \
E2E_ADMIN_EMAIL=admin@kfm-delice.com \
E2E_ADMIN_PASSWORD=kfm2024 \
E2E_SLUG=kfm-delice \
python3 scripts/test-all-features.py

# 3. Lancer le test multi-rôles (80/80 attendu)
BASE_URL=https://kfm-delice-ggb4.onrender.com \
E2E_ADMIN_EMAIL=admin@kfm-delice.com \
E2E_ADMIN_PASSWORD=kfm2024 \
E2E_SLUG=kfm-delice \
AUTH_RATE_LIMIT=1000 \
API_RATE_LIMIT=10000 \
python3 scripts/test-multi-roles.py
```

### 3. Configuration du restaurant

1. **Login admin** : `https://kfm-delice-ggb4.onrender.com/admin/login`
   - Email : `admin@kfm-delice.com`
   - Mot de passe : `kfm2024` (changer au premier login)

2. **Paramètres → Général** : nom, description, devise (GNF)

3. **Paramètres → Contact** : téléphone, WhatsApp, email

4. **Paramètres → Adresse & GPS** : adresse + latitude/longitude (pour livraison)

5. **Menu** : ajouter les plats avec prix, catégories, images

### 4. Configuration des tables QR

1. Aller sur **`/admin/tables`**
2. Créer une table par table physique :
   - Nom : "Table Terrasse 1"
   - Numéro : "T01" (unique dans le restaurant)
   - Capacité : 4
   - Zone : "Terrasse"
3. Télécharger le QR code PNG ou imprimer via `/admin/tables/<id>/qr-print`
4. Placer le QR code sur la table

### 5. Configuration des notifications sonores

1. **Settings → Notifications sonores**
2. Activer le son (master toggle)
3. Configurer le volume (50% recommandé)
4. Activer "Nouvelle commande" + "Commande prête"
5. Cliquer "Tester" pour vérifier le son
6. **Note** : cliquer d'abord n'importe où sur la page pour unlock l'audio

### 6. Configuration des paliers fidélité

1. **Settings → Paliers Fidélité**
2. Les 4 paliers par défaut sont pré-configurés :
   - 🥉 Bronze : 0 GNF — pas de remise
   - 🥈 Argent : 500 000 GNF — 5% de remise
   - 🥇 Or : 2 000 000 GNF — 10% + livraison gratuite
   - 💎 Platine : 5 000 000 GNF — 15% + livraison + plat gratuit
3. Ajuster les seuils et remises selon votre stratégie

### 7. Configuration des codes promo

1. Créer des codes via l'API (UI à venir) :
   ```bash
   curl -X POST -H "Authorization: Bearer $TOKEN" -H "x-restaurant-slug: kfm-delice" \
     -H "Content-Type: application/json" \
     -d '{"code":"BIENVENUE10","discountType":"percent","discountValue":10,"minOrderTotal":10000}' \
     https://kfm-delice-ggb4.onrender.com/api/promo-codes
   ```
2. Les clients saisissent le code au checkout pour obtenir la remise

### 8. Création des utilisateurs

1. **Admin** : `Utilisateurs` → créer des admins/manager/staff/cashier/kitchen
2. **Rôles** : chaque rôle a des permissions spécifiques (voir Settings → Rôles & Privilèges)
3. **Drivers** : `Livreurs` → créer des livreurs avec zone et véhicule

---

## 🔧 Maintenance

### Lancer les tests régulièrement

```bash
# Test complet (24 checks)
npm run e2e:all

# Test multi-rôles (80 checks)
npm run e2e:roles

# Test QR tables (12 checks)
npm run e2e:qr
```

### Backup de la base de données

```bash
# Sur Render → PostgreSQL → Download dump
# Ou via script :
bash scripts/backup-postgres.sh
```

### Mise à jour du code

1. `git pull origin main` sur ton PC
2. Vérifier : `npm run typecheck && npm run test`
3. Push : `git push origin main`
4. Render déploie automatiquement
5. Vérifier : `curl https://kfm-delice-ggb4.onrender.com/api/status`

---

## 🆘 Dépannage

### Le serveur ne répond pas
- Render free tier : cold start de 30-60s
- Attendre 1 minute et réessayer
- Vérifier les logs sur Render Dashboard

### "Restaurant non trouvé"
- Vérifier que `x-restaurant-slug` header est envoyé
- Vérifier que le slug existe : `curl https://URL/api/restaurants`

### "Restaurant fermé"
- Les commandes publiques sont bloquées de 23h à 11h (heure de Conakry)
- Les admins peuvent utiliser `adminOverride: true` pour bypasser

### Le son ne marche pas
- Cliquer d'abord sur la page (les navigateurs bloquent l'autoplay)
- Vérifier Settings → Notifications sonores → activé

### Le QR code ne marche pas
- Vérifier que la table est active (toggle vert)
- Vérifier que `qrEnabled` est true
- Scanner le QR → doit rediriger vers `/r/<slug>/menu?tableToken=...`

---

## 📊 Métriques de production

| Métrique | Valeur |
|---|---|
| Tests E2E | 24/24 ✅ |
| Tests unitaires | 362 ✅ |
| Tests multi-rôles | 80/80 ✅ |
| TypeScript erreurs | 0 ✅ |
| Endpoints de réparation | Supprimés ✅ |
| `--accept-data-loss` | Retiré ✅ |
| Multi-tenant isolation | Actif ✅ |
| 2FA Platform Admin | Actif ✅ |
| Rate limiting | Actif ✅ |
| PWA | Installable ✅ |
| Docker | Prêt ✅ |
