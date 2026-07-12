"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertTriangle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrScanClientProps {
  token: string;
}

type ErrorState =
  | { kind: "QR_NOT_FOUND"; message: string }
  | { kind: "QR_ROTATED"; message: string }
  | { kind: "TABLE_INACTIVE"; message: string }
  | { kind: "RESTAURANT_UNAVAILABLE"; message: string }
  | { kind: "ACCOUNT_SUSPENDED"; message: string }
  | { kind: "UNKNOWN"; message: string };

const ERROR_MESSAGES: Record<string, { title: string; subtitle: string }> = {
  QR_NOT_FOUND: {
    title: "QR code invalide",
    subtitle: "Ce QR code n'existe pas ou a été supprimé. Demandez l'aide d'un serveur.",
  },
  QR_ROTATED: {
    title: "Ce QR code a été remplacé",
    subtitle: "Le restaurant a régénéré ce QR code. Veuillez scanner le nouveau code sur la table.",
  },
  TABLE_INACTIVE: {
    title: "Cette table est désactivée",
    subtitle: "Cette table n'accepte plus de commandes. Demandez l'aide d'un serveur.",
  },
  RESTAURANT_UNAVAILABLE: {
    title: "Ce restaurant est temporairement indisponible",
    subtitle: "Le restaurant est suspendu ou en maintenance. Réessayez plus tard.",
  },
  ACCOUNT_SUSPENDED: {
    title: "Ce restaurant est suspendu",
    subtitle: "Le compte du restaurant est suspendu. Contactez le restaurant directement.",
  },
  UNKNOWN: {
    title: "Une erreur est survenue",
    subtitle: "Impossible de résoudre ce QR code. Réessayez ou demandez l'aide d'un serveur.",
  },
};

export function QrScanClient({ token }: QrScanClientProps) {
  const router = useRouter();
  const [error, setError] = useState<ErrorState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/qr/table/${encodeURIComponent(token)}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          // Save table context to sessionStorage so the menu page can
          // attach it to the order. We DO NOT store any secret — the
          // token itself is the only credential, and it's already
          // public (printed on the table).
          try {
            sessionStorage.setItem("kfm-table-token", token);
            sessionStorage.setItem("kfm-table-public-id", data.table?.publicId || "");
            sessionStorage.setItem("kfm-table-number", data.table?.number || "");
            sessionStorage.setItem("kfm-table-name", data.table?.name || "");
            sessionStorage.setItem("kfm-table-zone", data.table?.zone || "");
            sessionStorage.setItem("kfm-restaurant-slug", data.restaurant?.slug || "");
            // Also set the LEGACY localStorage key used by publicApiFetch
            // and the auth context — so all subsequent API calls from the
            // menu page automatically send the correct x-restaurant-slug
            // header (matches the restaurant resolved from the QR token).
            if (data.restaurant?.slug) {
              localStorage.setItem("restaurantpro_slug", data.restaurant.slug);
            }
          } catch {
            /* sessionStorage may be unavailable in private browsing */
          }

          // Redirect to the menu URL returned by the API
          const menuUrl = data.menuUrl || `/menu?restaurant=${data.restaurant?.slug || ""}&tableToken=${token}`;
          router.replace(menuUrl);
          return;
        }

        // Non-OK: parse error code
        const data = await res.json().catch(() => ({}));
        const code = (data.code as string) || "UNKNOWN";
        const message = (data.error as string) || "Erreur inconnue";
        const known = ["QR_NOT_FOUND", "QR_ROTATED", "TABLE_INACTIVE", "RESTAURANT_UNAVAILABLE", "ACCOUNT_SUSPENDED"];
        setError({
          kind: known.includes(code) ? (code as ErrorState["kind"]) : "UNKNOWN",
          message,
        });
      } catch {
        if (!cancelled) {
          setError({ kind: "UNKNOWN", message: "Erreur réseau" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-950 dark:to-gray-900">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Résolution du QR code…
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nous identifions votre table et le restaurant.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    const info = ERROR_MESSAGES[error.kind] || ERROR_MESSAGES.UNKNOWN;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {info.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{info.subtitle}</p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => router.push("/")}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl"
            >
              Retour à l'accueil
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="rounded-xl"
            >
              Réessayer
            </Button>
          </div>
          {process.env.NODE_ENV !== "production" && (
            <p className="text-xs text-gray-400 mt-6 font-mono">
              Code: {error.kind} — {error.message}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Fallback (should not reach here, but be defensive)
  return (
    <div className="min-h-screen flex items-center justify-center">
      <QrCode className="w-8 h-8 text-orange-500" />
    </div>
  );
}
