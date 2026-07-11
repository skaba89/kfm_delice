import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — KFM Delice",
  description: "Politique de protection des données personnelles KFM Delice",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Politique de Confidentialité
        </h1>
        <div className="prose prose-gray dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">
          <p className="text-sm text-gray-500">Dernière mise à jour : {new Date().getFullYear()}</p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">1. Responsable du traitement</h2>
            <p>KFM Delice, dont le siège social est situé à Almamya, Corniche Nord, Conakry, Guinée, est responsable du traitement des données personnelles collectées sur la plateforme.</p>
            <p className="mt-2">Contact : <a href="mailto:contact@kfm-delice.com" className="text-orange-600 hover:underline">contact@kfm-delice.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2. Données collectées</h2>
            <p>Nous collectons les données suivantes :</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Comptes administrateurs :</strong> nom, email, mot de passe (haché), rôle</li>
              <li><strong>Comptes clients :</strong> nom, email, téléphone, adresse, points de fidélité</li>
              <li><strong>Commandes :</strong> plats commandés, montant, mode de paiement, numéro de table</li>
              <li><strong>Réservations :</strong> nom, téléphone, date, heure, nombre de personnes</li>
              <li><strong>Données techniques :</strong> adresse IP, navigateur, logs d'audit</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3. Finalités du traitement</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Gestion des commandes et réservations</li>
              <li>Gestion du programme de fidélité</li>
              <li>Communication avec les clients (notifications de commande)</li>
              <li>Sécurité et prévention de la fraude (audit logs)</li>
              <li>Amélioration du service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">4. Base légale</h2>
            <p>Le traitement est basé sur :</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>L'exécution d'un contrat (commandes, réservations)</li>
              <li>Le consentement de l'utilisateur (compte client, newsletters)</li>
              <li>L'intérêt légitime (sécurité, audit logs)</li>
              <li>L'obligation légale (factures, comptabilité)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5. Durée de conservation</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Comptes actifs :</strong> jusqu'à suppression par l'utilisateur</li>
              <li><strong>Commandes et factures :</strong> 10 ans (obligation comptable)</li>
              <li><strong>Logs d'audit :</strong> 1 an</li>
              <li><strong>Comptes inactifs :</strong> supprimés après 3 ans d'inactivité</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">6. Vos droits</h2>
            <p>Conformément à la loi guinéenne et au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Droit d'accès :</strong> obtenir une copie de vos données</li>
              <li><strong>Droit de rectification :</strong> corriger des données inexactes</li>
              <li><strong>Droit à l'effacement :</strong> demander la suppression de vos données</li>
              <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
              <li><strong>Droit d'opposition :</strong> vous opposer au traitement</li>
              <li><strong>Droit de retirer votre consentement</strong> à tout moment</li>
            </ul>
            <p className="mt-2">Pour exercer ces droits, contactez-nous : <a href="mailto:contact@kfm-delice.com" className="text-orange-600 hover:underline">contact@kfm-delice.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7. Sécurité</h2>
            <p>Nous mettons en œuvre les mesures techniques suivantes :</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Chiffrement des mots de passe (bcrypt)</li>
              <li>Authentification à deux facteurs (2FA) pour les comptes admin</li>
              <li>Connexion HTTPS/TLS sur toutes les pages</li>
              <li>Logs d'audit pour toutes les actions sensibles</li>
              <li>Rate limiting pour prévenir les attaques par force brute</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">8. Partage des données</h2>
            <p>Vos données ne sont JAMAIS vendues à des tiers. Elles peuvent être partagées avec :</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Providers de paiement (Orange Money, MTN, Wave, Stripe) — uniquement les données nécessaires à la transaction</li>
              <li>Provider d'email (SMTP) — pour les notifications de commande</li>
              <li>Autorités légales — sur requête judiciaire</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">9. Cookies</h2>
            <p>Nous utilisons uniquement des cookies essentiels au fonctionnement (session d'authentification, préférence de langue). Aucun cookie publicitaire ou de tracking.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">10. Contact</h2>
            <p>Pour toute question relative à cette politique : <a href="mailto:contact@kfm-delice.com" className="text-orange-600 hover:underline">contact@kfm-delice.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
