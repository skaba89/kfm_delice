"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package, AlertTriangle, XCircle, Plus, Search, TrendingDown,
  TrendingUp, Edit2, Trash2, ArrowDownToLine, ArrowUpFromLine,
  RotateCcw, X, History, Boxes, DollarSign,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notifications";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/constants";

interface StockItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  minThreshold: number;
  unitCost: number;
  supplier: string;
  lastRestocked: string;
  notes: string;
  status: "ok" | "low" | "out";
  _count?: { movements: number };
}

interface StockMovement {
  id: string;
  stockItemId: string;
  type: "in" | "out" | "adjust" | "waste";
  quantity: number;
  reason: string;
  actor: string;
  createdAt: string;
  stockItem?: { name: string; unit: string };
}

interface StockSummary {
  totalItems: number;
  totalValue: number;
  lowCount: number;
  outCount: number;
}

const CATEGORIES = [
  { id: "general", label: "Général" },
  { id: "ingredients", label: "Ingrédients" },
  { id: "drinks", label: "Boissons" },
  { id: "packaging", label: "Emballages" },
  { id: "cleaning", label: "Entretien" },
  { id: "equipment", label: "Équipement" },
];

const UNITS = ["unité", "kg", "g", "L", "mL", "bouteille", "sac", "carton", "boîte"];

