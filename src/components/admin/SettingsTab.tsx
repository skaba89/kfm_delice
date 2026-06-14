"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Settings, Store, Phone, MapPin, Clock, Image, Palette,
  Truck, Receipt, Globe, Save, RefreshCw, Upload, Check,
} from "lucide-react";
import type { RestaurantDB } from "@/lib/types";
import { notify } from "@/lib/notifications";

export interface SettingsTabProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  apiPatch: (url: string, body: object) => Promise<{ success: boolean; error?: string }>;
  apiPut: (url: string, body: object) => Promise<{ success: boolean; error?: string }>;
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

export function SettingsTab({ apiFetch, apiPatch, apiPut }: SettingsTabProps) {
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
        "deliveryZones", "logo", "primaryColor", "secondaryColor",
        "taxRate", "currency", "facebook", "instagram", "twitter",
        "latitude", "longitude",
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
                      <img src={settings.logo} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
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
