"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * Error Boundary — catches unhandled React errors and shows a
 * user-friendly fallback instead of a white screen.
 *
 * This is the Next.js App Router convention: any uncaught error
 * in a Server Component or Client Component renders this page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console (in production, this would go to Sentry)
    console.error("[ErrorBoundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900 p-4">
      <div className="max-w-md w-full">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Oups, quelque chose s'est mal passé
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Une erreur inattendue s'est produite. Vous pouvez réessayer
            ou retourner à l'accueil.
          </p>

          {process.env.NODE_ENV !== "production" && (
            <details className="mb-6 text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Détails de l'erreur (développement)
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-red-600 dark:text-red-400 overflow-x-auto">
                {error.message}
                {error.stack && "\n\n" + error.stack}
                {error.digest && "\n\nDigest: " + error.digest}
              </pre>
            </details>
          )}

          <div className="flex gap-3 justify-center">
            <Button
              onClick={reset}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
            <Button
              onClick={() => window.location.href = "/"}
              variant="outline"
              className="rounded-xl"
            >
              <Home className="w-4 h-4 mr-2" />
              Accueil
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
