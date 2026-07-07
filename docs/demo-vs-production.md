# Mode Démo vs Vraie Production

KFM Delice peut fonctionner dans deux modes : **démo** (Render actuel) et **vraie production**. Ce document explique les différences, les risques, et comment passer de l'un à l'autre.

---

## 🎭 Mode Démo (actuel sur Render)

Le mode démo charge automatiquement un restaurant `KFM Delice` avec des comptes de test connus. C'est utile pour :
- Tester l'application sans configuration manuelle
- Démontrer les fonctionnalités SaaS
- Le développement et la formation

### Variables d'environnement

```bash
NODE_ENV=production
ALLOW_AUTO_SEED=true
NEXT_PUBLIC_SHOW_DEMO_CREDS=true
ENABLE_PUBLIC_RESTAURANT_REGISTRATION=false
JWT_SECRET=<votre-secret-jwt-aleatoire-64-chars>
DATABASE_URL=postgresql://...  # Render fournit ça
```

### Comptes de démonstration créés

| Rôle | Email | Mot de passe | Notes |
|------|-------|--------------|-------|
| PlatformAdmin (SaaS) | `admin@restaurantpro.com` | `platform2024` | Gère tous les comptes SaaS |
| Restaurant Admin | `admin@kfm-delice.com` | `kfm2024` | Admin principal, peut créer des restaurants secondaires |
| Manager | `manager@kfm-delice.com` | `manager2024` | Gestion quotidienne, ne peut pas créer de restaurants |
| Staff | `staff@kfm-delice.com` | `staff2024` | Opérations |

### ⚠️ Risques du mode démo

1. **Mots de passe publics** : N'importe qui lisant le code source peut se connecter avec ces comptes.
2. **Données exposées** : Toutes les opérations (modifier menu, voir commandes, etc.) sont accessibles.
3. **Pas d'audit réel** : Les actions sont mélangées entre utilisateurs démo et réels.
4. **Non conforme RGPD/PDPO** : Aucune donnée personnelle réelle ne devrait être stockée en mode démo.

### Quand utiliser le mode démo

- ✅ Déploiement Render de test/staging
- ✅ Démonstration à un prospect
- ✅ Formation des équipes
- ✅ Développement local

### Quand NE PAS utiliser le mode démo

- ❌ Production avec de vrais clients
- ❌ Environnement avec des données personnelles réelles
- ❌ Audit de sécurité / conformité
- ❌ Quand le restaurant est réellement en exploitation

---

## 🏛️ Mode Vraie Production

Le mode production ne charge **aucune donnée de démonstration**. Vous devez créer manuellement le premier `PlatformAdmin`, puis créer les comptes SaaS via l'API platform.

### Variables d'environnement

```bash
NODE_ENV=production
ALLOW_AUTO_SEED=false
NEXT_PUBLIC_SHOW_DEMO_CREDS=false
ENABLE_PUBLIC_RESTAURANT_REGISTRATION=false
JWT_SECRET=<secret-jwt-tres-long-et-aleatoire-64+chars>
DATABASE_URL=postgresql://...
SEED_TOKEN=<token-aleatoire-pour-api-secure>
```

### Étapes de mise en production

#### 1. Déployer avec `ALLOW_AUTO_SEED=false`

Sur Render → Environment → `ALLOW_AUTO_SEED=false`. Au redémarrage, la base restera vide (aucun restaurant, aucun admin).

#### 2. Créer le premier PlatformAdmin

Sur votre machine locale (ou en CI), exécutez le script sécurisé. Le mot de passe doit faire **au moins 12 caractères**.

```bash
# Option A : variables dans le shell actuel (temporaire)
export PLATFORM_ADMIN_EMAIL="admin@kfm-delice.com"
export PLATFORM_ADMIN_PASSWORD="MonMotDePasseTresLong123!"
export PLATFORM_ADMIN_NAME="Super Admin KFM"
export DATABASE_URL="postgresql://...votre-render-db-url..."

node scripts/create-platform-admin.cjs
```

