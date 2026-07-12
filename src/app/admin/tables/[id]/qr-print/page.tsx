"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface QrTableData {
  id: string;
  name: string;
  number: string;
  qrUrl: string;
  qrVersion: number;
  restaurantName?: string;
}

export default function QrPrintPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { apiFetch } = useAuth();
  const [table, setTable] = useState<QrTableData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/tables/${params.id}/qr`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Échec");
        setTable(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, apiFetch]);

  const downloadPng = () => {
    if (!table) return;
    const svg = document.getElementById("qr-print-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      // A6 landscape-ish: 600x420 px at 72 DPI
      canvas.width = 600;
      canvas.height = 420;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Quiet zone around QR
      ctx.drawImage(img, 30, 30, 360, 360);
      // Right column: restaurant + table info
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Table ${table.number}`, 410, 130);
      ctx.font = "20px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(table.name, 410, 165);
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText("Scannez pour consulter", 410, 220);
      ctx.fillText("le menu et commander.", 410, 240);
      ctx.fillText(`QR v${table.qrVersion}`, 410, 290);
      const link = document.createElement("a");
      link.download = `table-${table.number}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Chargement…</div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Table introuvable</p>
          <Button onClick={() => router.push("/admin/tables")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour aux tables
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Toolbar (hidden on print) */}
      <div className="no-print flex items-center justify-between mb-6 max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => router.push("/admin/tables")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadPng}>
            <Download className="w-4 h-4 mr-2" /> Télécharger PNG
          </Button>
          <Button onClick={() => window.print()} className="bg-orange-500 text-white">
            <Printer className="w-4 h-4 mr-2" /> Imprimer
          </Button>
        </div>
      </div>

      {/* Printable card — A6 landscape (105 × 148 mm) */}
      <div
        id="printable-card"
        className="bg-white mx-auto shadow-lg flex"
        style={{
          width: "148mm",
          height: "105mm",
          padding: "8mm",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: "8mm",
        }}
      >
        {/* QR code on the left */}
        <div
          className="flex-shrink-0"
          style={{
            width: "85mm",
            height: "85mm",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "white",
          }}
        >
          <QRCodeSVG
            id="qr-print-svg"
            value={table.qrUrl}
            size={320}
            level="M"
            includeMargin={true}
            fgColor="#000000"
          />
        </div>

        {/* Text on the right */}
        <div
          className="flex-1 flex flex-col justify-center"
          style={{ minWidth: 0 }}
        >
          <h1
            style={{
              fontSize: "32pt",
              fontWeight: 800,
              color: "#1f2937",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Table
          </h1>
          <h2
            style={{
              fontSize: "56pt",
              fontWeight: 900,
              color: "#ea580c",
              margin: 0,
              lineHeight: 1,
            }}
          >
            {table.number}
          </h2>
          <p
            style={{
              fontSize: "14pt",
              color: "#6b7280",
              margin: "4mm 0 0 0",
            }}
          >
            {table.name}
          </p>
          <div
            style={{
              marginTop: "6mm",
              paddingTop: "4mm",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <p
              style={{
                fontSize: "11pt",
                color: "#374151",
                margin: 0,
                fontWeight: 600,
              }}
            >
              Scannez pour consulter
            </p>
            <p
              style={{
                fontSize: "11pt",
                color: "#374151",
                margin: 0,
                fontWeight: 600,
              }}
            >
              le menu et commander
            </p>
            <p
              style={{
                fontSize: "8pt",
                color: "#9ca3af",
                margin: "4mm 0 0 0",
              }}
            >
              QR v{table.qrVersion}
            </p>
          </div>
        </div>
      </div>

      {/* Print styles — only show the card, hide everything else */}
      <style jsx global>{`
        @media print {
          @page {
            size: A6 landscape;
            margin: 0;
          }
          body * {
            visibility: hidden;
          }
          #printable-card,
          #printable-card * {
            visibility: visible;
          }
          #printable-card {
            position: absolute;
            left: 0;
            top: 0;
            box-shadow: none;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
