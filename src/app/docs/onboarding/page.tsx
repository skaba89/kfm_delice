import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guide d'onboarding — KFM Delice",
  description: "Configurez votre restaurant en 5 minutes",
};

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Guide d'onboarding
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Configurez votre restaurant sur KFM Delice en 5 étapes simples.
        </p>

        <div className="space-y-8">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg">1</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Créer votre compte admin</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                Allez sur <a href="/admin/login" className="text-orange-600 hover:underline">la page de connexion admin</a> et utilisez les identifiants de démonstration fournis, ou contactez-nous pour créer un compte personnalisé.
              </p>
              <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-lg p-3 text-sm">
                <p className="text-orange-700 dark:text-orange-400">
                  💡 <strong>Astuce :</strong> Une fois connecté, allez dans les paramètres pour changer votre mot de passe.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg">2</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Configurer votre restaurant</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                Dans l'onglet <strong>Paramètres</strong>, renseignez :
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                <li>Nom du restaurant, tagline, description</li>
                <li>Téléphone, WhatsApp, email</li>
                <li>Adresse, horaires d'ouverture</li>
                <li>Frais de livraison, montant minimum</li>
                <li>Zones de livraison (Kaloum, Dixinn, Matam, Matoto...)</li>
                <li>Couleurs de votre marque (primaire, accent)</li>
              </ul>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg">3</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ajouter votre menu</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                Dans l'onglet <strong>Menu</strong>, créez vos plats :
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                <li>Nom, description, prix (en GNF)</li>
                <li>Catégorie : Entrées, Plats, Fruits de Mer, Desserts, Boissons</li>
                <li>Image du plat (optionnel)</li>
                <li>Badge (Signature, Premium, Végétarien...)</li>
                <li>Marquer comme populaire pour le mettre en avant</li>
              </ul>
              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg p-3 text-sm">
                <p className="text-blue-700 dark:text-blue-400">
                  📸 <strong>Images :</strong> Ajoutez des photos de qualité pour augmenter vos ventes de 30%.
                </p>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg">4</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Générer les QR codes des tables</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                Dans l'onglet <strong>QR Tables</strong> :
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                <li>Définissez le nombre de tables</li>
                <li>Vérifiez l'URL de base (votre domaine)</li>
                <li>Téléchargez les QR codes individuellement ou imprimez-les tous</li>
                <li>Placez un QR code sur chaque table</li>
              </ul>
              <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-3 text-sm">
                <p className="text-green-700 dark:text-green-400">
                  ✅ <strong>Résultat :</strong> Les clients scannent le QR code → voient le menu → commandent → paient. Sans serveur !
                </p>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg">5</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Configurer les paiements (optionnel)</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                Pour accepter les paiements en ligne (Orange Money, MTN, Wave, carte) :
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1 mb-3">
                <li>Contactez Orange Business Guinée pour un compte marchand</li>
                <li>Inscrivez-vous sur <a href="https://momodeveloper.mtn.com" className="text-orange-600 hover:underline">MTN MoMo Developer</a></li>
                <li>Contactez Wave Business pour obtenir votre API key</li>
                <li>Pour les cartes : créez un compte <a href="https://stripe.com" className="text-orange-600 hover:underline">Stripe</a></li>
                <li>Ajoutez les clés API dans les variables d'environnement</li>
              </ul>
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 text-sm">
                <p className="text-amber-700 dark:text-amber-400">
                  ⚡ <strong>Sans paiements en ligne :</strong> Les clients paient en espèces à la table ou à la livraison. Le menu QR code fonctionne quand même !
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 p-6 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Prêt à démarrer ?</h2>
          <p className="text-white/80 mb-4">Connectez-vous et configurez votre restaurant maintenant.</p>
          <a href="/admin/login">
            <button className="bg-white text-orange-600 font-semibold px-8 py-3 rounded-xl hover:bg-gray-100 transition-colors">
              Accéder au dashboard
            </button>
          </a>
        </div>

        {/* Support */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Besoin d'aide ? <a href="/contact" className="text-orange-600 hover:underline">Contactez-nous</a> — nous répondons en moins de 24h.</p>
        </div>
      </div>
    </div>
  );
}
