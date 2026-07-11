import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — KFM Delice",
  description: "Mentions légales KFM Delice",
};

export default function MentionsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Mentions Légales</h1>
        <div className="prose prose-gray dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Éditeur du site</h2>
            <p><strong>KFM Delice</strong><br />
            SARL au capital de 10 000 000 GNF<br />
            Siège social : Almamya, Corniche Nord, Conakry, République de Guinée<br />
            Tél : +224 622 34 56 78<br />
            Email : contact@kfm-delice.com</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Directeur de la publication</h2>
            <p>Le directeur de la publication est le gérant de KFM Delice.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Hébergement</h2>
            <p>Le site est hébergé par :</p>
            <p>Render Inc. (ou serveur VPS selon déploiement)<br />
            San Francisco, CA 94107, USA<br />
            <a href="https://render.com" className="text-orange-600 hover:underline">https://render.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Propriété intellectuelle</h2>
            <p>L'ensemble des contenus présents sur ce site (textes, images, logos, design) est la propriété de KFM Delice, sauf mention contraire. Toute reproduction sans autorisation écrite préalable est interdite.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Contact</h2>
            <p>Pour toute question : <a href="mailto:contact@kfm-delice.com" className="text-orange-600 hover:underline">contact@kfm-delice.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