```bash
# Option B : lire les vars depuis un fichier .env.local (non commité)
set -a && source .env.local && set +a
node scripts/create-platform-admin.cjs
```

Sortie attendue :
```
[create-platform-admin] ✓ PlatformAdmin created
[create-platform-admin]   id:        <uuid>
[create-platform-admin]   email:     admin@kfm-delice.com
[create-platform-admin]   name:      Super Admin KFM
[create-platform-admin]   role:      super_admin
[create-platform-admin]   status:    active
```

#### 3. Se connecter en tant que PlatformAdmin

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@kfm-delice.com","password":"MonMotDePasseTresLong123!"}' \
  https://votre-domaine.com/api/platform/login
```

#### 4. Créer le premier Account + Restaurant principal

Via l'API platform (avec le token PlatformAdmin) :

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "KFM Delice",
    "ownerName": "Propriétaire",
    "ownerEmail": "owner@kfm-delice.com",
    "ownerPhone": "+224 ...",
    "plan": "pro",
    "restaurantName": "KFM Delice",
    "restaurantSlug": "kfm-delice",
    "adminEmail": "admin@kfm-delice.com",
    "adminPassword": "MotDePasseResto12!",
    "adminName": "Admin Restaurant"
  }' \
  https://votre-domaine.com/api/platform/restaurants/main
```

Cette route crée de façon transactionnelle : `Account` → `Restaurant principal` → `Admin principal` avec tous les champs SaaS (`accountId`, `type=principal`, `canCreateRestaurant=true`, etc.).

#### 5. Activer la 2FA (recommandé)

Pour le PlatformAdmin et les admins restaurant, activez l'authentification à deux facteurs via l'interface admin.

---

## 🔒 Checklist de sécurité pour la production

| Item | Mode démo | Mode prod |
|------|-----------|-----------|
| `ALLOW_AUTO_SEED` | `true` | `false` |
| `NEXT_PUBLIC_SHOW_DEMO_CREDS` | `true` | `false` |
| `ENABLE_PUBLIC_RESTAURANT_REGISTRATION` | `false` | `false` |
| `JWT_SECRET` | quelconque | 64+ chars aléatoires |
| Mots de passe admin | hardcoded | 12+ chars, uniques |
| 2FA sur PlatformAdmin | non | oui |
| HTTPS forcé | auto (Render) | auto (Render) |
| Logs sans secrets | oui | oui |
| Sauvegarde DB | non critique | quotidienne |

---

## 🔄 Passer de démo à production

Si vous démarrez en démo puis voulez passer en production :

1. **Sauvegarder la base** :
   ```bash
   pg_dump $DATABASE_URL > backup_avant_migration.sql
   ```

2. **Changer les mots de passe** de tous les comptes démo (via l'interface admin ou l'API).

3. **Désactiver l'auto-seed** sur Render → Environment → `ALLOW_AUTO_SEED=false`.

4. **Redémarrer** le service Render. La base existante n'est PAS vidée (auto-seed ne s'exécute que sur base vide).

5. **Vérifier** que les comptes démo ne peuvent plus se connecter avec les anciens mots de passe.

6. **Créer un PlatformAdmin** réel via `scripts/create-platform-admin.cjs`.

7. **Supprimer** le PlatformAdmin démo (`admin@restaurantpro.com`) via l'API platform ou SQL direct :
   ```sql
   DELETE FROM "PlatformAdmin" WHERE email = 'admin@restaurantpro.com';
   ```

---

## 📞 Support

Pour toute question sur la configuration démo vs production, consultez :
- `docs/render-deploy-checklist.md` — déploiement Render pas à pas
- `docs/saas-account-rules.md` — règles SaaS (Account, Restaurant, Admin)
- `docs/MIGRATION_POSTGRES.md` — migrations PostgreSQL
