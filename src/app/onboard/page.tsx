"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  ChefHat,
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  Globe,
  ArrowRight,
  Loader2,
  Check,
  Sparkles,
} from "lucide-react";

const PLANS = [
  {
    id: "free",
    name: "Gratuit",
    price: "0 GNF",
    period: "/mois",
    description: "Pour démarrer votre activité",
    features: [
      "Menu digital",
      "Commandes en ligne",
      "Réservations",
      "Avis clients",
      "Point de vente (POS)",
      "1 utilisateur admin",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "50 000 GNF",
    period: "/mois",
    description: "Pour les restaurants en croissance",
    features: [
      "Tout du plan Gratuit",
      "Programme fidélité",
      "Factures",
      "Jusqu'à 3 utilisateurs",
      "Support prioritaire",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "150 000 GNF",
    period: "/mois",
    description: "Pour les restaurants établis",
    popular: true,
    features: [
      "Tout du plan Starter",
      "Devis & dépenses",
      "Gestion du personnel",
      "Gestion livreurs",
      "Jusqu'à 10 utilisateurs",
      "Analytics avancés",
    ],
  },
  {
    id: "enterprise",
    name: "Entreprise",
    price: "Sur mesure",
    period: "",
    description: "Pour les chaînes & franchises",
    features: [
      "Tout du plan Pro",
      "Domaine personnalisé",
      "Accès API",
      "Marque blanche",
      "Utilisateurs illimités",
      "Support dédié",
    ],
  },
];

export default function OnboardPage() {
  const router = useRouter();
  const { loginAdmin } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [form, setForm] = useState({
    restaurantName: "",
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    ownerPhone: "",
    currency: "GNF",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/register-restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantName: form.restaurantName,
          phone: form.phone,
          whatsapp: form.whatsapp || form.phone,
          email: form.email,
          address: form.address,
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          ownerPassword: form.ownerPassword,
          ownerPhone: form.ownerPhone,
          currency: form.currency,
          plan: selectedPlan,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription");
        return;
      }

      // Log in the new admin
      loginAdmin({
        token: data.token,
        id: data.admin.id,
        email: data.admin.email,
        name: data.admin.name,
        role: data.admin.role,
      });

      // Redirect to admin dashboard
      router.push("/admin");
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="w-8 h-8 text-orange-600" />
            <span className="text-xl font-bold text-gray-900">RestaurantPro</span>
          </div>
          <p className="text-sm text-gray-500">
            Déjà inscrit ?{" "}
            <a href="/admin/login" className="text-orange-600 hover:underline font-medium">
              Se connecter
            </a>
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Progress */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step >= s
                    ? "bg-orange-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step > s ? <Check className="w-5 h-5" /> : s}
              </div>
              <span className={`text-sm ${step >= s ? "text-orange-600 font-medium" : "text-gray-400"}`}>
                {s === 1 ? "Restaurant" : s === 2 ? "Compte" : "Forfait"}
              </span>
              {s < 3 && <div className={`w-16 h-0.5 ${step > s ? "bg-orange-600" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Step 1: Restaurant Info */}
        {step === 1 && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Créez votre restaurant
            </h2>
            <p className="text-gray-500 text-center mb-8">
              Commencez par renseigner les informations de votre restaurant
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du restaurant *
                </label>
                <div className="relative">
                  <ChefHat className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="restaurantName"
                    value={form.restaurantName}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Mon Restaurant"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="+224 622 00 00 00"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    name="whatsapp"
                    value={form.whatsapp}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Même que téléphone"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email du restaurant
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="contact@monrestaurant.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Conakry, Guinée"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Devise
                </label>
                <select
                  name="currency"
                  value={form.currency}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="GNF">GNF - Franc guinéen</option>
                  <option value="XOF">XOF - Franc CFA</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="USD">USD - Dollar américain</option>
                </select>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!form.restaurantName || !form.phone}
                className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuer <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Owner Account */}
        {step === 2 && (
          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Votre compte administrateur
            </h2>
            <p className="text-gray-500 text-center mb-8">
              Créez votre compte pour gérer votre restaurant
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Votre nom complet *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="ownerName"
                    value={form.ownerName}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Amadou Diallo"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Votre email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="ownerEmail"
                    value={form.ownerEmail}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="amadou@email.com"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe * (min 6 caractères)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    name="ownerPassword"
                    value={form.ownerPassword}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="••••••"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Votre téléphone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    name="ownerPhone"
                    value={form.ownerPhone}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="+224 622 00 00 00"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Retour
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!form.ownerName || !form.ownerEmail || !form.ownerPassword || form.ownerPassword.length < 6}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuer <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Plan Selection */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Choisissez votre forfait
            </h2>
            <p className="text-gray-500 text-center mb-8">
              14 jours d&apos;essai gratuit pour tous les forfaits
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                    selectedPlan === plan.id
                      ? "border-orange-600 bg-orange-50 shadow-lg"
                      : "border-gray-200 bg-white hover:border-orange-300"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Populaire
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-orange-600">{plan.price}</span>
                    <span className="text-gray-400 text-sm">{plan.period}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{plan.description}</p>
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  {selectedPlan === plan.id && (
                    <div className="mt-4 text-center">
                      <span className="inline-block px-4 py-1 bg-orange-600 text-white text-sm font-medium rounded-full">
                        Sélectionné
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-4 max-w-lg mx-auto">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Retour
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Création...
                  </>
                ) : (
                  <>
                    Créer mon restaurant <Sparkles className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>RestaurantPro — Plateforme SaaS de gestion pour restaurants</p>
          <p className="mt-1">Essai gratuit 14 jours • Annulation à tout moment</p>
        </div>
      </footer>
    </div>
  );
}
