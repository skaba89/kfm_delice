"use client";

import { motion } from "framer-motion";
import { Check, Star, Zap, Crown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPlanQuotaDefaults } from "@/lib/commercial-plan-catalog";

const freeQuotas = getPlanQuotaDefaults("free");
const starterQuotas = getPlanQuotaDefaults("starter");
const proQuotas = getPlanQuotaDefaults("pro");
const enterpriseQuotas = getPlanQuotaDefaults("enterprise");

const plans = [
  {
    name: "Free",
    icon: Star,
    price: "0",
    period: "gratuit",
    description: "Pour découvrir la plateforme",
    color: "border-gray-300 dark:border-white/10",
    features: [
      `${freeQuotas.maxRestaurants} restaurant`,
      `${freeQuotas.maxAdmins} administrateurs`,
      `${freeQuotas.maxUsers} utilisateurs`,
      "Menu QR code",
      "Commandes en ligne",
      "Réservations",
      "Support email",
    ],
    cta: "Commencer gratuitement",
    href: "/admin/login",
    popular: false,
  },
  {
    name: "Starter",
    icon: Zap,
    price: "50 000",
    period: "GNF/mois",
    description: "Pour les petits restaurants",
    color: "border-blue-300 dark:border-blue-500/30",
    features: [
      `${starterQuotas.maxRestaurants} restaurants`,
      `${starterQuotas.maxAdmins} administrateurs`,
      `${starterQuotas.maxUsers} utilisateurs`,
      "Tout du plan Free",
      "Restaurant secondaire",
      "Factures clients",
      "Programme fidélité",
      "Support WhatsApp",
    ],
    cta: "Choisir Starter",
    href: "/contact",
    popular: false,
  },
  {
    name: "Pro",
    icon: Crown,
    price: "150 000",
    period: "GNF/mois",
    description: "Pour les restaurants établis",
    color: "border-orange-500 dark:border-orange-500/50",
    features: [
      `${proQuotas.maxRestaurants} restaurants`,
      `${proQuotas.maxAdmins} administrateurs`,
      `${proQuotas.maxUsers} utilisateurs`,
      "Tout du plan Starter",
      "Devis & dépenses",
      "Gestion équipe & livreurs",
      "Analytics avancés",
      "Exports CSV/PDF",
      "Support prioritaire",
    ],
    cta: "Choisir Pro",
    href: "/contact",
    popular: true,
  },
  {
    name: "Enterprise",
    icon: Building2,
    price: "500 000",
    period: "GNF/mois",
    description: "Pour les chaînes de restaurants",
    color: "border-purple-300 dark:border-purple-500/30",
    features: [
      `${enterpriseQuotas.maxRestaurants} restaurants`,
      `${enterpriseQuotas.maxAdmins} administrateurs`,
      `${enterpriseQuotas.maxUsers} utilisateurs`,
      "Tout du plan Pro",
      "Gestion multi-restaurants à grande échelle",
      "Quotas entreprise étendus",
      "Paramétrage contractuel sur mesure",
      "Accompagnement au déploiement",
    ],
    cta: "Contacter les ventes",
    href: "/contact",
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30">
            Tarifs transparents
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Choisissez votre plan
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Des prix adaptés au marché guinéen. Des fonctionnalités et quotas clairement définis par offre.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={plan.popular ? "lg:-mt-4" : ""}
            >
              <Card className={`h-full relative ${plan.color} ${plan.popular ? "ring-2 ring-orange-500 shadow-xl" : ""}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-1">
                      ★ Le plus populaire
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                    plan.popular ? "bg-gradient-to-br from-orange-500 to-red-600" : "bg-gray-100 dark:bg-gray-800"
                  }`}>
                    <plan.icon className={`w-5 h-5 ${plan.popular ? "text-white" : "text-gray-600 dark:text-gray-400"}`} />
                  </div>
                  <CardTitle className="text-xl text-gray-900 dark:text-white">{plan.name}</CardTitle>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{plan.description}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                    <span className="text-sm text-gray-500 ml-1">{plan.period}</span>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a href={plan.href}>
                    <Button
                      className={`w-full rounded-xl ${
                        plan.popular
                          ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                    >
                      {plan.cta}
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            Questions fréquentes
          </h2>
          <div className="space-y-4">
            {[
              { q: "Puis-je changer de plan ?", a: "Oui. Les droits et quotas du nouveau plan prennent effet dès la modification du compte. Les modalités commerciales sont définies dans votre offre ou contrat." },
              { q: "Comment régler l'abonnement ?", a: "Les modalités de règlement sont précisées lors de la souscription en fonction de l'offre et du contrat retenus." },
              { q: "Y a-t-il des frais d'installation ?", a: "L'onboarding est guidé. Les éventuels services d'accompagnement spécifiques sont précisés dans l'offre commerciale." },
              { q: "Puis-je essayer gratuitement ?", a: "Le catalogue propose un plan Free. Les essais des offres payantes sont activés selon les conditions commerciales applicables à votre compte." },
              { q: "Que se passe-t-il si je dépasse mon quota ?", a: "Le compte passe en statut 'over_quota' lorsque les limites applicables sont dépassées. Les créations concernées restent bloquées jusqu'à régularisation ou upgrade." },
              { q: "Mes données sont-elles sécurisées ?", a: "La plateforme applique notamment bcrypt, 2FA TOTP pour les admins, HTTPS/TLS, audit logs et des contrôles de sécurité automatisés." },
            ].map((faq, i) => (
              <Card key={i} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-white/10">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{faq.q}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Encore une question ?
          </h2>
          <a href="/contact">
            <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl px-8 py-6">
              Contactez-nous
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
