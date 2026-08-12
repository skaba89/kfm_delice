"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChefHat, Loader2, MailCheck, ShieldCheck } from "lucide-react";

export default function VerifyOnboardingEmailPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginUrl, setLoginUrl] = useState("");

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token") || "";
    setToken(value);
    if (!/^[a-f0-9]{64}$/i.test(value)) {
      setError("Ce lien de vérification est invalide.");
    }
  }, []);

  const verify = async () => {
    if (!token || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/register-restaurant/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Impossible de vérifier cette demande.");
        return;
      }
      setLoginUrl(data.loginUrl || "/admin/login?verified=1");
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-2">
          <ChefHat className="w-8 h-8 text-orange-600" />
          <span className="text-xl font-bold text-gray-900">KFM Delice</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-8 text-center">
          {loginUrl ? (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-green-700" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mt-5">Email vérifié, compte créé</h1>
              <p className="mt-3 text-gray-600">
                Votre compte SaaS, votre restaurant principal et votre abonnement d'essai ont été créés. Connectez-vous avec l'email et le mot de passe saisis lors de l'inscription.
              </p>
              <a href={loginUrl} className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700">
                Se connecter à mon administration
              </a>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto rounded-full bg-orange-100 flex items-center justify-center">
                <MailCheck className="w-9 h-9 text-orange-700" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mt-5">Confirmez votre email</h1>
              <p className="mt-3 text-gray-600">
                Pour votre sécurité, KFM Delice ne crée aucun tenant automatiquement à l'ouverture du lien. Cliquez ci-dessous pour confirmer explicitement votre adresse email.
              </p>
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-left text-sm text-blue-900">
                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                Cette étape protège votre inscription contre les robots et les scanners automatiques de liens des messageries.
              </div>

              {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

              <button
                onClick={verify}
                disabled={loading || !/^[a-f0-9]{64}$/i.test(token)}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Vérification...</> : <><MailCheck className="w-5 h-5" /> Confirmer et créer mon compte</>}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
