import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CGV — KFM Delice",
  description: "Conditions Générales de Vente KFM Delice",
};

export default function CGVPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Conditions Générales de Vente
        </h1>
        <div className="prose prose-gray dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">
          <p className="text-sm text-gray-500">Dernière mise à jour : {new Date().getFullYear()}</p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Article 1 — Objet</h2>
            <p>Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles entre KFM Delice (ci-après "le Restaurant") et tout utilisateur de la plateforme (ci-après "le Client") pour la passation de commandes, réservations et abonnements SaaS.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Article 2 — Commandes</h2>
            <p>Le Client passe commande via le menu digital (QR code en table ou site web). La commande est confirmée après réception par le Restaurant. Le Restaurant se réserve le droit de refuser une commande pour indisponibilité ou motif légitime.</p>
            <p className="mt-2">Les prix sont indiqués en GNF (Franc Guinéen) toutes taxes comprises.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Article 3 — Paiement</h2>
            <p>Le Client peut payer par :</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Espèces (à la table ou à la livraison)</li>
              <li>Orange Money</li>
              <li>MTN Mobile Money</li>
              <li>Wave</li>
              <li>Carte bancaire (Visa/Mastercard via Stripe)</li>
            </ul>
            <p className="mt-2">Le paiement est exigible à la commande pour les commandes en ligne, et à la consommation pour les commandes en table.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Article 4 — Livraison</h2>
            <p>Les commandes en livraison sont assurées dans les zones desservies (Kaloum, Dixinn, Matam, Matoto). Le délai estimé est communiqué au Client lors de la commande. Les retards dus au trafic ou à des circonstances exceptionnelles ne donnent pas droit à indemnisation.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Article 5 — Réservations</h2>
            <p>Les réservations de table sont confirmées par le Restaurant. Une table est maintenue 15 minutes après l'heure prévue. Au-delà, la réservation peut être annulée.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Article 6 — Abonnements SaaS</h2>
            <p>La plateforme KFM Delice propose des abonnements pour les restaurants partenaires :</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Free :</strong> 1 restaurant, 2 admins, gratuit</li>
              <li><strong>Starter :</strong> 2 restaurants, 5 admins, 50 000 GNF/mois</li>
              <li><strong>Pro :</strong> 5 restaurants, 15 admins, 150 000 GNF/mois</li>
              <li><strong>Enterprise :</strong> 20 restaurants, 50 admins, 500 000 GNF/mois</li>
            </ul>
            <p className="mt-2">Les abonnements sont facturés mensuellement. L'annulation prend effet en fin de période de facturation. Aucun remboursement n'est dû pour la période en cours.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Article 7 — Rétractation</h2>
            <p>Pour les abonnements SaaS, le Client dispose d'un délai de 14 jours pour se rétracter, sans justification. Pour les commandes de restauration (consommation immédiate), le droit de rétractation ne s'applique pas.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Article 8 — Responsabilité</h2>
            <p>Le Restaurant s'engage à fournir un service de qualité. La responsabilité du Restaurant ne peut être engagée en cas de :</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Indisponibilité temporaire du service (maintenance, panne)</li>
              <li>Force majeure</li>
              <li>Erreur de saisie par le Client</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Article 9 — Données personnelles</h2>
            <p>Le traitement des données personnelles est régi par notre <a href="/legal/privacy" className="text-orange-600 hover:underline">Politique de Confidentialité</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Article 10 — Droit applicable</h2>
            <p>Les présentes CGV sont soumises au droit guinéen. Tout litige relèvera de la compétence des tribunaux de Conakry.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Article 11 — Contact</h2>
            <p>KFM Delice — Almamya, Corniche Nord, Conakry, Guinée<br />
            Tél : +224 622 34 56 78 — Email : <a href="mailto:contact@kfm-delice.com" className="text-orange-600 hover:underline">contact@kfm-delice.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
