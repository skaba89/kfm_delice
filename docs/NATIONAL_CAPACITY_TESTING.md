# KFM Delice — Baseline de capacité nationale

Ce document décrit un test de capacité **read-only** à exécuter sur un environnement de staging/préproduction dimensionné comme la cible. Il ne remplace pas une campagne de performance complète et ne doit pas être pointé vers un service tiers ou une production sans fenêtre opératoire approuvée. La CI de cette branche est rejouée sur le `main` commercial courant afin de valider les garde-fous de capacité avec les règles SaaS et la frontière Proxy sécurisée actives.

## Objectifs

Mesurer de façon répétable :

- débit global en requêtes/seconde ;
- latences moyenne, p50, p95 et p99 ;
- taux d’erreur ;
- comportement de `/api/status`, `/api/ready` et du menu public d’un tenant ;
- effet d’une augmentation progressive de concurrence avant changement de capacité.

## Prérequis

- URL HTTPS de staging ;
- base PostgreSQL de staging représentative ;
- un slug de restaurant de test ;
- configuration Upstash si `SCALE_MODE=multi-instance` ou `national` ;
- observabilité active pour rapprocher les résultats client des erreurs serveur/DB ;
- aucune donnée sensible dans les sorties du test.

## Exécution

Exemple de baseline légère :

```bash
BASE_URL='https://staging.example.com' \
RESTAURANT_SLUG='restaurant-smoke' \
LOAD_REQUESTS=300 \
LOAD_CONCURRENCY=15 \
LOAD_P95_MAX_MS=1500 \
LOAD_ERROR_RATE_MAX=0.01 \
python3 scripts/load-readonly.py
```

Le script n’envoie que des requêtes GET. Il échoue si le taux d’erreur ou le p95 dépassent les seuils fournis.

## Escalier de charge recommandé

Exécuter plusieurs paliers avec la même version et le même dataset, par exemple :

1. 5 workers / 200 requêtes — smoke de capacité.
2. 15 workers / 500 requêtes — charge nominale initiale.
3. 30 workers / 1 000 requêtes — marge de pointe.
4. Augmenter ensuite uniquement si les seuils, la base et l’observabilité restent sains.

Les valeurs ne constituent pas une promesse de capacité nationale : elles servent à identifier le point de saturation de l’infrastructure réellement provisionnée.

## Résultat à archiver

Pour chaque campagne conserver :

- SHA Git testé ;
- date/heure UTC ;
- taille/type des instances applicatives et PostgreSQL ;
- nombre d’instances ;
- volume approximatif des tables critiques ;
- paramètres du test ;
- débit, p50/p95/p99, taux d’erreur ;
- CPU/mémoire/connexions DB observés côté hébergeur ;
- erreurs Sentry durant la fenêtre ;
- décision : capacité suffisante, scaling requis ou investigation.

## Critères de passage avant montée de trafic

Ne pas augmenter le trafic si :

- `/api/ready` devient instable ;
- le taux d’erreur dépasse le seuil contractuel choisi ;
- la latence p95 dépasse le SLO défini pour le parcours ;
- les connexions DB approchent de la saturation ;
- des erreurs de transaction/idempotence apparaissent ;
- le rate limiter distribué n’est pas configuré pour plusieurs instances ;
- la restauration/rollback de la version testée n’est pas maîtrisée.

Une campagne de charge complète devra ensuite ajouter les parcours d’écriture contrôlés (commande/paiement) sur une base jetable ou isolée, avec nettoyage et vérifications comptables. Le script fourni ici reste volontairement non destructif.
