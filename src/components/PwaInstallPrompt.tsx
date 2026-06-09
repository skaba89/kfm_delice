"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { setupInstallPromptListener, showInstallPrompt, isAppInstalled } from "@/lib/notifications-push";

export function PwaInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (isAppInstalled()) {
      setInstalled(true);
      return;
    }

    // Check if user previously dismissed
    const wasDismissed = localStorage.getItem("kfm_pwa_dismissed");
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    const cleanup = setupInstallPromptListener((available) => {
      if (available && !dismissed) {
        // Delay showing prompt by 5 seconds so it doesn't interrupt initial load
        setTimeout(() => setShowPrompt(true), 5000);
      }
    });

    return cleanup;
  }, [dismissed]);

  const handleInstall = async () => {
    const accepted = await showInstallPrompt();
    if (accepted) {
      setInstalled(true);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("kfm_pwa_dismissed", "true");
  };

  if (!showPrompt || installed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Fermer"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
              Installer KFM Delice
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Accédez au restaurant plus rapidement depuis votre écran d&apos;accueil
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            <Download className="h-4 w-4" />
            Installer
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
