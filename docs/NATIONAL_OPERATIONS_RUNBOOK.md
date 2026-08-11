# KFM Delice — Runbook d’exploitation nationale

Ce document décrit les garde-fous minimums avant de passer KFM Delice d’un pilote `single-instance` à une exploitation commerciale multi-instance/nationale.

## 1. États de déploiement

### Pilote contrôlé

- `APP_MODE=production`
- `SCALE_MODE=single-instance`
- `REALTIME_MODE=disabled`
- PostgreSQL obligatoire
- migrations Prisma bloquantes au démarrage
- `/api/ready` doit être vert avant ouverture du service
- le rate limiter mémoire d’urgence reste acceptable uniquement tant qu’une seule instance applicative sert le trafic

### National / multi-instance

Avant de modifier `SCALE_MODE`, configurer et vérifier :

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_DSN`
- `PUBLIC_APP_URL=https://...`
- `REALTIME_MODE=disabled` tant qu’un adaptateur temps réel distribué et tenant-scopé n’est pas livré
- une offre d’hébergement et de base dimensionnée pour la charge cible ; le Blueprint `free` est un profil pilote, pas la cible nationale
- sauvegardes fournisseur et procédure de restauration testée

Ensuite seulement, définir `SCALE_MODE=national` (ou `multi-instance`). `scripts/check-production-safety.cjs` refuse le démarrage si les prérequis applicatifs ne sont pas présents.

## 2. Secrets GitHub de déploiement

Production :

- `RENDER_DEPLOY_HOOK_URL` — hook du service production
- `RENDER_PUBLIC_BASE_URL` — URL publique HTTPS du service production
- `SMOKE_RESTAURANT_SLUG` — slug d’un restaurant de smoke read-only

Staging :

- `RENDER_STAGING_DEPLOY_HOOK_URL`
- `RENDER_STAGING_BASE_URL`

Le workflow `.github/workflows/deploy.yml` envoie le SHA exact validé par CI au deploy hook Render. Si une base URL est configurée, il attend que `/api/status` expose le même `RENDER_GIT_COMMIT`, puis exécute `scripts/post-deploy-smoke.py`.

## 3. Garde avant déploiement

Un changement ne doit pas être déployé si l’un des contrôles suivants est rouge :

1. TypeScript / lint / build.
2. Tests unitaires SQLite.
3. Migrations PostgreSQL `prisma migrate deploy` sans fallback.
4. Régression P3009 historique.
5. Vérification de schéma runtime.
6. Seed CI contrôlé et vérifié.
7. E2E production-contract.
8. Playwright.
9. Security Scan (audit dépendances, secrets, analyse statique, scan vulnérabilités).

Les migrations appliquées ne doivent jamais être réécrites. Toute correction de schéma est forward-only.

## 4. Sauvegarde opérateur

Le script `scripts/backup-postgres.sh` produit un dump PostgreSQL custom-format, vérifie son catalogue avec `pg_restore --list` et génère un SHA-256. Il ne supprime automatiquement aucun ancien backup.

Exemple :

```bash
DATABASE_URL='postgresql://...' \
BACKUP_LABEL='pre-release-2026-08' \
BACKUP_DIR='./backups' \
./scripts/backup-postgres.sh
```

Conserver le `.dump`, son `.sha256` et son `.list.txt` hors de la machine applicative, selon la politique de rétention de l’entreprise.

Un dump logique complète les sauvegardes/snapshots du fournisseur ; il ne les remplace pas.

## 5. Restauration / disaster recovery

Ne pas restaurer directement par-dessus une production active.

Procédure :

1. Créer une base PostgreSQL de remplacement vide.
2. Identifier le backup et vérifier son manifeste SHA-256.
3. Restaurer dans la base de remplacement :

```bash
RESTORE_DATABASE_URL='postgresql://...replacement...' \
CONFIRM_RESTORE='RESTORE_TO_EMPTY_DATABASE' \
./scripts/restore-postgres.sh backups/kfm-delice_xxx.dump
```

4. Exécuter la vérification de schéma read-only.
5. Démarrer une instance applicative de validation sur la base restaurée.
6. Exécuter `/api/ready` puis le smoke read-only.
7. Vérifier les volumes critiques : Restaurant, Admin, Customer, Order, MenuItem, Payment.
8. Basculer la configuration/traffic uniquement après validation.
9. Conserver l’ancienne base intacte jusqu’à clôture de l’incident.

## 6. Smoke post-déploiement

Exécution manuelle :

```bash
BASE_URL='https://...' \
EXPECTED_COMMIT='<git-sha>' \
SMOKE_RESTAURANT_SLUG='kfm-delice' \
python3 scripts/post-deploy-smoke.py
```

Le smoke est strictement read-only et contrôle :

- `/api/status`
- le SHA de release attendu lorsqu’il est fourni
- `/api/ready` : DB connectée + schéma compatible
- la résolution d’un tenant si un slug de smoke est fourni
- le menu public du tenant

## 7. Rollback applicatif

Si le smoke échoue après déploiement :

1. Ne pas contourner `/api/ready` ou les migrations.
2. Identifier le dernier SHA connu sain dans GitHub.
3. Déployer explicitement ce SHA via le hook Render avec `ref=<sha>`.
4. Attendre que `/api/status.release` corresponde au SHA de rollback.
5. Rejouer le smoke read-only.
6. Si le problème concerne une migration déjà appliquée, ne pas modifier l’ancienne migration : produire une migration corrective forward-only ou restaurer vers une base de remplacement selon l’incident.
7. Documenter l’incident et les actions dans l’audit/runbook de l’équipe.

## 8. Temps réel

Le serveur WebSocket local historique est volontairement désactivé en production. Il est process-local et n’est pas une garantie correcte de diffusion multi-instance/tenant.

Jusqu’à livraison d’un adaptateur distribué :

- utiliser l’état persistant API et le polling déjà disponible dans les écrans ;
- ne pas activer `REALTIME_MODE=local` en production ;
- ne pas exposer le port WebSocket local.

Un futur temps réel national devra authentifier la connexion, inclure `restaurantId` dans le canal, et utiliser un bus partagé entre instances.

## 9. Critères avant ouverture nationale

L’ouverture nationale n’est autorisée que lorsque :

- `main` est vert sur CI et Security Scan ;
- le déploiement exact est vert au smoke post-déploiement ;
- `SCALE_MODE=national` passe le production-safety check ;
- l’hébergement n’est plus dimensionné comme un pilote gratuit ;
- une restauration complète a été testée sur une base de remplacement ;
- les alertes Sentry sont actives et routées vers l’équipe ;
- la capacité et la saturation sont mesurées avant augmentation du trafic ;
- les comptes/tenants suspendus sont effectivement bloqués par le backend ;
- les quotas vendus correspondent à des règles backend réellement appliquées.
