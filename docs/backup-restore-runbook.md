# Backup & Restore Runbook — KFM Delice PostgreSQL

## 📦 Backup automatique (Docker Compose)

Le service `backup` dans `docker-compose.yml` effectue un `pg_dump` quotidien à 2h00 (UTC), avec une rétention de 7 jours.

### Vérifier que le backup tourne

```bash
docker compose logs backup | tail -20
```

### Lister les backups

```bash
ls -lh backups/
# kfm-delice-20260712_020000.sql.gz
# kfm-delice-20260711_020000.sql.gz
```

---

## 📦 Backup manuel

### Option 1 : Docker Compose

```bash
docker compose exec db pg_dump -U kfm_delice kfm_delice | gzip > backups/manual-$(date +%Y%m%d_%H%M%S).sql.gz
```

### Option 2 : Render Dashboard

Render → PostgreSQL resource → **Manual Backup** button.

### Option 3 : Script (VPS sans Docker)

```bash
DATABASE_URL="postgresql://..." bash scripts/backup-postgres.sh
```

---

## 🔄 Restauration

### Étape 1 : Restaurer depuis un backup

```bash
# Décompresser le backup
gunzip < backups/kfm-delice-20260712_020000.sql.gz | docker compose exec -T db psql -U kfm_delice kfm_delice
```

### Étape 2 : Vérifier l'intégrité

```bash
# Compter les restaurants
docker compose exec db psql -U kfm_delice -c 'SELECT COUNT(*) FROM "Restaurant";'

# Compter les commandes
docker compose exec db psql -U kfm_delice -c 'SELECT COUNT(*) FROM "Order";'

# Vérifier les admins
docker compose exec db psql -U kfm_delice -c 'SELECT email, role, status FROM "Admin" LIMIT 10;'
```

### Étape 3 : Tester l'application

```bash
BASE_URL=http://localhost:3000 bash scripts/smoke-render.sh
```

---

## 📊 Métriques

| Métrique | Valeur cible |
|----------|-------------|
| **RPO** (Recovery Point Objective) | 24h (backup quotidien) |
| **RTO** (Recovery Time Objective) | 1h (restauration manuelle) |
| **Rétention** | 7 jours |
| **Fréquence** | Quotidienne à 2h00 UTC |

---

## 📋 Checklist mensuelle de restauration

- [ ] Lister les backups disponibles
- [ ] Restaurer le plus récent sur une base de test
- [ ] Exécuter le smoke test
- [ ] Vérifier les comptes utilisateurs
- [ ] Vérifier les commandes récentes
- [ ] Documenter le temps de restauration
- [ ] Supprimer la base de test

---

## ⚠️ Notes importantes

1. **Render free tier** : les backups automatiques ne sont PAS disponibles sur le free tier PostgreSQL. Utiliser le script `backup-postgres.sh` avec un cron externe.
2. **Production réelle** : activer les backups managés Render (plan payant) OU utiliser le service `backup` de `docker-compose.yml` sur un VPS.
3. **Chiffrement** : les backups `pg_dump` ne sont PAS chiffrés. Stocker dans un emplacement sécurisé.
4. **Test** : une sauvegarde non testée n'est pas une sauvegarde. Faire le test mensuel.