const MOVEMENT_LABELS: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
  in: { label: "Entrée", color: "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400", icon: ArrowDownToLine },
  out: { label: "Sortie", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400", icon: ArrowUpFromLine },
  adjust: { label: "Ajustement", color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400", icon: RotateCcw },
  waste: { label: "Perte/Casse", color: "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400", icon: XCircle },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ok: { label: "En stock", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  low: { label: "Stock bas", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  out: { label: "Rupture", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

export function InventoryTab() {
  const { apiFetch } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [summary, setSummary] = useState<StockSummary>({ totalItems: 0, totalValue: 0, lowCount: 0, outCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Form modal state
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [form, setForm] = useState({
    name: "", sku: "", category: "ingredients", quantity: 0,
    unit: "unité", minThreshold: 0, unitCost: 0, supplier: "", notes: "",
  });

  // Movement modal state
  const [movementModal, setMovementModal] = useState<StockItem | null>(null);
  const [movementForm, setMovementForm] = useState({
    type: "in" as "in" | "out" | "adjust" | "waste",
    quantity: 0, reason: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set("category", categoryFilter);
      if (showLowOnly) params.set("lowStock", "1");
      const res = await apiFetch(`/api/stock?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setMovements(data.movements || []);
        setSummary(data.summary || { totalItems: 0, totalValue: 0, lowCount: 0, outCount: 0 });
      }
    } catch (e) {
      console.error("[stock load]", e);
      notify.error("Erreur de chargement du stock");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, categoryFilter, showLowOnly]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((it) =>
    !search ||
    it.name.toLowerCase().includes(search.toLowerCase()) ||
    it.sku.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingItem(null);
    setForm({ name: "", sku: "", category: "ingredients", quantity: 0, unit: "unité", minThreshold: 0, unitCost: 0, supplier: "", notes: "" });
    setShowForm(true);
  };

  const openEdit = (item: StockItem) => {
    setEditingItem(item);
    setForm({
      name: item.name, sku: item.sku, category: item.category,
      quantity: item.quantity, unit: item.unit, minThreshold: item.minThreshold,
      unitCost: item.unitCost, supplier: item.supplier, notes: item.notes,
    });
    setShowForm(true);
  };

  const submitForm = async () => {
    if (!form.name.trim()) { notify.error("Nom requis"); return; }
    try {
      const res = await apiFetch("/api/stock", {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingItem ? { id: editingItem.id, ...form } : form),
      });
      if (res.ok) {
        notify.success(editingItem ? "Article mis à jour" : "Article créé");
        setShowForm(false);
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        notify.error(err.error || "Erreur");
      }
    } catch (e) {
      console.error(e);
      notify.error("Erreur réseau");
    }
  };

  const submitMovement = async () => {
    if (!movementModal) return;
    if (movementForm.quantity <= 0) { notify.error("Quantité invalide"); return; }
    try {
      const res = await apiFetch("/api/stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: movementModal.id,
          action: "movement",
          type: movementForm.type,
          quantity: movementForm.quantity,
          reason: movementForm.reason,
        }),
      });
      if (res.ok) {
        notify.success("Mouvement enregistré");
        setMovementModal(null);
        setMovementForm({ type: "in", quantity: 0, reason: "" });
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        notify.error(err.error || "Erreur");
      }
    } catch (e) {
      console.error(e);
      notify.error("Erreur réseau");
    }
  };

  const deleteItem = async (item: StockItem) => {
    if (!confirm(`Supprimer "${item.name}" ? Cette action est irréversible.`)) return;
    try {
      const res = await apiFetch(`/api/stock?id=${item.id}`, { method: "DELETE" });
      if (res.ok) {
        notify.success("Article supprimé");
        load();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Boxes className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Articles</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{summary.totalItems}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Valeur stock</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatPrice(summary.totalValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Stock bas</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{summary.lowCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Ruptures</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{summary.outCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Rechercher par nom ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <Button
          variant={showLowOnly ? "default" : "outline"}
          onClick={() => setShowLowOnly(!showLowOnly)}
          className={showLowOnly ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
        >
          <AlertTriangle className="w-4 h-4 mr-2" /> Stock bas
        </Button>
        <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>
          <History className="w-4 h-4 mr-2" /> Historique
        </Button>
        <Button onClick={openCreate} className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
          <Plus className="w-4 h-4 mr-2" /> Nouvel article
        </Button>
      </div>

      {/* Low stock alert banner */}
      {(summary.lowCount > 0 || summary.outCount > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              {summary.outCount > 0 && `${summary.outCount} article(s) en rupture. `}
              {summary.lowCount > 0 && `${summary.lowCount} article(s) en stock bas.`}
            </p>
            <p className="text-amber-700 dark:text-amber-400 mt-1">
              Pensez à réapprovisionner pour éviter les ruptures de service.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowLowOnly(true)}>
            Voir les articles
          </Button>
        </div>
      )}

      {/* Main content: either table or history */}
      {showHistory ? (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Historique des mouvements</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">50 derniers mouvements</p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {movements.length === 0 ? (
                <p className="p-8 text-center text-sm text-gray-500">Aucun mouvement</p>
              ) : movements.map((m) => {
                const M = MOVEMENT_LABELS[m.type];
                const Icon = M.icon;
                return (
                  <div key={m.id} className="p-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${M.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {m.stockItem?.name || "Article supprimé"} — {M.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {m.quantity} {m.stockItem?.unit || ""}
                        {m.reason && ` • ${m.reason}`}
                        {m.actor && ` • par ${m.actor}`}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(m.createdAt).toLocaleString("fr-FR")}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-8 text-center text-sm text-gray-500">Chargement...</p>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {items.length === 0 ? "Aucun article en stock. Cliquez sur \"Nouvel article\" pour commencer." : "Aucun article ne correspond à vos filtres."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Article</th>
                      <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300 hidden md:table-cell">Catégorie</th>
                      <th className="text-right p-3 font-medium text-gray-600 dark:text-gray-300">Quantité</th>
                      <th className="text-right p-3 font-medium text-gray-600 dark:text-gray-300 hidden lg:table-cell">Seuil mini</th>
                      <th className="text-right p-3 font-medium text-gray-600 dark:text-gray-300 hidden lg:table-cell">Coût/unité</th>
                      <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Statut</th>
                      <th className="text-right p-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map((it) => (
                      <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="p-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{it.name}</p>
                          {it.sku && <p className="text-xs text-gray-500">SKU: {it.sku}</p>}
                          {it.supplier && <p className="text-xs text-gray-400">{it.supplier}</p>}
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {CATEGORIES.find(c => c.id === it.category)?.label || it.category}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-medium text-gray-900 dark:text-gray-100">
                          {it.quantity} <span className="text-xs text-gray-500">{it.unit}</span>
                        </td>
                        <td className="p-3 text-right text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                          {it.minThreshold} <span className="text-xs">{it.unit}</span>
                        </td>
                        <td className="p-3 text-right text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                          {formatPrice(it.unitCost)}
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={`text-xs ${STATUS_LABELS[it.status].color}`}>
                            {STATUS_LABELS[it.status].label}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => setMovementModal(it)}
                              title="Mouvement de stock"
                              className="h-8 w-8 p-0"
                            >
                              <ArrowDownToLine className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => openEdit(it)}
                              title="Modifier"
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => deleteItem(it)}
                              title="Supprimer"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Form modal */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={editingItem ? "Modifier l'article" : "Nouvel article"}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nom *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Riz parfumé" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">SKU</label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="RIZ-001" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Catégorie</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                >
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantité initiale</label>
                <Input type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Unité</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Seuil minimum</label>
                <Input type="number" min="0" step="0.01" value={form.minThreshold} onChange={(e) => setForm({ ...form, minThreshold: Number(e.target.value) })} />
                <p className="text-[10px] text-gray-400 mt-0.5">Alerte si quantité ≤ seuil</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Coût unitaire (GNF)</label>
                <Input type="number" min="0" step="100" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fournisseur</label>
              <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Nom du fournisseur" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes internes" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white" onClick={submitForm}>
                {editingItem ? "Mettre à jour" : "Créer l'article"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Movement modal */}
      {movementModal && (
        <Modal onClose={() => setMovementModal(null)} title={`Mouvement — ${movementModal.name}`}>
          <div className="space-y-3">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 text-sm">
              <p className="text-gray-500 dark:text-gray-400">Stock actuel</p>
              <p className="font-bold text-gray-900 dark:text-gray-100">
                {movementModal.quantity} {movementModal.unit}
                <span className="ml-2 text-xs font-normal text-gray-500">Seuil: {movementModal.minThreshold} {movementModal.unit}</span>
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type de mouvement</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(MOVEMENT_LABELS).map(([type, info]) => {
                  const Icon = info.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => setMovementForm({ ...movementForm, type: type as typeof movementForm.type })}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition ${
                        movementForm.type === type
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {info.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {movementForm.type === "adjust" ? "Nouvelle quantité" : "Quantité"}
              </label>
              <Input
                type="number" min="0" step="0.01"
                value={movementForm.quantity}
                onChange={(e) => setMovementForm({ ...movementForm, quantity: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Raison</label>
              <Input
                value={movementForm.reason}
                onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                placeholder="Ex: Réappro hebdomadaire, Sortie cuisine, Casse..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setMovementModal(null)}>Annuler</Button>
              <Button className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white" onClick={submitMovement}>
                Enregistrer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
