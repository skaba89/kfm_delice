"use client";

import { useEffect, useMemo, useState } from "react";
import { getPlanMonthlyPriceGnf, type CommercialPlan } from "@/lib/commercial-plan-catalog";
import {
  ArrowRight,
  Check,
  ChefHat,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

interface PublicRegistrationSettings {
  enabled: boolean;
  trialPlan: "starter" | "pro";
  trialDays: number;
  verificationRequired: boolean;
}

const PLAN_LABELS = { starter: "Starter", pro: "Pro" } as const;
const TRIAL_FEATURES = {
  starter: [
    "Menu digital et commandes en ligne",
    "Réservations et avis clients",
    "Point de vente (POS)",
    "Programme fidélité",
    "Factures",
  ],
  pro: [
    "Tout le plan Starter",
    "Devis et dépenses",
    "Gestion du personnel et des livreurs",
    "Analytics avancés",
    "Exports",
  ],
} as const;

export default function OnboardPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settings, setSettings] = useState<PublicRegistrationSettings | null>(null);
  const [error, setError] = useState("");
  const [verificationSentTo, setVerificationSentTo] = useState("");
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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/register-restaurant", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("registration settings unavailable");
        return response.json() as Promise<PublicRegistrationSettings>;
      })
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger la configuration d'inscription.");
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const trialPrice = useMemo(() => {
    if (!settings) return null;
    return getPlanMonthlyPriceGnf(settings.trialPlan as CommercialPlan);
  }, [settings]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async () => {
    if (!settings?.enabled) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/register-restaurant", {
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
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Erreur lors de l'inscription");
        return;
      }
      if (!data.verificationRequired) {
        setError("La vérification email est requise avant la création du compte.");
        return;
      }
      setVerificationSentTo(data.ownerEmail || form.ownerEmail.trim().toLowerCase());
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (settingsLoading) {
    return <FullPageLoader />;
  }

  if (verificationSentTo) {
    return (
      <Shell>
        <div className="max-w-xl mx-auto bg-white border border-green-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <Mail className="w-7 h-7 text-green-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-5">Vérifiez votre email</h1>
          <p className="mt-3 text-gray-600">
            Un lien de vérification a été envoyé à <strong>{verificationSentTo}</strong>.
          </p>
          <div className="mt-5 p-4 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-900 text-left">
            Aucun compte, restaurant ou abonnement n'est encore actif. Le tenant sera créé uniquement après votre confirmation explicite depuis le lien reçu.
          </div>
          <p className="mt-5 text-sm text-gray-500">
            Si vous ne voyez pas le message, vérifiez vos spams. Vous pouvez recommencer l'inscription pour recevoir un nouveau lien ; l'ancien sera invalidé.
          </p>
          <button onClick={() => setVerificationSentTo("")} className="secondary-button mt-6 w-full">
            Modifier les informations / renvoyer
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {!settings?.enabled ? (
        <div className="max-w-xl mx-auto bg-white border border-orange-100 rounded-2xl shadow-sm p-8 text-center">
          <ShieldCheck className="w-12 h-12 text-orange-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Inscriptions sur invitation</h1>
          <p className="mt-3 text-gray-600">
            L'inscription publique n'est pas ouverte pour le moment. Contactez l'équipe KFM Delice pour créer votre compte restaurant.
          </p>
          <a href="/contact" className="inline-flex mt-6 px-5 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700">
            Contacter KFM Delice
          </a>
        </div>
      ) : (
        <>
          <Progress step={step} />
          {error && (
            <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="max-w-lg mx-auto">
              <Title title="Créez votre restaurant" subtitle="Renseignez les informations principales de votre établissement." />
              <div className="space-y-4">
                <Field label="Nom du restaurant *" icon={<ChefHat className="w-5 h-5" />}>
                  <input name="restaurantName" value={form.restaurantName} onChange={handleChange} maxLength={120} className="field-input pl-10" placeholder="Mon Restaurant" required />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Téléphone *" icon={<Phone className="w-5 h-5" />}>
                    <input type="tel" name="phone" value={form.phone} onChange={handleChange} maxLength={40} className="field-input pl-10" placeholder="+224 622 00 00 00" required />
                  </Field>
                  <Field label="WhatsApp">
                    <input type="tel" name="whatsapp" value={form.whatsapp} onChange={handleChange} maxLength={40} className="field-input" placeholder="Même que téléphone" />
                  </Field>
                </div>
                <Field label="Email du restaurant" icon={<Mail className="w-5 h-5" />}>
                  <input type="email" name="email" value={form.email} onChange={handleChange} maxLength={254} className="field-input pl-10" placeholder="contact@monrestaurant.com" />
                </Field>
                <Field label="Adresse" icon={<MapPin className="w-5 h-5" />}>
                  <input name="address" value={form.address} onChange={handleChange} maxLength={300} className="field-input pl-10" placeholder="Conakry, Guinée" />
                </Field>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Devise du restaurant</label>
                  <select name="currency" value={form.currency} onChange={handleChange} className="field-input">
                    <option value="GNF">GNF - Franc guinéen</option>
                    <option value="XOF">XOF - Franc CFA</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="USD">USD - Dollar américain</option>
                  </select>
                </div>
                <button onClick={() => setStep(2)} disabled={!form.restaurantName.trim() || !form.phone.trim()} className="primary-button w-full">
                  Continuer <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-lg mx-auto">
              <Title title="Votre compte administrateur" subtitle="L'adresse email doit être vérifiée avant la création du tenant." />
              <div className="space-y-4">
                <Field label="Votre nom complet *" icon={<User className="w-5 h-5" />}>
                  <input name="ownerName" value={form.ownerName} onChange={handleChange} maxLength={120} className="field-input pl-10" placeholder="Amadou Diallo" required />
                </Field>
                <Field label="Votre email *" icon={<Mail className="w-5 h-5" />}>
                  <input type="email" name="ownerEmail" value={form.ownerEmail} onChange={handleChange} maxLength={254} className="field-input pl-10" placeholder="amadou@email.com" required />
                </Field>
                <Field label="Mot de passe *" icon={<Lock className="w-5 h-5" />}>
                  <input type="password" name="ownerPassword" value={form.ownerPassword} onChange={handleChange} maxLength={128} minLength={12} className="field-input pl-10" placeholder="12 caractères minimum" required />
                </Field>
                <p className="text-xs text-gray-500 -mt-2">12 caractères minimum avec majuscule, minuscule, chiffre et caractère spécial.</p>
                <Field label="Votre téléphone" icon={<Phone className="w-5 h-5" />}>
                  <input type="tel" name="ownerPhone" value={form.ownerPhone} onChange={handleChange} maxLength={40} className="field-input pl-10" placeholder="+224 622 00 00 00" />
                </Field>
                <div className="flex gap-4">
                  <button onClick={() => setStep(1)} className="secondary-button flex-1">Retour</button>
                  <button onClick={() => setStep(3)} disabled={!form.ownerName.trim() || !form.ownerEmail.trim() || form.ownerPassword.length < 12} className="primary-button flex-1">
                    Continuer <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && settings && (
            <div className="max-w-2xl mx-auto">
              <Title title="Votre essai KFM Delice" subtitle="Le forfait est défini côté serveur et votre email doit être confirmé avant activation." />
              <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-lg p-7">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                      <Sparkles className="w-4 h-4" /> {settings.trialDays} jours d'essai
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mt-4">Plan {PLAN_LABELS[settings.trialPlan]}</h3>
                  </div>
                  {trialPrice !== null && (
                    <div className="sm:text-right">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Tarif catalogue après activation</p>
                      <p className="text-2xl font-bold text-orange-600">{Number(trialPrice).toLocaleString("fr-FR")} GNF</p>
                      <p className="text-sm text-gray-400">/ mois</p>
                    </div>
                  )}
                </div>
                <ul className="grid sm:grid-cols-2 gap-3 mt-6">
                  {TRIAL_FEATURES[settings.trialPlan].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">
                  <strong>Aucune facturation automatique pendant l'essai.</strong> La période d'essai démarre seulement après vérification de votre email et création effective du compte.
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button onClick={() => setStep(2)} className="secondary-button flex-1">Retour</button>
                <button onClick={handleSubmit} disabled={loading} className="primary-button flex-1">
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Envoi...</> : <><Mail className="w-5 h-5" /> Vérifier mon email</>}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

function FullPageLoader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2"><ChefHat className="w-8 h-8 text-orange-600" /><span className="text-xl font-bold text-gray-900">KFM Delice</span></div>
          <p className="text-sm text-gray-500">Déjà inscrit ? <a href="/admin/login" className="text-orange-600 hover:underline font-medium">Se connecter</a></p>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-12">{children}</main>
      <footer className="border-t bg-white mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">KFM Delice — Plateforme SaaS de gestion pour restaurants</div>
      </footer>
      <style jsx global>{`
        .field-input { width:100%; padding-top:.75rem; padding-bottom:.75rem; padding-right:1rem; border:1px solid rgb(209 213 219); border-radius:.5rem; background:white; }
        .field-input:focus { outline:none; border-color:rgb(249 115 22); box-shadow:0 0 0 2px rgb(249 115 22 / .2); }
        .primary-button { min-height:3rem; padding:.75rem 1rem; border-radius:.5rem; background:rgb(234 88 12); color:white; font-weight:500; display:flex; align-items:center; justify-content:center; gap:.5rem; }
        .primary-button:hover:not(:disabled) { background:rgb(194 65 12); }
        .primary-button:disabled { opacity:.5; cursor:not-allowed; }
        .secondary-button { min-height:3rem; padding:.75rem 1rem; border:1px solid rgb(209 213 219); border-radius:.5rem; color:rgb(55 65 81); background:white; font-weight:500; }
        .secondary-button:hover { background:rgb(249 250 251); }
      `}</style>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 mb-12">
      {[1, 2, 3].map((item) => (
        <div key={item} className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${step >= item ? "bg-orange-600 text-white" : "bg-gray-200 text-gray-500"}`}>
            {step > item ? <Check className="w-5 h-5" /> : item}
          </div>
          <span className={`hidden sm:inline text-sm ${step >= item ? "text-orange-600 font-medium" : "text-gray-400"}`}>{item === 1 ? "Restaurant" : item === 2 ? "Compte" : "Essai"}</span>
          {item < 3 && <div className={`w-8 sm:w-16 h-0.5 ${step > item ? "bg-orange-600" : "bg-gray-200"}`} />}
        </div>
      ))}
    </div>
  );
}

function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return <><h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{title}</h2><p className="text-gray-500 text-center mb-8">{subtitle}</p></>;
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">{icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}{children}</div>
    </div>
  );
}
