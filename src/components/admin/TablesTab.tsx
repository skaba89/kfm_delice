"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Printer, QrCode } from "lucide-react";

export function TablesTab() {
  const [tableCount, setTableCount] = useState(10);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <QrCode className="w-5 h-5 text-orange-500" />
          QR Codes des Tables
        </h2>
        <Button onClick={printAll} className="bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl">
          <Printer className="w-4 h-4 mr-2" /> Imprimer tout
        </Button>
      </div>

      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white text-sm">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div>
            <Label htmlFor="count" className="text-gray-600 dark:text-gray-400">Nombre de tables</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={200}
              value={tableCount}
              onChange={(e) => setTableCount(Math.min(200, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-32 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <Label htmlFor="url" className="text-gray-600 dark:text-gray-400">URL de base</Label>
            <Input
              id="url"
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-96 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {tables.map((n) => (
          <Card key={n} className="overflow-hidden dark:bg-gray-800 dark:border-gray-700">
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
                className="w-full no-print dark:border-gray-600"
              >
                <Download className="w-3 h-3 mr-1" /> Télécharger
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl no-print">
        <p className="text-sm text-blue-700 dark:text-blue-400">
          <strong>Comment utiliser :</strong> Imprimez ces QR codes et placez-les sur chaque table.
          Les clients scannent le code avec leur téléphone, voient le menu, commandent et paient
          directement depuis leur table — sans serveur. Le numéro de table est automatiquement
          attaché à chaque commande.
        </p>
      </div>
    </div>
  );
}
