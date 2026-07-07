"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Printer, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminTablesPage() {
  const router = useRouter();
  const [tableCount, setTableCount] = useState(10);
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    // Initialize client-side values (window/localStorage not available during SSR)
    if (typeof window !== "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBaseUrl(window.location.origin);
      const stored = localStorage.getItem("admin_token");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setToken(stored);
    }
  }, []);

  const tables = Array.from({ length: tableCount }, (_, i) => i + 1);

  const getTableUrl = (n: number) => `${baseUrl}/table/${n}`;

  const downloadQR = (n: number) => {
    const svg = document.getElementById(`qr-${n}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 450;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 50, 50, 300, 300);
      ctx.fillStyle = "#ea580c";
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Table ${n}`, 200, 420);
      const link = document.createElement("a");
      link.download = `table-${n}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const printAll = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6 no-print">
          <Button variant="ghost" onClick={() => router.push("/admin")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
          <h1 className="text-2xl font-bold">QR Codes des Tables</h1>
        </div>

        <Card className="mb-6 no-print">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div>
              <Label htmlFor="count">Nombre de tables</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={200}
                value={tableCount}
                onChange={(e) => setTableCount(Math.min(200, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-32"
              />
            </div>
            <div>
              <Label htmlFor="url">URL de base</Label>
              <Input
                id="url"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-96"
              />
            </div>
            <Button onClick={printAll} variant="default">
              <Printer className="w-4 h-4 mr-2" /> Imprimer tout
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {tables.map((n) => (
            <Card key={n} className="overflow-hidden">
              <CardContent className="p-4 flex flex-col items-center">
                <div className="mb-2">
                  <QRCodeSVG
                    id={`qr-${n}`}
                    value={getTableUrl(n)}
                    size={180}
                    level="M"
                    includeMargin={true}
                    fgColor="#1f2937"
                  />
                </div>
                <p className="font-bold text-lg text-orange-600 mb-2">Table {n}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadQR(n)}
                  className="no-print w-full"
                >
                  <Download className="w-3 h-3 mr-1" /> Télécharger
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-xl no-print">
          <p className="text-sm text-blue-700">
            <strong>Comment utiliser :</strong> Imprimez ces QR codes et placez-les sur chaque table.
            Les clients scannent le code avec leur téléphone, voient le menu, commandent et paient
            directement depuis leur table — sans serveur. Le numéro de table est automatiquement
            attaché à chaque commande.
          </p>
        </div>
      </div>
    </div>
  );
}
