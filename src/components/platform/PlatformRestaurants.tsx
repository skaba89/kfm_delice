"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UtensilsCrossed, Search, RefreshCw, Ban, CheckCircle2, Eye, Plus, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface RestaurantData {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  status: string;
  plan: string;
  type: string;
  phone: string;
  email: string;
  address: string;
  createdAt: string;
  accountId: string;
  config: { primaryColor: string; logo: string } | null;
  _count: { orders: number; customers: number; admins: number; menuItems: number };
}

export function PlatformRestaurants({ token }: { token: string }) {
  const [restaurants, setRestaurants] = useState<RestaurantData[]>([]);
  const [stats, setStats] = useState({ totalRestaurants: 0, activeRestaurants: 0, trialRestaurants: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [viewing, setViewing] = useState<RestaurantData | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    restaurantName: "",
    slug: "",
    phone: "",
    email: "",
    address: "",
    plan: "pro",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [createLoading, setCreateLoading] = useState(false);

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const res = await fetch("/api/platform/restaurants/main", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la création");
        return;
      }
      toast.success(`Restaurant "${createForm.restaurantName}" créé avec son administrateur`);
      setCreateForm({ restaurantName: "", slug: "", phone: "", email: "", address: "", plan: "pro", adminName: "", adminEmail: "", adminPassword: "" });
      setShowCreate(false);
      fetchRestaurants();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setCreateLoading(false);
    }
  };

  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/restaurants", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRestaurants(data.data || []);
      setStats(data.stats || { totalRestaurants: 0, activeRestaurants: 0, trialRestaurants: 0, totalRevenue: 0 });
    } catch {
      toast.error("Erreur lors du chargement des restaurants");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  const filteredRestaurants = restaurants.filter((r) => {
    const matchSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.slug.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchPlan = planFilter === "all" || r.plan === planFilter;
    return matchSearch && matchStatus && matchPlan;
  });

  const handleStatusChange = async (restaurant: RestaurantData, newStatus: string) => {
    setUpdating(restaurant.id);
    try {
      const res = await fetch("/api/platform/restaurants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: restaurant.id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la modification");
        return;
      }
      toast.success(`Restaurant ${newStatus === "active" ? "activé" : newStatus === "suspended" ? "suspendu" : "modifié"}`);
      fetchRestaurants();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setUpdating(null);
    }
  };

  const handlePlanChange = async (restaurant: RestaurantData, newPlan: string) => {
    setUpdating(restaurant.id);
    try {
      const res = await fetch("/api/platform/restaurants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: restaurant.id, plan: newPlan }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }
      toast.success(`Plan changé vers ${newPlan}`);
      fetchRestaurants();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setUpdating(null);
    }
  };

  const statusColors: Record<string, string> = {
    active: "border-green-500/30 text-green-400 bg-green-500/10",
    trial: "border-blue-500/30 text-blue-400 bg-blue-500/10",
    suspended: "border-red-500/30 text-red-400 bg-red-500/10",
    cancelled: "border-gray-500/30 text-gray-400 bg-gray-500/10",
  };

  const planColors: Record<string, string> = {
    free: "border-gray-500/30 text-gray-400",
    starter: "border-blue-500/30 text-blue-400",
    pro: "border-orange-500/30 text-orange-400",
    enterprise: "border-purple-500/30 text-purple-400",
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gray-900 border-white/10">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">{stats.totalRestaurants}</p>
            <p className="text-xs text-gray-500">Total restaurants</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-white/10">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-400">{stats.activeRestaurants}</p>
            <p className="text-xs text-gray-500">Actifs</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-white/10">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-400">{stats.trialRestaurants}</p>
            <p className="text-xs text-gray-500">En essai</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-white/10">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-orange-400">{stats.totalRevenue.toLocaleString("fr-FR")} GNF</p>
            <p className="text-xs text-gray-500">Revenus estimés/mois</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Rechercher un restaurant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-gray-900 border-white/10 text-white placeholder:text-gray-500 rounded-xl"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-gray-900 border-white/10 text-white rounded-xl">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-white/10">
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="trial">Essai</SelectItem>
            <SelectItem value="suspended">Suspendu</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-36 bg-gray-900 border-white/10 text-white rounded-xl">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-white/10">
            <SelectItem value="all">Tous plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" /> Nouveau restaurant
        </Button>
        <Button variant="ghost" size="icon" onClick={fetchRestaurants} className="text-gray-400 hover:text-white">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Restaurants Table */}
      <Card className="bg-gray-900 border-white/10">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Chargement...
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-30" />
              Aucun restaurant trouvé
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase text-gray-500">
                    <th className="text-left p-4">Restaurant</th>
                    <th className="text-left p-4">Type</th>
                    <th className="text-left p-4">Plan</th>
                    <th className="text-left p-4">Statut</th>
                    <th className="text-center p-4">Commandes</th>
                    <th className="text-center p-4">Clients</th>
                    <th className="text-right p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRestaurants.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: r.config?.primaryColor || "#ea580c" + "30", color: r.config?.primaryColor || "#ea580c" }}
                          >
                            {r.name?.[0]?.toUpperCase() || "R"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{r.name || "Sans nom"}</p>
                            <p className="text-xs text-gray-500">{r.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={r.type === "principal" ? "border-orange-500/30 text-orange-400" : "border-blue-500/30 text-blue-400"}>
                          {r.type}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Select
                          value={r.plan}
                          onValueChange={(v) => handlePlanChange(r, v)}
                          disabled={updating === r.id}
                        >
                          <SelectTrigger className="w-28 h-8 bg-gray-800 border-white/10 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-white/10">
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={`capitalize ${statusColors[r.status] || statusColors.active}`}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-center text-sm text-gray-300">{r._count?.orders || 0}</td>
                      <td className="p-4 text-center text-sm text-gray-300">{r._count?.customers || 0}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewing(r)}
                            className="text-gray-400 hover:text-white hover:bg-white/5"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {r.status === "active" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(r, "suspended")}
                              disabled={updating === r.id}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(r, "active")}
                              disabled={updating === r.id}
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          )}
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

      {/* View Restaurant Dialog */}
      {viewing && (
        <Dialog open onOpenChange={() => setViewing(null)}>
          <DialogContent className="bg-gray-900 border-white/10 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">{viewing.name || "Sans nom"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Slug</p>
                  <p className="text-sm text-white">{viewing.slug}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Type</p>
                  <p className="text-sm text-white capitalize">{viewing.type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Téléphone</p>
                  <p className="text-sm text-white">{viewing.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Email</p>
                  <p className="text-sm text-white">{viewing.email || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 uppercase">Adresse</p>
                  <p className="text-sm text-white">{viewing.address || "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 pt-2">
                <div className="p-2 bg-gray-800/50 rounded-lg text-center">
                  <p className="text-lg font-bold text-white">{viewing._count?.orders || 0}</p>
                  <p className="text-xs text-gray-500">Commandes</p>
                </div>
                <div className="p-2 bg-gray-800/50 rounded-lg text-center">
                  <p className="text-lg font-bold text-white">{viewing._count?.customers || 0}</p>
                  <p className="text-xs text-gray-500">Clients</p>
                </div>
                <div className="p-2 bg-gray-800/50 rounded-lg text-center">
                  <p className="text-lg font-bold text-white">{viewing._count?.admins || 0}</p>
                  <p className="text-xs text-gray-500">Admins</p>
                </div>
                <div className="p-2 bg-gray-800/50 rounded-lg text-center">
                  <p className="text-lg font-bold text-white">{viewing._count?.menuItems || 0}</p>
                  <p className="text-xs text-gray-500">Plats</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Restaurant Dialog */}
      {showCreate && (
        <Dialog open onOpenChange={() => setShowCreate(false)}>
          <DialogContent className="bg-gray-900 border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-orange-500" />
                Créer un restaurant + administrateur
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateRestaurant} className="space-y-4">
              <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-xs text-orange-400 font-medium">Informations Restaurant</p>
              </div>
              <div>
                <Label className="text-gray-300">Nom du restaurant *</Label>
                <Input required value={createForm.restaurantName} onChange={e => setCreateForm({ ...createForm, restaurantName: e.target.value })} placeholder="Ex: Le Baobab" className="bg-gray-800 border-white/10 text-white mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300">Slug (optionnel)</Label>
                  <Input value={createForm.slug} onChange={e => setCreateForm({ ...createForm, slug: e.target.value })} placeholder="le-baobab" className="bg-gray-800 border-white/10 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-gray-300">Plan</Label>
                  <Select value={createForm.plan} onValueChange={v => setCreateForm({ ...createForm, plan: v })}>
                    <SelectTrigger className="bg-gray-800 border-white/10 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/10">
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300">Téléphone</Label>
                  <Input value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+224 ..." className="bg-gray-800 border-white/10 text-white mt-1" />
                </div>
                <div>
                  <Label className="text-gray-300">Email</Label>
                  <Input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="contact@..." className="bg-gray-800 border-white/10 text-white mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-gray-300">Adresse</Label>
                <Input value={createForm.address} onChange={e => setCreateForm({ ...createForm, address: e.target.value })} placeholder="Conakry, Guinée" className="bg-gray-800 border-white/10 text-white mt-1" />
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-400 font-medium">Administrateur du restaurant</p>
                <p className="text-xs text-gray-400 mt-1">Cet utilisateur pourra se connecter au dashboard et créer d'autres utilisateurs (managers, staff, caissiers...)</p>
              </div>
              <div>
                <Label className="text-gray-300">Nom de l'admin *</Label>
                <Input required value={createForm.adminName} onChange={e => setCreateForm({ ...createForm, adminName: e.target.value })} placeholder="Nom complet" className="bg-gray-800 border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300">Email admin *</Label>
                <Input required type="email" value={createForm.adminEmail} onChange={e => setCreateForm({ ...createForm, adminEmail: e.target.value })} placeholder="admin@restaurant.com" className="bg-gray-800 border-white/10 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-300">Mot de passe admin * (min 6 caractères)</Label>
                <Input required type="password" minLength={6} value={createForm.adminPassword} onChange={e => setCreateForm({ ...createForm, adminPassword: e.target.value })} placeholder="••••••••" className="bg-gray-800 border-white/10 text-white mt-1" />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)} className="text-gray-400">Annuler</Button>
                <Button type="submit" disabled={createLoading} className="bg-gradient-to-r from-orange-500 to-red-600 text-white">
                  {createLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Créer le restaurant
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
