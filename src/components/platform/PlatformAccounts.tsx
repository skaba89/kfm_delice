"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Search, Edit, Eye, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/constants";

interface Account {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  status: string;
  plan: string;
  maxRestaurants: number;
  maxSecondaryRestaurants: number;
  maxAdmins: number;
  maxUsers: number;
  createdAt: string;
  _count: { restaurants: number; admins: number };
}

const PLAN_LIMITS: Record<string, { maxRestaurants: number; maxSecondaryRestaurants: number; maxAdmins: number; maxUsers: number }> = {
  free: { maxRestaurants: 1, maxSecondaryRestaurants: 0, maxAdmins: 2, maxUsers: 5 },
  starter: { maxRestaurants: 2, maxSecondaryRestaurants: 1, maxAdmins: 5, maxUsers: 15 },
  pro: { maxRestaurants: 5, maxSecondaryRestaurants: 4, maxAdmins: 15, maxUsers: 50 },
  enterprise: { maxRestaurants: 20, maxSecondaryRestaurants: 19, maxAdmins: 50, maxUsers: 200 },
  custom: { maxRestaurants: 10, maxSecondaryRestaurants: 5, maxAdmins: 10, maxUsers: 30 },
};

export function PlatformAccounts({ token }: { token: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [viewingAccount, setViewingAccount] = useState<Account | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/accounts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAccounts(data.data || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des comptes");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const filteredAccounts = accounts.filter((a) => {
    const matchSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.ownerEmail.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    const matchPlan = planFilter === "all" || a.plan === planFilter;
    return matchSearch && matchStatus && matchPlan;
  });

  const statusColors: Record<string, string> = {
    active: "border-green-500/30 text-green-400 bg-green-500/10",
    trial: "border-blue-500/30 text-blue-400 bg-blue-500/10",
    suspended: "border-red-500/30 text-red-400 bg-red-500/10",
    cancelled: "border-gray-500/30 text-gray-400 bg-gray-500/10",
    over_quota: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  };

  const planColors: Record<string, string> = {
    free: "border-gray-500/30 text-gray-400",
    starter: "border-blue-500/30 text-blue-400",
    pro: "border-orange-500/30 text-orange-400",
    enterprise: "border-purple-500/30 text-purple-400",
    custom: "border-green-500/30 text-green-400",
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Rechercher un compte..."
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
            <SelectItem value="over_quota">Quota dépassé</SelectItem>
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
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" /> Nouveau compte
        </Button>
        <Button variant="ghost" size="icon" onClick={fetchAccounts} className="text-gray-400 hover:text-white">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Accounts Table */}
      <Card className="bg-gray-900 border-white/10">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Chargement...
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              Aucun compte trouvé
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase text-gray-500">
                    <th className="text-left p-4">Compte</th>
                    <th className="text-left p-4">Propriétaire</th>
                    <th className="text-left p-4">Plan</th>
                    <th className="text-left p-4">Statut</th>
                    <th className="text-center p-4">Restaurants</th>
                    <th className="text-center p-4">Admins</th>
                    <th className="text-right p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account) => (
                    <tr
                      key={account.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="p-4">
                        <p className="font-medium text-white">{account.name}</p>
                        <p className="text-xs text-gray-500">
                          Créé le {new Date(account.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm text-gray-300">{account.ownerName || "—"}</p>
                        <p className="text-xs text-gray-500">{account.ownerEmail || "—"}</p>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={`capitalize ${planColors[account.plan] || planColors.free}`}>
                          {account.plan}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className={`capitalize ${statusColors[account.status] || statusColors.active}`}>
                          {account.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm text-gray-300">
                          {account._count?.restaurants || 0} / {account.maxRestaurants}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm text-gray-300">
                          {account._count?.admins || 0} / {account.maxAdmins}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingAccount(account)}
                            className="text-gray-400 hover:text-white hover:bg-white/5"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingAccount(account)}
                            className="text-gray-400 hover:text-white hover:bg-white/5"
                          >
                            <Edit className="w-4 h-4" />
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

      {/* Create Account Dialog */}
      <CreateAccountDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        token={token}
        onCreated={fetchAccounts}
      />

      {/* Edit Account Dialog */}
      {editingAccount && (
        <EditAccountDialog
          account={editingAccount}
          open={!!editingAccount}
          onClose={() => setEditingAccount(null)}
          token={token}
          onUpdated={fetchAccounts}
        />
      )}

      {/* View Account Dialog */}
      {viewingAccount && (
        <ViewAccountDialog
          account={viewingAccount}
          token={token}
          onClose={() => setViewingAccount(null)}
        />
      )}
    </div>
  );
}

// ── Create Account Dialog ──────────────────────────────────────
function CreateAccountDialog({
  open,
  onClose,
  token,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    plan: "pro",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const limits = PLAN_LIMITS[form.plan];
      const res = await fetch("/api/platform/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          ...limits,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la création");
        return;
      }
      toast.success(`Compte "${form.name}" créé avec succès`);
      setForm({ name: "", ownerName: "", ownerEmail: "", ownerPhone: "", plan: "pro" });
      onClose();
      onCreated();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Créer un nouveau compte SaaS</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-gray-300">Nom du compte *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Restaurant Le Baobab"
              className="bg-gray-800 border-white/10 text-white mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300">Nom du propriétaire</Label>
              <Input
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                placeholder="Nom complet"
                className="bg-gray-800 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300">Téléphone</Label>
              <Input
                value={form.ownerPhone}
                onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
                placeholder="+224 ..."
                className="bg-gray-800 border-white/10 text-white mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-gray-300">Email du propriétaire</Label>
            <Input
              type="email"
              value={form.ownerEmail}
              onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
              placeholder="proprietaire@email.com"
              className="bg-gray-800 border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-gray-300">Plan</Label>
            <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
              <SelectTrigger className="bg-gray-800 border-white/10 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-white/10">
                {Object.entries(PLAN_LIMITS).map(([plan, limits]) => (
                  <SelectItem key={plan} value={plan} className="capitalize">
                    {plan} — {limits.maxRestaurants} rest. / {limits.maxAdmins} admins
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="text-gray-400">
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Créer le compte
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Account Dialog (Quotas) ───────────────────────────────
function EditAccountDialog({
  account,
  open,
  onClose,
  token,
  onUpdated,
}: {
  account: Account;
  open: boolean;
  onClose: () => void;
  token: string;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState({
    plan: account.plan,
    status: account.status,
    maxRestaurants: account.maxRestaurants,
    maxSecondaryRestaurants: account.maxSecondaryRestaurants,
    maxAdmins: account.maxAdmins,
    maxUsers: account.maxUsers,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/accounts/${account.id}/quotas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la modification");
        return;
      }
      toast.success("Quotas mis à jour avec succès");
      onClose();
      onUpdated();
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (plan: string) => {
    const limits = PLAN_LIMITS[plan];
    if (limits) {
      setForm({
        ...form,
        plan,
        maxRestaurants: limits.maxRestaurants,
        maxSecondaryRestaurants: limits.maxSecondaryRestaurants,
        maxAdmins: limits.maxAdmins,
        maxUsers: limits.maxUsers,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Modifier — {account.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300">Plan</Label>
              <Select
                value={form.plan}
                onValueChange={(v) => {
                  setForm({ ...form, plan: v });
                  applyPreset(v);
                }}
              >
                <SelectTrigger className="bg-gray-800 border-white/10 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10">
                  {Object.keys(PLAN_LIMITS).map((plan) => (
                    <SelectItem key={plan} value={plan} className="capitalize">
                      {plan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">Statut</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-gray-800 border-white/10 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10">
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="trial">Essai</SelectItem>
                  <SelectItem value="suspended">Suspendu</SelectItem>
                  <SelectItem value="over_quota">Quota dépassé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-300">Max restaurants</Label>
              <Input
                type="number"
                min={1}
                value={form.maxRestaurants}
                onChange={(e) => setForm({ ...form, maxRestaurants: parseInt(e.target.value) || 1 })}
                className="bg-gray-800 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300">Max restaurants secondaires</Label>
              <Input
                type="number"
                min={0}
                value={form.maxSecondaryRestaurants}
                onChange={(e) => setForm({ ...form, maxSecondaryRestaurants: parseInt(e.target.value) || 0 })}
                className="bg-gray-800 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300">Max admins</Label>
              <Input
                type="number"
                min={1}
                value={form.maxAdmins}
                onChange={(e) => setForm({ ...form, maxAdmins: parseInt(e.target.value) || 1 })}
                className="bg-gray-800 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-300">Max utilisateurs</Label>
              <Input
                type="number"
                min={1}
                value={form.maxUsers}
                onChange={(e) => setForm({ ...form, maxUsers: parseInt(e.target.value) || 1 })}
                className="bg-gray-800 border-white/10 text-white mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="text-gray-400">
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Edit className="w-4 h-4 mr-2" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── View Account Dialog ────────────────────────────────────────
function ViewAccountDialog({
  account,
  token,
  onClose,
}: {
  account: Account;
  token: string;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/platform/accounts/${account.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setDetails)
      .catch(() => {});
  }, [account.id, token]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-white/10 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">{account.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Propriétaire</p>
              <p className="text-sm text-white">{account.ownerName || "—"}</p>
              <p className="text-xs text-gray-400">{account.ownerEmail || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Téléphone</p>
              <p className="text-sm text-white">{account.ownerPhone || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Plan</p>
              <Badge variant="outline" className="capitalize mt-1 border-orange-500/30 text-orange-400">
                {account.plan}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Statut</p>
              <Badge variant="outline" className="capitalize mt-1 border-green-500/30 text-green-400">
                {account.status}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-2">Quotas</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-500">Restaurants</p>
                <p className="text-lg font-bold text-white">{account._count?.restaurants || 0} / {account.maxRestaurants}</p>
              </div>
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-500">Admins</p>
                <p className="text-lg font-bold text-white">{account._count?.admins || 0} / {account.maxAdmins}</p>
              </div>
              <div className="p-3 bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-500">Secondaires</p>
                <p className="text-lg font-bold text-white">{account.maxSecondaryRestaurants}</p>
              </div>
            </div>
          </div>
          {details?.restaurants && details.restaurants.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-2">Restaurants ({details.restaurants.length})</p>
              <div className="space-y-2">
                {details.restaurants.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
                    <div>
                      <p className="text-sm text-white">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.slug} · {r.type}</p>
                    </div>
                    <Badge variant="outline" className="border-white/10 text-gray-400">
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
