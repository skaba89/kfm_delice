"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Settings, Store, Phone, MapPin, Clock, Image, Palette,
  Truck, Receipt, Globe, Save, RefreshCw, Upload, Check,
  ShieldCheck, Users2, Bell, Volume2, VolumeX, Play, Trophy,
} from "lucide-react";
import type { RestaurantDB, AdminDB } from "@/lib/types";
import { notify } from "@/lib/notifications";
import {
  adminRoleLabels, adminRoleColors, adminRoleOrder,
  staffRoleLabels, staffRoleColors,
} from "@/lib/constants";

export interface SettingsTabProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  apiPatch: (url: string, body: object) => Promise<{ success: boolean; error?: string }>;
  apiPut: (url: string, body: object) => Promise<{ success: boolean; error?: string }>;
  /** Current admin's role — gates who can view the Roles & Privileges section. */
  adminRole?: string;
  /** List of admin users (used to display counts per role). */
  admins?: AdminDB[];
}

const defaultSettings: Partial<RestaurantDB> = {
  name: "", tagline: "", description: "",
  phone: "", whatsapp: "", email: "",
  address: "", hours: "Lun-Dim : 11h00 - 23h00",
  tables: 20, deliveryFee: 5000, minDelivery: 15000,
  deliveryZones: "Kaloum:Dixinn:Matam:Matoto",
  logo: "", primaryColor: "#ea580c", secondaryColor: "#dc2626",
  taxRate: 15, currency: "GNF",
  facebook: "", instagram: "", twitter: "",
  latitude: 9.5092, longitude: -13.7122,
};

