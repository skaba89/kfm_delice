# 📚 Guide Utilisateur — KFM Delice

Guide complet pour les restaurateurs utilisant la plateforme KFM Delice.

---

## 🚀 Démarrage rapide

### 1. Connexion
- **URL admin** : `https://kfm-delice-ggb4.onrender.com/admin/login`
- **URL platform admin** : `https://kfm-delice-ggb4.onrender.com/platform`
- **Comptes de démonstration** :
  - Admin restaurant : `admin@kfm-delice.com` / `kfm2024`
  - Platform admin : `admin@restaurantpro.com` / `platform2024`
  - Manager : `manager@kfm-delice.com` / `manager2024`
  - Staff : `staff@kfm-delice.com` / `staff2024`

### 2. Premier démarrage
1. Le premier login demande de changer le mot de passe
2. Allez dans **Paramètres → Général** pour configurer le nom, adresse, téléphone
3. Allez dans **Menu** pour ajouter vos plats
4. Allez dans **QR Tables** pour générer les QR codes de vos tables

---

## 🏪 Gestion du restaurant

### Menu
- **Ajouter un plat** : onglet Menu → bouton "Ajouter"
- **Catégories** : Entrées, Plats, Desserts, Boissons, etc.
- **Badges** : "Populaire", "Nouveau", "Végétarien"
- **Disponibilité** : désactivez un plat temporairement sans le supprimer

### Commandes
- **Types** : Sur place (dine-in), À emporter, Livraison
- **Statuts** : En attente → En préparation → Prête → Livrée
- **Filtres** : par statut, type, table, date
- **Export PDF** : bouton "Journal PDF" pour exporter les commandes du jour
- **Export CSV** : bouton "Exporter CSV" pour Excel

### Pourboires (tips)
- Les clients peuvent laisser un pourboire au checkout
- 4 options : Aucun, 5%, 10%, 15%, ou montant libre
- Le pourboire est validé serveur (max 50% du total)
- Affiché séparément sur la facture PDF et le dashboard

### Codes promo
- **Créer un code** : onglet Paramètres → section dédiée (à venir)
- **Types de remise** : pourcentage (ex: 10%) ou montant fixe (ex: 5000 GNF)
- **Limites** : minimum de commande, nombre d'usages max, par utilisateur
- **Validation** : le client saisit le code au checkout, la remise s'applique automatiquement

### Réservations
- Gestion par zones (intérieur, terrasse, VIP)
- Statuts : en attente, confirmée, annulée
- Points de fidélité attribués automatiquement

---

## 🍳 Cuisine

### Écran cuisine (Kitchen Display)
- **URL** : `https://kfm-delice-ggb4.onrender.com/kitchen`
- Affiche les commandes en temps réel (polling 5s)
- 3 colonnes : En attente → En préparation → Prêtes
- Boutons d'action : Démarrer, Prêt, Annuler, Repriser

### Notifications sonores
- **Configuration** : Paramètres → Notifications sonores
- 4 sons configurables séparément :
  - Nouvelle commande (bip urgent)
  - Commande prête (carillon)
  - Changement de statut (clic discret)
  - Alerte temps écoulé (bips descendants — > 20 min)
- Volume réglable (0-100%)
- Préférences par appareil (la tablette cuisine et le laptop du manager peuvent avoir des réglages différents)
- **Note** : les navigateurs bloquent le son jusqu'au premier clic sur la page

### Mode hors-ligne
- Si le réseau coupe, la cuisine continue de fonctionner
- Les mises à jour de statut sont mises en file locale
- Bannière "Mode hors-ligne" affichée avec le nombre de mises à jour en attente
- Synchronisation automatique au retour du réseau
- La file persiste en localStorage (survit aux rechargements)

---

## 💬 Chat interne

### Utilisation
- Onglet **Chat interne** dans le dashboard
- Messagerie entre tous les membres de l'équipe du restaurant
- Messages en temps réel (polling 5s)
- Couleurs par rôle (admin=orange, manager=bleu, cuisine=rouge, etc.)
- Max 1000 caractères par message
- Sanitization HTML automatique (anti-XSS)

### Bonnes pratiques
- Utilisez le chat pour coordonner la cuisine et la salle
- Exemples : "Table 5 demande l'addition", "Le plat du jour est épuisé"
- Les messages sont stockés en base (historique complet)

---

## 🏆 Programme fidélité

### Paliers configurables
- **Configuration** : Paramètres → Paliers Fidélité
- 4 paliers par défaut :
  - 🥉 Bronze : 0 GNF — pas de remise
  - 🥈 Argent : 500 000 GNF — 5% de remise
  - 🥇 Or : 2 000 000 GNF — 10% + livraison gratuite
  - 💎 Platine : 5 000 000 GNF — 15% + livraison + plat gratuit/mois

### Personnalisation
- Modifiez les seuils, remises, couleurs, icônes
- Activez/désactivez des paliers
- Les clients sont promus automatiquement selon leurs dépenses cumulées
- La promotion se déclenche à la livraison d'une commande

---

## 📱 QR Codes des tables

### Génération
- Onglet **QR Tables** → bouton "Nouvelle table"
- Saisissez : nom, numéro, capacité, zone
- Le QR code est généré automatiquement

