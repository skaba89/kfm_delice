"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface ExportJournalButtonProps {
  /** ISO date string (YYYY-MM-DD). Defaults to today. */
  date?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

/**
 * Mission P2.4 — Export PDF journal des commandes.
 *
 * Downloads a printable PDF of all orders for a given day.
 * The PDF includes a summary (total orders, revenue, breakdown by
 * type) and a detailed table (one row per order).
 */
export function ExportJournalButton({
  date,
  label = "Exporter PDF",
  variant = "outline",
  size = "sm",
  className = "",
}: ExportJournalButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("platform_token") || localStorage.getItem("admin_token")
          : null;

      const res = await fetch(`/api/export/orders-journal?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Erreur lors de la génération du PDF");
        return;
      }

      // Download the PDF file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateSlug = date || new Date().toISOString().slice(0, 10);
      a.download = `journal-commandes-${dateSlug}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Journal PDF téléchargé");
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={loading}
      variant={variant}
      size={size}
      className={className}
    >
      {loading ? (
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <FileText className="w-4 h-4 mr-2" />
      )}
      {label}
    </Button>
  );
}
