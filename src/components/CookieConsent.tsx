"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";

const CONSENT_KEY = "kfm-cookie-consent";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(CONSENT_KEY);
      if (!consent) {
        // Show after 2s to avoid blocking initial render
        const timer = setTimeout(() => setShow(true), 2000);
        return () => clearTimeout(timer);
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({
        accepted: true,
        date: new Date().toISOString(),
      }));
    } catch { /* ignore */ }
    setShow(false);
  };

  const decline = () => {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({
        accepted: false,
        date: new Date().toISOString(),
      }));
    } catch { /* ignore */ }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg animate-in slide-in-from-bottom duration-300">
      <div className="max-w-5xl mx-auto flex items-start gap-4 flex-wrap">
        <div className="flex-shrink-0 mt-1">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Cookie className="w-5 h-5 text-orange-500" />
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Cookies & confidentialité
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Nous utilisons des cookies essentiels au fonctionnement du site (session, panier, préférences)
            et des cookies d'analyse (Sentry) pour améliorer l'expérience. En continuant, vous acceptez
            notre{" "}
            <a href="/legal/privacy" className="text-orange-500 hover:underline">
              politique de confidentialité
            </a>
            . Conforme RGPD et PDPO Guinée.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={decline} className="text-xs">
            Refuser
          </Button>
          <Button size="sm" onClick={accept} className="bg-orange-500 hover:bg-orange-600 text-white text-xs">
            Accepter
          </Button>
          <button
            onClick={decline}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
