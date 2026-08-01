"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Phone, Mail, MapPin, RefreshCw, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/lib/notifications";

interface Supplier {
  id: string; name: string; contactName: string; phone: string;
  email: string; address: string; category: string; notes: string;
}

export function SuppliersTab() {
  const { apiFetch } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", contactName: "", phone: "", email: "", address: "", category: "general", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/suppliers");
      if (res.ok) { const d = await res.json(); setSuppliers(d.data || []); }
    } catch { notify.error("Erreur de chargement"); }
    finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ name: "", contactName: "", phone: "", email: "", address: "", category: "general", notes: "" }); setDialogOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm({ name: s.name, contactName: s.contactName, phone: s.phone, email: s.email, address: s.address, category: s.category, notes: s.notes }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { notify.error("Nom requis"); return; }
    try {
      if (editing) {
        const res = await apiFetch(`/api/suppliers/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        if (!res.ok) throw new Error();
        notify.success("Fournisseur modifié");
      } else {
        const res = await apiFetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        if (!res.ok) throw new Error();
        notify.success("Fournisseur créé");
      }
      setDialogOpen(false); load();
    } catch { notify.error("Erreur"); }
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Supprimer "${s.name}" ?`)) return;
    try { await apiFetch(`/api/suppliers/${s.id}`, { method: "DELETE" }); notify.success("Supprimé"); load(); }
    catch { notify.error("Erreur"); }
  };

  const categoryColors: Record<string, string> = { ingredients: "bg-green-100 text-green-700", drinks: "bg-blue-100 text-blue-700", packaging: "bg-orange-100 text-orange-700", equipment: "bg-purple-100 text-purple-700", general: "bg-gray-100 text-gray-700" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Truck className="w-5 h-5 text-orange-500" /> Fournisseurs</h2>
        <Button onClick={openCreate} className="bg-orange-500 text-white"><Plus className="w-4 h-4 mr-2" /> Nouveau</Button>
      </div>
      {loading ? <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 text-orange-500 animate-spin" /></div> :
       suppliers.length === 0 ? <Card className="dark:bg-gray-800"><CardContent className="py-8 text-center text-gray-400">Aucun fournisseur. Cliquez sur "Nouveau" pour en ajouter un.</CardContent></Card> :
       <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
         {suppliers.map(s => (
           <Card key={s.id} className="dark:bg-gray-800 dark:border-gray-700">
             <CardContent className="p-4">
               <div className="flex items-start justify-between mb-2">
                 <div><h3 className="font-bold text-gray-900 dark:text-white">{s.name}</h3>
                 {s.contactName && <p className="text-xs text-gray-500">{s.contactName}</p>}</div>
                 <Badge className={categoryColors[s.category] || categoryColors.general}>{s.category}</Badge>
               </div>
               <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                 {s.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {s.phone}</p>}
                 {s.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" /> {s.email}</p>}
                 {s.address && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.address}</p>}
               </div>
               <div className="flex gap-1 mt-3">
                 <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="flex-1 text-xs"><Pencil className="w-3 h-3 mr-1" /> Éditer</Button>
                 <Button size="sm" variant="ghost" onClick={() => handleDelete(s)} className="text-red-600 text-xs"><Trash2 className="w-3 h-3" /></Button>
               </div>
             </CardContent>
           </Card>
         ))}
       </div>}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} fournisseur</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div><Label>Nom *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><Label>Contact</Label><Input value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} /></div>
            <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div className="col-span-2"><Label>Adresse</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            <div><Label>Catégorie</Label><select className="w-full px-3 py-2 rounded-lg border dark:bg-gray-800 dark:border-gray-600" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              <option value="general">Général</option><option value="ingredients">Ingrédients</option><option value="drinks">Boissons</option><option value="packaging">Emballages</option><option value="equipment">Équipement</option>
            </select></div>
            <div className="col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button><Button onClick={handleSave} className="bg-orange-500 text-white">Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