### Impression
- Bouton "Imprimer" pour une fiche A6 paysage
- Bouton "Télécharger PNG" pour l'image
- Format optimisé : QR à gauche, infos à droite

### Rotation du QR
- Bouton "Régénérer" pour invalider l'ancien QR
- L'ancien QR devient immédiatement invalide
- Le nouveau QR est disponible instantanément

### Parcours client
1. Le client scanne le QR code sur la table
2. Il arrive sur `https://URL/q/<token>`
3. Redirection automatique vers `/r/<restaurant>/menu?tableToken=<id>`
4. Le menu du bon restaurant s'affiche avec la bannière "Table T04 — Terrasse"
5. Le client ajoute des plats, commande
6. La cuisine reçoit la commande avec le numéro de table

---

## ⌨️ Raccourcis clavier

| Touche | Action |
|---|---|
| `1-9` | Aller à l'onglet N (1=Vue d'ensemble, 2=Réservations, ...) |
| `R` | Rafraîchir les données |
| `/` | Focus le champ de recherche |
| `N` | Nouvelle action (commande, plat, réservation) |
| `?` | Afficher l'aide des raccourcis |
| `Esc` | Fermer les dialogues |

Les raccourcis sont désactivés quand vous tapez dans un champ de formulaire.

---

## 👥 Rôles et permissions

| Rôle | Accès |
|---|---|
| **Admin** | Tout — y compris gestion des utilisateurs |
| **Manager** | Tout sauf gestion des admins |
| **Staff** | Commandes, réservations, cuisine, tables |
| **Cashier** | Commandes, clients, factures, tables, POS |
| **Kitchen** | Commandes, cuisine, stock, tables |
| **Delivery Manager** | Commandes, livreurs, livraisons |
| **Host** | Réservations, commandes (lecture), tables |
| **Accountant** | Factures, dépenses, devis, analytics, stats |

---

## 🔧 Paramètres

### Sections disponibles
1. **Général** — nom, description, devise
2. **Contact** — téléphone, WhatsApp, email
3. **Adresse & GPS** — adresse, latitude, longitude
4. **Horaires & Salle** — heures d'ouverture, nombre de tables
5. **Logo & Couleurs** — branding personnalisé
6. **Livraison** — frais, minimum, zones, rayon
7. **Facturation** — taux de taxe
8. **Réseaux sociaux** — Facebook, Instagram, Twitter
9. **Notifications sonores** — configuration par appareil
10. **Paliers Fidélité** — configuration des paliers
11. **Rôles & Privilèges** (admin only) — matrice des permissions

---

## 🔒 Sécurité

### Mots de passe
- **Production** : minimum 12 caractères + majuscule + minuscule + chiffre + spécial
- **Développement** : minimum 6 caractères
- Changement forcé au premier login

### Verrouillage de compte
- Après 5 tentatives échouées (clients) ou 10 (admins)
- Verrouillage pendant 30 minutes
- L'admin peut déverrouiller manuellement

### 2FA (Platform Admin)
- Authentification à deux facteurs TOTP
- Codes de sauvegarde générés
- Configurable dans `/platform`

---

## 🌐 URL par restaurant

Chaque restaurant a sa propre URL basée sur son nom (slug) :
- Restaurant "Le Baobab" → `/r/le-baobab/menu`
- Restaurant "Café de la Gare" → `/r/cafe-de-la-gare/menu`

Le slug est généré automatiquement à partir du nom (minuscules, sans accents, tirets). L'administrateur peut le personnaliser lors de la création.

---

## 📊 Exports

| Type | Format | Contenu |
|---|---|---|
| Commandes | CSV | Toutes les commandes avec filtres date |
| Commandes | PDF | Journal du jour imprimable |
| Clients | CSV | Liste des clients |
| Factures | CSV | Liste des factures |
| Menu | CSV | Tous les plats |
| Réservations | CSV | Toutes les réservations |
| Comptes | CSV | Comptes SaaS (platform admin) |

---

## ❓ FAQ

### Le son ne fonctionne pas
Les navigateurs bloquent le son jusqu'au premier clic. Cliquez n'importe où sur le dashboard, puis activez le son dans Paramètres → Notifications sonores.

### Le QR code ne marche pas
Vérifiez que :
1. La table est active (bouton vert)
2. Le QR est activé (toggle qrEnabled)
3. Le restaurant est actif (status = active)
4. Le QR n'a pas été roté (régénéré)

### Une commande n'apparaît pas en cuisine
Vérifiez que :
1. Le statut est "pending" ou "preparing"
2. L'onglet cuisine est rafraîchi (polling 5s)
3. Le filtre n'exclut pas la commande

### Le mode hors-ligne ne se déclenche pas
Le mode hors-ligne se déclenche uniquement quand le navigateur détecte une coupure réseau (event `offline`). Si votre connexion est instable mais pas totalement coupée, le mode peut ne pas s'activer.

---

## 📞 Support

- **WhatsApp** : bouton contact sur la page d'accueil
- **Email** : contact@kfm-delice.com
- **Documentation** : ce guide + README.md dans le dépôt