export function SettingsTab({ apiFetch, apiPatch, apiPut, adminRole, admins = [] }: SettingsTabProps) {
  const [settings, setSettings] = useState<Partial<RestaurantDB>>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<Partial<RestaurantDB>>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState("general");

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/restaurant");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setOriginalSettings(data);
      }
    } catch {
      notify.error("Erreur lors du chargement des paramètres");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Save settings
  const handleSave = async () => {
    try {
      setSaving(true);
      // Only send whitelisted fields (avoid sending id, slug, createdAt, updatedAt)
      const saveData: Record<string, unknown> = {};
      const allowedFields = [
        "name", "tagline", "description", "phone", "whatsapp", "email",
        "address", "hours", "tables", "deliveryFee", "minDelivery",
        "deliveryZones", "deliveryRadiusKm", "loyaltyPointsRate",
        "logo", "primaryColor", "secondaryColor",
        "taxRate", "currency", "facebook", "instagram", "twitter",
        "latitude", "longitude", "lat", "lng",
      ];
      for (const field of allowedFields) {
        if ((settings as Record<string, unknown>)[field] !== undefined) {
          saveData[field] = (settings as Record<string, unknown>)[field];
        }
      }
      // Validate required fields
      if (!settings.name?.trim()) {
        notify.error("Le nom du restaurant est requis");
        setSaving(false);
        return;
      }
      const result = await apiPatch("/api/restaurant", saveData);
      if (result.success) {
        setOriginalSettings({ ...settings });
        notify.success("Paramètres enregistrés avec succès");
      } else {
        notify.error(result.error || "Erreur lors de l'enregistrement des paramètres");
      }
    } catch {
      notify.error("Erreur lors de l'enregistrement des paramètres");
    } finally {
      setSaving(false);
    }
  };

  // Logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setSettings(s => ({ ...s, logo: data.url || data.path || "" }));
        notify.success("Logo téléchargé avec succès");
      } else {
        notify.error("Erreur lors du téléchargement du logo");
      }
    } catch {
      notify.error("Erreur lors du téléchargement du logo");
    } finally {
      setUploading(false);
    }
  };

  // Check if settings have changed
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const updateField = (field: keyof RestaurantDB, value: string | number) => {
    setSettings(s => ({ ...s, [field]: value }));
  };

  const sections = [
    { id: "general", label: "Général", icon: Store },
    { id: "contact", label: "Contact", icon: Phone },
    { id: "address", label: "Adresse & GPS", icon: MapPin },
    { id: "hours", label: "Horaires & Salle", icon: Clock },
    { id: "branding", label: "Logo & Couleurs", icon: Palette },
    { id: "delivery", label: "Livraison", icon: Truck },
    { id: "billing", label: "Facturation", icon: Receipt },
    { id: "social", label: "Réseaux sociaux", icon: Globe },
    // 🔔 Mission P1.1 — Sound notifications (per-device preference, no DB)
    { id: "sounds", label: "Notifications sonores", icon: Bell },
    // 🏆 Mission P3.8 — Loyalty tiers configuration
    { id: "tiers", label: "Paliers Fidélité", icon: Trophy },
    // Roles & privileges — admin only
    ...(adminRole === "admin" ? [
      { id: "roles", label: "Rôles & Privilèges", icon: ShieldCheck },
    ] : []),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with save */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Paramétrage du restaurant</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadSettings} className="rounded-xl text-sm dark:border-gray-600">
            <RefreshCw className="w-4 h-4 mr-1" /> Actualiser
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`rounded-xl text-sm ${hasChanges ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}
          >
            {saving ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 flex-wrap">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === s.id
                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            <s.icon className="w-3.5 h-3.5" />{s.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <motion.div key={activeSection} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
        {activeSection === "general" && (
          <Card className="dark:border-gray-700">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Store className="w-4 h-4 text-orange-500" />Informations générales</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Nom du restaurant *</label>
                  <Input value={settings.name || ""} onChange={e => updateField("name", e.target.value)} placeholder="KFM Delice" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Slogan / Tagline</label>
                  <Input value={settings.tagline || ""} onChange={e => updateField("tagline", e.target.value)} placeholder="L'Art du Goût Guinéen" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Description</label>
                  <textarea
                    value={settings.description || ""}
                    onChange={e => updateField("description", e.target.value)}
                    placeholder="Restaurant gastronomique au cœur de Conakry..."
                    rows={3}
                    className="w-full rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm dark:text-gray-100 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Slug URL</label>
                  <Input value={settings.slug || ""} disabled className="dark:bg-gray-800 dark:border-gray-600 bg-gray-50 dark:bg-gray-900" />
                  <p className="text-[10px] text-gray-400 mt-0.5">Le slug est généré automatiquement et ne peut pas être modifié</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "contact" && (
          <Card className="dark:border-gray-700">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Phone className="w-4 h-4 text-orange-500" />Coordonnées</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Téléphone</label>
                  <Input value={settings.phone || ""} onChange={e => updateField("phone", e.target.value)} placeholder="+224 622 34 56 78" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">WhatsApp</label>
                  <Input value={settings.whatsapp || ""} onChange={e => updateField("whatsapp", e.target.value)} placeholder="+224 622 34 56 78" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Email</label>
                  <Input type="email" value={settings.email || ""} onChange={e => updateField("email", e.target.value)} placeholder="reservation@kfm-delice.com" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "address" && (
          <Card className="dark:border-gray-700">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-500" />Adresse & Localisation GPS</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Adresse complète</label>
                  <Input value={settings.address || ""} onChange={e => updateField("address", e.target.value)} placeholder="Almamya, Corniche Nord, Conakry, Guinée" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Latitude</label>
                  <Input type="number" step="0.0001" value={settings.latitude || ""} onChange={e => updateField("latitude", parseFloat(e.target.value) || 0)} placeholder="9.5092" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Longitude</label>
                  <Input type="number" step="0.0001" value={settings.longitude || ""} onChange={e => updateField("longitude", parseFloat(e.target.value) || 0)} placeholder="-13.7122" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Les coordonnées GPS sont utilisées pour la carte de livraison et le suivi des livreurs.</p>
            </CardContent>
          </Card>
        )}

        {activeSection === "hours" && (
          <Card className="dark:border-gray-700">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Clock className="w-4 h-4 text-orange-500" />Horaires & Salle</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Horaires d&apos;ouverture</label>
                  <Input value={settings.hours || ""} onChange={e => updateField("hours", e.target.value)} placeholder="Lun-Dim : 11h00 - 23h00" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Nombre de tables</label>
                  <Input type="number" value={settings.tables || ""} onChange={e => updateField("tables", parseInt(e.target.value) || 0)} placeholder="25" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Note / Rating</label>
                  <Input type="number" step="0.1" min="0" max="5" value={settings.rating || ""} onChange={e => updateField("rating", parseFloat(e.target.value) || 0)} placeholder="4.9" className="dark:bg-gray-800 dark:border-gray-600" />
                  <p className="text-[10px] text-gray-400 mt-0.5">Note sur 5 affichée publiquement</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "branding" && (
          <Card className="dark:border-gray-700">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Palette className="w-4 h-4 text-orange-500" />Logo & Couleurs de marque</h3>

              {/* Logo */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Logo du restaurant</label>
                <div className="flex items-center gap-4">
                  {settings.logo ? (
                    <div className="w-20 h-20 rounded-xl border-2 border-gray-200 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center">
                      <img src={settings.logo} alt="Logo" loading="lazy" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <Image className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${uploading ? "bg-gray-100 text-gray-400" : "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50"}`}>
                      {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading ? "Téléchargement..." : "Télécharger le logo"}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploading} />
                    </label>
                    {settings.logo && (
                      <button onClick={() => updateField("logo", "")} className="block text-xs text-red-500 hover:text-red-600">Supprimer le logo</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Colors */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Couleur principale</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={settings.primaryColor || "#ea580c"} onChange={e => updateField("primaryColor", e.target.value)} className="w-10 h-9 rounded cursor-pointer border-0" />
                    <Input value={settings.primaryColor || ""} onChange={e => updateField("primaryColor", e.target.value)} placeholder="#ea580c" className="dark:bg-gray-800 dark:border-gray-600 flex-1" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Utilisée pour les boutons et accents principaux</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Couleur secondaire</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={settings.secondaryColor || "#dc2626"} onChange={e => updateField("secondaryColor", e.target.value)} className="w-10 h-9 rounded cursor-pointer border-0" />
                    <Input value={settings.secondaryColor || ""} onChange={e => updateField("secondaryColor", e.target.value)} placeholder="#dc2626" className="dark:bg-gray-800 dark:border-gray-600 flex-1" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">Utilisée pour les dégradés et éléments secondaires</p>
                </div>
              </div>

              {/* Color preview */}
              <div className="p-3 rounded-lg border dark:border-gray-600">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Aperçu des couleurs</p>
                <div className="flex items-center gap-2">
                  <div className="h-8 rounded-lg flex-1" style={{ backgroundColor: settings.primaryColor || "#ea580c" }} />
                  <span className="text-xs text-gray-400">→</span>
                  <div className="h-8 rounded-lg flex-1" style={{ background: `linear-gradient(to right, ${settings.primaryColor || "#ea580c"}, ${settings.secondaryColor || "#dc2626"})` }} />
                  <span className="text-xs text-gray-400">→</span>
                  <div className="h-8 rounded-lg flex-1" style={{ backgroundColor: settings.secondaryColor || "#dc2626" }} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "delivery" && (
          <Card className="dark:border-gray-700">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Truck className="w-4 h-4 text-orange-500" />Paramètres de livraison</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Frais de livraison (GNF)</label>
                  <Input type="number" value={settings.deliveryFee || ""} onChange={e => updateField("deliveryFee", parseInt(e.target.value) || 0)} placeholder="5000" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Minimum de commande (GNF)</label>
                  <Input type="number" value={settings.minDelivery || ""} onChange={e => updateField("minDelivery", parseInt(e.target.value) || 0)} placeholder="15000" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Zones de livraison (séparées par :)</label>
                  <Input value={settings.deliveryZones || ""} onChange={e => updateField("deliveryZones", e.target.value)} placeholder="Kaloum:Dixinn:Matam:Matoto" className="dark:bg-gray-800 dark:border-gray-600" />
                  <p className="text-[10px] text-gray-400 mt-0.5">Exemple : Kaloum:Dixinn:Matam:Matoto</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Rayon de livraison (km)</label>
                  <Input type="number" min={1} max={100} value={(settings as any).deliveryRadiusKm || 10} onChange={e => updateField("deliveryRadiusKm" as any, parseInt(e.target.value) || 10)} placeholder="10" className="dark:bg-gray-800 dark:border-gray-600" />
                  <p className="text-[10px] text-gray-400 mt-0.5">Distance max pour l'assignation des livreurs</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Taux de fidélité (pts / 1000 GNF)</label>
                  <Input type="number" min={0} max={100} value={(settings as any).loyaltyPointsRate || 1} onChange={e => updateField("loyaltyPointsRate" as any, parseInt(e.target.value) || 1)} placeholder="1" className="dark:bg-gray-800 dark:border-gray-600" />
                  <p className="text-[10px] text-gray-400 mt-0.5">1 pt / 1000 GNF = standard. 2 pts = promo x2</p>
                </div>
              </div>
              {/* Zones preview */}
              {settings.deliveryZones && (
                <div className="flex flex-wrap gap-1.5">
                  {settings.deliveryZones.split(":").map((zone, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">{zone.trim()}</span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeSection === "billing" && (
          <Card className="dark:border-gray-700">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Receipt className="w-4 h-4 text-orange-500" />Facturation & Monnaie</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Taux de taxe (%)</label>
                  <Input type="number" step="0.1" value={settings.taxRate || ""} onChange={e => updateField("taxRate", parseFloat(e.target.value) || 0)} placeholder="15" className="dark:bg-gray-800 dark:border-gray-600" />
                  <p className="text-[10px] text-gray-400 mt-0.5">Pourcentage appliqué aux factures et devis</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Devise</label>
                  <select
                    value={settings.currency || "GNF"}
                    onChange={e => updateField("currency", e.target.value)}
                    className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm dark:text-gray-100"
                  >
                    <option value="GNF">GNF - Franc guinéen</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="USD">USD - Dollar américain</option>
                    <option value="XOF">XOF - Franc CFA</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "social" && (
          <Card className="dark:border-gray-700">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Globe className="w-4 h-4 text-orange-500" />Réseaux sociaux</h3>
              <div className="grid sm:grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Facebook</label>
                  <Input value={settings.facebook || ""} onChange={e => updateField("facebook", e.target.value)} placeholder="https://facebook.com/kfmdelice" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Instagram</label>
                  <Input value={settings.instagram || ""} onChange={e => updateField("instagram", e.target.value)} placeholder="https://instagram.com/kfmdelice" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Twitter / X</label>
                  <Input value={settings.twitter || ""} onChange={e => updateField("twitter", e.target.value)} placeholder="https://twitter.com/kfmdelice" className="dark:bg-gray-800 dark:border-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 🔔 Mission P1.1 — Sound notifications (per-device, no DB) */}
        {activeSection === "sounds" && <SoundPreferencesSection />}

        {/* 🏆 Mission P3.8 — Loyalty tiers configuration */}
        {activeSection === "tiers" && <LoyaltyTiersSection apiFetch={apiFetch} />}

        {activeSection === "roles" && <RolesAndPrivileges admins={admins} />}
      </motion.div>

      {/* Unsaved changes indicator */}
      {hasChanges && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-4 right-4 z-50">
          <div className="bg-orange-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Modifications non enregistrées
            <Button onClick={handleSave} disabled={saving} size="sm" className="ml-2 bg-white text-orange-600 hover:bg-orange-50 rounded-lg">
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {saving ? "..." : "Sauvegarder"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// RolesAndPrivileges — visualizes the 8 admin roles, the permission
// matrix per module, the 15 staff roles, and how many admins are
// currently assigned to each role.
//
// Notes:
// - The permission matrix below MUST stay in sync with the
//   `rolesMap` in `src/components/AdminDashboard.tsx` and the
//   `PERMISSION_GROUPS` in `src/lib/auth.ts`. If you add a new
//   module or role, update all three places.
// - Read-only display — actual permission changes are made by
//   editing `PERMISSION_GROUPS` in `src/lib/auth.ts` and
//   redeploying. This is intentional: per-tenant permission
//   overrides would require schema changes (a future enhancement).
// ────────────────────────────────────────────────────────────────

interface RolesAndPrivilegesProps {
  admins: AdminDB[];
}

// Sidebar module → which roles can see it (mirror of rolesMap in AdminDashboard.tsx)
const SIDEBAR_MODULES: Array<{ id: string; label: string; roles: string[] }> = [
  { id: "overview", label: "Vue d'ensemble", roles: ["admin", "manager", "accountant"] },
  { id: "reservations", label: "Réservations", roles: ["admin", "manager", "staff", "host"] },
  { id: "orders", label: "Commandes", roles: ["admin", "manager", "staff", "cashier", "kitchen", "delivery_manager"] },
  { id: "menu", label: "Menu", roles: ["admin", "manager", "kitchen"] },
  { id: "deliveries", label: "Livraisons", roles: ["admin", "manager", "staff", "delivery_manager"] },
  { id: "drivers", label: "Livreurs", roles: ["admin", "manager", "delivery_manager"] },
  { id: "reviews", label: "Avis", roles: ["admin", "manager", "staff"] },
  { id: "staff", label: "Personnel", roles: ["admin", "manager"] },
  { id: "customers", label: "Clients", roles: ["admin", "manager", "cashier"] },
  { id: "admins", label: "Utilisateurs", roles: ["admin"] },
  { id: "invoices", label: "Factures", roles: ["admin", "manager", "cashier", "accountant"] },
  { id: "quotes", label: "Devis", roles: ["admin", "manager", "accountant"] },
  { id: "expenses", label: "Dépenses", roles: ["admin", "manager", "accountant"] },
  { id: "inventory", label: "Stock", roles: ["admin", "manager", "kitchen"] },
  { id: "payments", label: "Paiements", roles: ["admin", "manager", "cashier", "accountant"] },
  { id: "pos", label: "Caisse POS", roles: ["admin", "manager", "staff", "cashier"] },
  { id: "settings", label: "Paramètres", roles: ["admin", "manager"] },
];

// Action-level permissions (mirror of PERMISSION_GROUPS in src/lib/auth.ts)
const ACTION_PERMISSIONS: Array<{ id: string; label: string; roles: string[] }> = [
  { id: "ADMINS_MANAGE", label: "Créer / modifier les utilisateurs admin", roles: ["admin"] },
  { id: "CUSTOMERS_MANAGE", label: "Créer / modifier les clients", roles: ["admin"] },
  { id: "CUSTOMERS_READ", label: "Consulter la liste clients", roles: ["admin", "manager", "cashier"] },
  { id: "MENU_MANAGE", label: "Modifier le menu", roles: ["admin", "manager"] },
  { id: "MENU_READ", label: "Consulter le menu / recettes", roles: ["admin", "manager", "kitchen", "staff"] },
  { id: "STAFF_MANAGE", label: "Gérer le personnel", roles: ["admin", "manager"] },
  { id: "DRIVERS_MANAGE", label: "Gérer les livreurs", roles: ["admin", "manager", "delivery_manager"] },
  { id: "STOCK_MANAGE", label: "Gérer le stock", roles: ["admin", "manager"] },
  { id: "STOCK_READ", label: "Consulter le stock", roles: ["admin", "manager", "staff", "kitchen"] },
  { id: "LOYALTY_MANAGE", label: "Gérer la fidélité", roles: ["admin", "manager"] },
  { id: "LOYALTY_DELETE", label: "Supprimer points fidélité", roles: ["admin"] },
  { id: "INVOICES_MANAGE", label: "Gérer les factures", roles: ["admin", "manager", "cashier", "accountant"] },
  { id: "QUOTES_MANAGE", label: "Gérer les devis", roles: ["admin", "manager", "accountant"] },
  { id: "EXPENSES_MANAGE", label: "Gérer les dépenses", roles: ["admin", "manager", "accountant"] },
  { id: "PAYMENTS_MANAGE", label: "Gérer les paiements", roles: ["admin", "manager", "cashier", "accountant"] },
  { id: "ANALYTICS_READ", label: "Consulter les analytiques", roles: ["admin", "manager", "accountant"] },
  { id: "ORDERS_WRITE", label: "Modifier les commandes", roles: ["admin", "manager", "staff", "cashier", "kitchen", "delivery_manager"] },
  { id: "RESERVATIONS_WRITE", label: "Modifier les réservations", roles: ["admin", "manager", "staff", "host"] },
  { id: "KITCHEN_DISPLAY", label: "Affichage cuisine (KDS) + actions préparation", roles: ["admin", "manager", "staff", "kitchen"] },
  { id: "REVIEWS_MANAGE", label: "Gérer les avis", roles: ["admin", "manager"] },
  { id: "EMAIL_SEND", label: "Envoyer des emails", roles: ["admin", "manager"] },
  { id: "PUSH_SEND", label: "Envoyer des notifications push", roles: ["admin", "manager"] },
  { id: "DASHBOARD_VIEW", label: "Voir le tableau de bord", roles: ["admin", "manager"] },
  { id: "SEED_RUN", label: "Réinitialiser les données (seed)", roles: ["admin"] },
];

// Human-readable description per admin role
const ADMIN_ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Super Admin restaurant — accès complet à toutes les fonctionnalités, y compris la gestion des utilisateurs et la réinitialisation des données.",
  manager: "Gérant adjoint — gestion opérationnelle (menu, personnel, livreurs, finances) mais ne peut pas gérer les comptes admin ni réinitialiser les données.",
  staff: "Personnel polyvalent — commandes, réservations, cuisine, caisse POS et avis. Pas d'accès aux finances ni à la configuration.",
  cashier: "Caissier — caisse POS, paiements, factures et consultation des clients. Pas d'accès aux opérations cuisine ni livraison.",
  kitchen: "Chef Cuisine — affichage cuisine (KDS), statut des commandes, consultation du stock. Pas d'accès aux paiements ni aux clients.",
  delivery_manager: "Responsable Livraison — gestion des livreurs, suivi des livraisons et mise à jour des commandes en cours.",
  host: "Hôte d'Accueil — gestion des réservations uniquement. Aucun autre accès opérationnel.",
  accountant: "Comptable — factures, devis, dépenses, paiements et analytiques. Aucun accès aux opérations (cuisine, livraisons, caisse).",
};

// Human-readable description per staff role (kitchen/service personnel — no login)
const STAFF_ROLE_DESCRIPTIONS: Record<string, string> = {
  cuisinier: "Prépare les plats principaux du menu.",
  commis: "Assiste le cuisinier — préparations, mise en place.",
  patissier: "Prépare les desserts et pâtisseries.",
  serveur: "Accueille les clients, prend les commandes, sert les plats.",
  barman: "Prépare les boissons et cocktails.",
  sommelier: "Conseille les clients sur les vins et accords mets-vins.",
  receptionniste: "Accueille les clients à l'entrée, gère les réservations.",
  gerant: "Supervise l'équipe et les opérations (poste staff, pas un compte admin).",
  caissier: "Encaisse les paiements à la caisse (poste staff).",
  plongeur: "Nettoie la vaisselle et la cuisine.",
  securite: "Assure la sécurité du restaurant et des clients.",
  voiturier: "Gare les véhicules des clients.",
  maintenance: "Entretient les équipements et les locaux.",
  dj: "Anime la musique pendant le service.",
  animateur: "Anime les soirées et événements.",
};

function RolesAndPrivileges({ admins }: RolesAndPrivilegesProps) {
  // Count admins per role
  const adminCountByRole: Record<string, number> = {};
  for (const role of adminRoleOrder) {
    adminCountByRole[role] = admins.filter(a => a.role === role).length;
  }
  const totalAdmins = admins.length;

  // Render a ✓ or — cell for a (module, role) pair
  const cell = (roles: string[], role: string) =>
    roles.includes(role) ? (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold">✓</span>
    ) : (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 text-xs">—</span>
    );

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="dark:border-gray-700 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/10 dark:to-red-900/10">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">Gestion des Rôles & Privilèges</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Le système supporte <strong>8 rôles administrateurs</strong> (comptes avec connexion au tableau de bord) et <strong>15 rôles de personnel</strong> (postes kitchen/service sans compte login).
                Les privilèges sont définis dans le code (<code className="text-xs px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">src/lib/auth.ts → PERMISSION_GROUPS</code>) et appliqués côté API.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-gray-800 rounded-full border dark:border-gray-600">
                  <Users2 className="w-3.5 h-3.5 text-orange-500" />
                  <strong className="text-gray-900 dark:text-gray-100">{totalAdmins}</strong>
                  <span className="text-gray-500 dark:text-gray-400">compte{totalAdmins > 1 ? "s" : ""} admin</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-gray-800 rounded-full border dark:border-gray-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  <strong className="text-gray-900 dark:text-gray-100">{adminCountByRole.admin || 0}</strong>
                  <span className="text-gray-500 dark:text-gray-400">super admin</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-gray-800 rounded-full border dark:border-gray-600">
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  <strong className="text-gray-900 dark:text-gray-100">{Object.values(adminCountByRole).reduce((s, n) => s + n, 0) - (adminCountByRole.admin || 0)}</strong>
                  <span className="text-gray-500 dark:text-gray-400">autre rôle</span>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin roles overview cards */}
      <Card className="dark:border-gray-700">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Users2 className="w-4 h-4 text-orange-500" />
            Rôles Administrateurs ({adminRoleOrder.length})
          </h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {adminRoleOrder.map(role => (
              <div
                key={role}
                className={`p-3 rounded-xl border dark:border-gray-700 ${role === "admin" ? "bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800" : "bg-gray-50 dark:bg-gray-800/50"}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Badge className={`text-xs ${adminRoleColors[role]}`}>{adminRoleLabels[role]}</Badge>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {adminCountByRole[role] || 0} <span className="font-normal">compte{(adminCountByRole[role] || 0) > 1 ? "s" : ""}</span>
                  </span>
                </div>
                <p className="text-[11px] leading-snug text-gray-600 dark:text-gray-400">
                  {ADMIN_ROLE_DESCRIPTIONS[role] || "—"}
                </p>
                <p className="mt-2 text-[10px] font-mono text-gray-400 dark:text-gray-500">{role}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sidebar module visibility matrix */}
      <Card className="dark:border-gray-700">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Users2 className="w-4 h-4 text-orange-500" />
            Visibilité des modules du menu latéral
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Cocher ✓ = le rôle voit ce module dans son menu latéral. La liste reflète la configuration dans
            <code className="text-[10px] px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded mx-1">AdminDashboard.tsx → rolesMap</code>.
          </p>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-2 px-2 sticky left-0 bg-white dark:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300">Module</th>
                  {adminRoleOrder.map(role => (
                    <th key={role} className="py-2 px-1 min-w-[60px] text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge className={`text-[9px] leading-none px-1.5 py-0.5 ${adminRoleColors[role]}`}>{adminRoleLabels[role]}</Badge>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SIDEBAR_MODULES.map(mod => (
                  <tr key={mod.id} className="border-b dark:border-gray-700 hover:bg-orange-50/40 dark:hover:bg-orange-900/10">
                    <td className="py-1.5 px-2 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800">{mod.label}</td>
                    {adminRoleOrder.map(role => (
                      <td key={role} className="py-1.5 px-1 text-center">{cell(mod.roles, role)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action-level permission matrix */}
      <Card className="dark:border-gray-700">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-orange-500" />
            Privilèges d'action (API & opérations)
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Privilèges applicés côté API via
            <code className="text-[10px] px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded mx-1">hasRole(admin.role, PERMISSION_GROUPS.X)</code>.
            Toute tentative d'appel API hors privilège renvoie <strong>403 Forbidden</strong>.
          </p>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-2 px-2 sticky left-0 bg-white dark:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300">Action</th>
                  {adminRoleOrder.map(role => (
                    <th key={role} className="py-2 px-1 min-w-[60px] text-center">
                      <Badge className={`text-[9px] leading-none px-1.5 py-0.5 ${adminRoleColors[role]}`}>{adminRoleLabels[role]}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACTION_PERMISSIONS.map(perm => (
                  <tr key={perm.id} className="border-b dark:border-gray-700 hover:bg-orange-50/40 dark:hover:bg-orange-900/10">
                    <td className="py-1.5 px-2 text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800">
                      <div className="font-medium">{perm.label}</div>
                      <div className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{perm.id}</div>
                    </td>
                    {adminRoleOrder.map(role => (
                      <td key={role} className="py-1.5 px-1 text-center">{cell(perm.roles, role)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Staff roles overview (no login) */}
      <Card className="dark:border-gray-700">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Users2 className="w-4 h-4 text-orange-500" />
            Rôles de Personnel ({Object.keys(staffRoleLabels).length})
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ces rôles correspondent à des <strong>postes de travail</strong> (cuisine, service, support, animation)
            et ne disposent <strong>pas de compte de connexion</strong>. Ils sont gérés via l'onglet « Personnel ».
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(staffRoleLabels).map(([role, label]) => (
              <div key={role} className="p-3 rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between mb-1">
                  <Badge className={`text-xs ${staffRoleColors[role]}`}>{label}</Badge>
                  <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{role}</span>
                </div>
                <p className="text-[11px] leading-snug text-gray-600 dark:text-gray-400">
                  {STAFF_ROLE_DESCRIPTIONS[role] || "—"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration note */}
      <Card className="dark:border-gray-700 bg-amber-50/40 dark:bg-amber-900/5 border-amber-200 dark:border-amber-800/50">
        <CardContent className="p-4 sm:p-6 space-y-2">
          <h4 className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-2 text-sm">
            <ShieldCheck className="w-4 h-4" />
            Comment modifier les privilèges
          </h4>
          <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
            Les privilèges sont volontairement définis dans le code source (et non en base de données) pour des raisons
            de sécurité et de cohérence. Pour ajouter, modifier ou supprimer un privilège :
          </p>
          <ol className="text-xs text-amber-800 dark:text-amber-400 space-y-1 list-decimal list-inside ml-2">
            <li>Modifiez <code className="text-[10px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded">src/lib/auth.ts → PERMISSION_GROUPS</code> pour les privilèges API.</li>
            <li>Modifiez <code className="text-[10px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded">src/components/AdminDashboard.tsx → rolesMap</code> pour la visibilité du menu.</li>
            <li>Ajoutez le rôle à <code className="text-[10px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded">ADMIN_ROLES</code> et à <code className="text-[10px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded">adminRoleLabels</code> dans <code className="text-[10px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded">src/lib/constants.ts</code>.</li>
            <li>Effectuez un commit et redéployez — les changements s'appliquent à toutes les sessions actives.</li>
          </ol>
          <p className="text-[11px] text-amber-700 dark:text-amber-500 italic mt-2">
            Pour une personnalisation par restaurant (chaque tenant définit ses propres privilèges), une migration de schéma Prisma serait nécessaire — fonctionnalité prévue pour une version ultérieure.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 🔔 Mission P1.1 — Sound Preferences Section
//
// Per-device preferences stored in localStorage (no DB migration).
// This lets the kitchen tablet have sound ON while the manager's
// laptop has it OFF, even if both are logged into the same restaurant.
// ────────────────────────────────────────────────────────────────

// Type alias for the sound preferences hook return value.
// We define it explicitly here (rather than importing from src/lib/sound)
// to keep the dynamic import pattern clean — the sound module uses
// `window` and `AudioContext` which are browser-only, so we lazy-load
// it only on the client side.
interface SoundPrefsHook {
  prefs: {
    enabled: boolean;
    volume: number;
    newOrder: boolean;
    orderReady: boolean;
    statusChange: boolean;
    alert: boolean;
  };
  update: (partial: Partial<{
    enabled: boolean;
    volume: number;
    newOrder: boolean;
    orderReady: boolean;
    statusChange: boolean;
    alert: boolean;
  }>) => void;
  test: (type: "new-order" | "order-ready" | "status-change" | "alert") => void;
}

function SoundPreferencesSection() {
  // Lazy import to avoid loading the sound module on the server
  // (it uses `window` and `AudioContext` which are browser-only).
  const [soundHook, setSoundHook] = useState<SoundPrefsHook | null>(null);

  // Dynamic import pattern: load the sound hook only on the client
  useEffect(() => {
    let cancelled = false;
    import("@/lib/sound").then((mod) => {
      if (!cancelled) setSoundHook(mod.useSoundPreferences());
    });
    return () => { cancelled = true; };
  }, []);

  if (!soundHook) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-gray-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Chargement des préférences sonores…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { prefs, update, test } = soundHook;

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardContent className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Bell className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Notifications sonores
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Alertes sonores pour les nouvelles commandes et changements de statut.
                Préférences enregistrées sur cet appareil (par tablette/laptop).
              </p>
            </div>
          </div>
          {prefs.enabled ? (
            <Volume2 className="w-6 h-6 text-green-500" />
          ) : (
            <VolumeX className="w-6 h-6 text-gray-400" />
          )}
        </div>

        {/* Master toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              Activer les notifications sonores
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Coupe tous les sons si désactivé (priorité maximale)
            </p>
          </div>
          <button
            onClick={() => update({ enabled: !prefs.enabled })}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              prefs.enabled ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
            }`}
            role="switch"
            aria-checked={prefs.enabled}
            aria-label="Activer les notifications sonores"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                prefs.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Volume slider */}
        <div className={prefs.enabled ? "" : "opacity-50 pointer-events-none"}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Volume
            </label>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              {Math.round(prefs.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(prefs.volume * 100)}
            onChange={(e) => update({ volume: parseInt(e.target.value, 10) / 100 })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            aria-label="Volume des notifications sonores"
          />
        </div>

        {/* Per-event toggles */}
        <div className={`space-y-3 ${prefs.enabled ? "" : "opacity-50 pointer-events-none"}`}>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Événements sonores
          </p>
          {[
            {
              key: "newOrder" as const,
              label: "Nouvelle commande",
              desc: "Bip urgent quand une commande arrive en cuisine ou au dashboard",
              sound: "new-order" as const,
            },
            {
              key: "orderReady" as const,
              label: "Commande prête",
              desc: "Carillon quand un plat passe en statut « prêt à servir »",
              sound: "order-ready" as const,
            },
            {
              key: "statusChange" as const,
              label: "Changement de statut",
              desc: "Clic discret quand une commande change de statut",
              sound: "status-change" as const,
            },
            {
              key: "alert" as const,
              label: "Alerte temps écoulé",
              desc: "Bips descendants quand une commande dépasse 20 min d'attente",
              sound: "alert" as const,
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
            >
              <div className="flex-1 min-w-0 pr-3">
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  {item.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {item.desc}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => test(item.sound)}
                  className="h-8 px-2 text-xs dark:border-gray-600"
                  title="Tester ce son"
                >
                  <Play className="w-3 h-3 mr-1" /> Tester
                </Button>
                <button
                  onClick={() => update({ [item.key]: !prefs[item.key] } as Partial<typeof prefs>)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    prefs[item.key] ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                  role="switch"
                  aria-checked={prefs[item.key]}
                  aria-label={`Activer: ${item.label}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      prefs[item.key] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Test all sounds */}
        <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={() => test("new-order")}
            className="flex-1 dark:border-gray-600"
            size="sm"
          >
            <Play className="w-4 h-4 mr-2" /> Tester nouvelle commande
          </Button>
          <Button
            variant="outline"
            onClick={() => test("order-ready")}
            className="flex-1 dark:border-gray-600"
            size="sm"
          >
            <Play className="w-4 h-4 mr-2" /> Tester prêt
          </Button>
        </div>

        {/* Info note */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            <strong>Note :</strong> Les navigateurs bloquent le son jusqu'à ce que vous
            interagissiez avec la page (clic ou touche). Si aucun son ne sort, cliquez
            n'importe où sur le dashboard puis réessayez. Les préférences sont propres à
            cet appareil — la tablette cuisine et le laptop du manager peuvent avoir des
            réglages différents.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// 🏆 Mission P3.8 — Loyalty Tiers Configuration Section
//
// Lets the admin configure the loyalty tiers (Bronze, Silver, Gold,
// Platinum) for their restaurant. Each tier defines:
//   - minSpent: minimum totalSpent to reach this tier
//   - discountPercent: % discount on all orders
//   - freeDelivery: free delivery for this tier
//   - freeDish: free dish per month
//   - color + icon: UI customization
// ────────────────────────────────────────────────────────────────

interface LoyaltyTier {
  id?: string;
  name: string;
  label: string;
  minSpent: number;
  discountPercent: number;
  freeDelivery: boolean;
  freeDish: boolean;
  color: string;
  icon: string;
  active: boolean;
}

function LoyaltyTiersSection({ apiFetch }: { apiFetch: (url: string, options?: RequestInit) => Promise<Response> }) {
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/loyalty/tiers");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          setTiers(data.data);
        }
      }
    } catch {
      notify.error("Erreur de chargement des paliers");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/loyalty/tiers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers }),
      });
      if (res.ok) {
        notify.success("Paliers enregistrés avec succès");
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        notify.error(data.error || "Erreur lors de l'enregistrement");
      }
    } catch {
      notify.error("Erreur réseau");
    } finally {
      setSaving(false);
    }
  };

  const updateTier = (index: number, field: keyof LoyaltyTier, value: unknown) => {
    setTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  if (loading) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-gray-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Chargement des paliers…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Paliers de fidélité
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configurez les paliers et leurs avantages. Les clients sont automatiquement promus selon leurs dépenses cumulées.
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </div>

        {/* Tiers list */}
        <div className="space-y-3">
          {tiers.map((tier, index) => (
            <div
              key={tier.name}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                  style={{ backgroundColor: tier.color + "33", border: `2px solid ${tier.color}` }}
                >
                  {tier.icon || "🏆"}
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={tier.label}
                    onChange={(e) => updateTier(index, "label", e.target.value)}
                    className="font-bold text-gray-900 dark:text-gray-100 bg-transparent border-none outline-none w-full"
                    placeholder="Nom du palier"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{tier.name}</p>
                </div>
                <button
                  onClick={() => updateTier(index, "active", !tier.active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    tier.active ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                  role="switch"
                  aria-checked={tier.active}
                  aria-label={`Activer ${tier.label}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    tier.active ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Dépenses min. (GNF)</label>
                  <Input
                    type="number"
                    min={0}
                    value={tier.minSpent}
                    onChange={(e) => updateTier(index, "minSpent", parseInt(e.target.value, 10) || 0)}
                    className="text-sm dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Remise (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={tier.discountPercent}
                    onChange={(e) => updateTier(index, "discountPercent", parseInt(e.target.value, 10) || 0)}
                    className="text-sm dark:bg-gray-800 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Couleur</label>
                  <input
                    type="color"
                    value={tier.color}
                    onChange={(e) => updateTier(index, "color", e.target.value)}
                    className="w-full h-9 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Icône (emoji)</label>
                  <Input
                    type="text"
                    value={tier.icon}
                    onChange={(e) => updateTier(index, "icon", e.target.value)}
                    maxLength={4}
                    className="text-sm dark:bg-gray-800 dark:border-gray-600"
                    placeholder="🥇"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tier.freeDelivery}
                    onChange={(e) => updateTier(index, "freeDelivery", e.target.checked)}
                    className="rounded"
                  />
                  Livraison gratuite
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tier.freeDish}
                    onChange={(e) => updateTier(index, "freeDish", e.target.checked)}
                    className="rounded"
                  />
                  Plat gratuit / mois
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            <strong>Comment ça marche :</strong> Quand une commande est livrée, le total dépensé du client augmente.
            Si le client dépasse le seuil d'un palier, il est automatiquement promu. La remise du palier est appliquée
            à ses prochaines commandes. Les paliers sont propres à ce restaurant (multi-tenant).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
