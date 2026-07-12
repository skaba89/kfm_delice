"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Download,
  Printer,
  ArrowLeft,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  QrCode,
  Power,
  PowerOff,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

interface RestaurantTable {
  id: string;
  name: string;
  number: string;
  capacity: number;
  zone: string;
  status: string;
  active: boolean;
  qrEnabled: boolean;
  qrVersion: number;
  qrUrl: string;
  scanCount: number;
  lastScannedAt: string | null;
  qrGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminTablesPage() {
  const router = useRouter();
  const { apiFetch } = useAuth();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [qrDialog, setQrDialog] = useState<RestaurantTable | null>(null);

  // ── Form state ──
  const [formName, setFormName] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formCapacity, setFormCapacity] = useState(4);
  const [formZone, setFormZone] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/tables?includeInactive=true");
      const data = await res.json();
      if (Array.isArray(data.data)) setTables(data.data);
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setFormName("");
    setFormNumber("");
    setFormCapacity(4);
    setFormZone("");
    setEditing(null);
    setCreateOpen(true);
  };

  const openEdit = (t: RestaurantTable) => {
    setEditing(t);
    setFormName(t.name);
    setFormNumber(t.number);
    setFormCapacity(t.capacity);
    setFormZone(t.zone);
    setCreateOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formNumber.trim()) {
      toast.error("Nom et numéro requis");
      return;
    }
    try {
      const body = {
        name: formName.trim(),
        number: formNumber.trim(),
        capacity: formCapacity,
        zone: formZone.trim(),
      };
      if (editing) {
        const res = await apiFetch(`/api/tables/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Échec");
        }
        toast.success("Table modifiée");
      } else {
        const res = await apiFetch("/api/tables", {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Échec");
        }
        toast.success("Table créée");
      }
      setCreateOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const handleDelete = async (t: RestaurantTable) => {
    if (!confirm(`Supprimer la table ${t.number} ?${t.scanCount > 0 ? " Elle sera désactivée (commandes existantes)." : ""}`)) {
      return;
    }
    try {
      const res = await apiFetch(`/api/tables/${t.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Échec");
      toast.success(data.mode === "soft" ? "Table désactivée" : "Table supprimée");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const handleToggleActive = async (t: RestaurantTable) => {
    try {
      const res = await apiFetch(`/api/tables/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !t.active, qrEnabled: !t.active }),
      });
      if (!res.ok) throw new Error("Échec");
      toast.success(t.active ? "Table désactivée" : "Table activée");
      load();
    } catch {
      toast.error("Erreur");
    }
  };

  const handleRotateQr = async (t: RestaurantTable) => {
    if (!confirm("Régénérer le QR code ? L'ancien sera immédiatement invalide.")) return;
    try {
      const res = await apiFetch(`/api/tables/${t.id}/qr/rotate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec");
      toast.success("QR code régénéré");
      setQrDialog({ ...t, qrUrl: data.qrUrl, qrVersion: data.qrVersion });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const downloadQrPng = (t: RestaurantTable) => {
    const svg = document.getElementById(`qr-svg-${t.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = 600;
      canvas.height = 700;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // QR centered, with quiet zone
      ctx.drawImage(img, 100, 80, 400, 400);
      // Label below
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Table ${t.number}`, 300, 540);
      ctx.font = "20px sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(t.name, 300, 575);
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText("Scannez pour consulter le menu et commander", 300, 615);
      const link = document.createElement("a");
      link.download = `table-${t.number}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push("/admin")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-6 h-6 text-orange-500" />
              Tables & QR Codes
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Rafraîchir
            </Button>
            <Button onClick={openCreate} className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
              <Plus className="w-4 h-4 mr-2" /> Nouvelle table
            </Button>
          </div>
        </div>

        {/* Tables grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : tables.length === 0 ? (
          <Card className="dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="py-12 text-center">
              <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucune table configurée pour le moment.</p>
              <Button onClick={openCreate} className="bg-orange-500 text-white">
                <Plus className="w-4 h-4 mr-2" /> Créer la première table
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tables.map((t) => (
              <Card
                key={t.id}
                className={`overflow-hidden ${!t.active ? "opacity-60" : ""} dark:bg-gray-900 dark:border-gray-800`}
              >
                <CardContent className="p-4 flex flex-col items-center">
                  {/* Hidden SVG used for PNG export */}
                  <div className="hidden">
                    <QRCodeSVG
                      id={`qr-svg-${t.id}`}
                      value={t.qrUrl}
                      size={400}
                      level="M"
                      includeMargin={true}
                      fgColor="#1f2937"
                    />
                  </div>

                  {/* Visible QR preview (smaller) */}
                  <div className="mb-3 p-2 bg-white rounded-lg">
                    <QRCodeSVG
                      value={t.qrUrl}
                      size={140}
                      level="M"
                      includeMargin={true}
                      fgColor="#1f2937"
                    />
                  </div>

                  <div className="text-center mb-3 w-full">
                    <p className="font-bold text-lg text-orange-600 dark:text-orange-400">
                      Table {t.number}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {t.name}
                    </p>
                    {t.zone && (
                      <p className="text-xs text-gray-400">{t.zone}</p>
                    )}
                    <div className="flex items-center justify-center gap-2 mt-1 text-xs">
                      <span className={`px-1.5 py-0.5 rounded ${t.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                        {t.active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-gray-400">v{t.qrVersion}</span>
                    </div>
                  </div>

                  {/* Scan stats */}
                  <div className="text-xs text-gray-500 mb-3 w-full text-center">
                    {t.scanCount} scan{t.scanCount > 1 ? "s" : ""}
                    {t.lastScannedAt && (
                      <span className="block">
                        Dernier: {new Date(t.lastScannedAt).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-1 w-full">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setQrDialog(t)}
                      className="text-xs"
                    >
                      <Eye className="w-3 h-3 mr-1" /> Voir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadQrPng(t)}
                      className="text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" /> PNG
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(t)}
                      className="text-xs"
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Éditer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRotateQr(t)}
                      className="text-xs"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" /> Régénérer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/admin/tables/${t.id}/qr-print`)}
                      className="text-xs"
                    >
                      <Printer className="w-3 h-3 mr-1" /> Imprimer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleActive(t)}
                      className="text-xs"
                    >
                      {t.active ? <PowerOff className="w-3 h-3 mr-1" /> : <Power className="w-3 h-3 mr-1" />}
                      {t.active ? "Désactiver" : "Activer"}
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(t)}
                    className="w-full mt-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Supprimer
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la table" : "Nouvelle table"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="t-name">Nom</Label>
              <Input
                id="t-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Table Terrasse 4"
              />
            </div>
            <div>
              <Label htmlFor="t-number">Numéro</Label>
              <Input
                id="t-number"
                value={formNumber}
                onChange={(e) => setFormNumber(e.target.value)}
                placeholder="T04"
              />
              <p className="text-xs text-gray-500 mt-1">
                Unique dans ce restaurant. Peut exister dans d'autres restaurants.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="t-capacity">Capacité</Label>
                <Input
                  id="t-capacity"
                  type="number"
                  min={1}
                  max={50}
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div>
                <Label htmlFor="t-zone">Zone</Label>
                <Input
                  id="t-zone"
                  value={formZone}
                  onChange={(e) => setFormZone(e.target.value)}
                  placeholder="Terrasse"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} className="bg-orange-500 text-white">
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR preview dialog */}
      <Dialog open={!!qrDialog} onOpenChange={(o) => !o && setQrDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              QR Code — {qrDialog?.name} (Table {qrDialog?.number})
            </DialogTitle>
          </DialogHeader>
          {qrDialog && (
            <div className="flex flex-col items-center py-4">
              <div className="p-4 bg-white rounded-lg mb-4">
                <QRCodeSVG
                  value={qrDialog.qrUrl}
                  size={260}
                  level="M"
                  includeMargin={true}
                  fgColor="#1f2937"
                />
              </div>
              <div className="text-center mb-4">
                <p className="text-sm text-gray-500">URL publique :</p>
                <p className="font-mono text-xs break-all bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded mt-1">
                  {qrDialog.qrUrl}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Version {qrDialog.qrVersion} · {qrDialog.scanCount} scans
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => downloadQrPng(qrDialog)}
                >
                  <Download className="w-4 h-4 mr-2" /> Télécharger PNG
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push(`/admin/tables/${qrDialog.id}/qr-print`)}
                >
                  <Printer className="w-4 h-4 mr-2" /> Imprimer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
