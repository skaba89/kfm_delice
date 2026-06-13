"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Search,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut,
  RefreshCw,
} from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  currency: string;
  locale: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
  config?: { primaryColor: string; logo: string };
  _count?: { orders: number; customers: number; admins: number; menuItems: number };
}

export default function PlatformDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({
    totalRestaurants: 0,
    activeRestaurants: 0,
    trialRestaurants: 0,
    totalRevenue: 0,
  });

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("platform_token");
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (token) fetchRestaurants();
  }, [token, page]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/platform-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error);
        return;
      }
      localStorage.setItem("platform_token", data.token);
      setToken(data.token);
    } catch {
      setLoginError("Erreur de connexion");
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      // We'll use a simplified approach: fetch restaurants via a dedicated API
      const res = await fetch("/api/platform/restaurants", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRestaurants(data.data || []);
        setStats(data.stats || stats);
      }
    } catch {
      // Fallback: show empty
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (restaurantId: string, newStatus: string) => {
    try {
      await fetch(`/api/platform/restaurants`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: restaurantId, status: newStatus }),
      });
      fetchRestaurants();
    } catch {
      // handle error
    }
  };

  const logout = () => {
    localStorage.removeItem("platform_token");
    setToken(null);
  };

  // Filter restaurants
  const filtered = restaurants.filter((r) => {
    if (planFilter !== "all" && r.plan !== planFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        r.ownerEmail.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Show login form if not authenticated
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-lg">
          <div className="text-center mb-8">
            <Shield className="w-16 h-16 text-orange-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Plateforme Admin</h1>
            <p className="text-gray-500 mt-1">RestaurantPro SaaS</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{loginError}</div>
            )}
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500"
              placeholder="Email administrateur plateforme"
              required
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500"
              placeholder="Mot de passe"
              required
            />
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50"
            >
              {loginLoading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-orange-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">RestaurantPro</h1>
              <p className="text-xs text-gray-500">Console d&apos;administration plateforme</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchRestaurants} className="p-2 hover:bg-gray-100 rounded-lg" title="Rafraîchir">
              <RefreshCw className="w-5 h-5 text-gray-500" />
            </button>
            <button onClick={logout} className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm">
              <LogOut className="w-4 h-4" /> Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total restaurants</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRestaurants}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Actifs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeRestaurants}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 rounded-lg">
                <Users className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">En essai</p>
                <p className="text-2xl font-bold text-gray-900">{stats.trialRestaurants}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Revenus estimés</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRevenue.toLocaleString("fr-FR")} GNF</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                placeholder="Rechercher par nom, slug, email..."
              />
            </div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">Tous les forfaits</option>
              <option value="free">Gratuit</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Entreprise</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="trial">Essai</option>
              <option value="suspended">Suspendu</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>
        </div>

        {/* Restaurant Table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Restaurant</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Forfait</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Propriétaire</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Commandes</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Clients</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Créé le</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    Aucun restaurant trouvé
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: r.config?.primaryColor || "#ea580c" }}
                        >
                          {r.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{r.name}</p>
                          <p className="text-xs text-gray-500">/{r.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        r.plan === "pro" ? "bg-purple-100 text-purple-700" :
                        r.plan === "starter" ? "bg-blue-100 text-blue-700" :
                        r.plan === "enterprise" ? "bg-amber-100 text-amber-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {r.plan === "free" ? "Gratuit" : r.plan === "starter" ? "Starter" : r.plan === "pro" ? "Pro" : "Entreprise"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        r.status === "active" ? "bg-green-100 text-green-700" :
                        r.status === "trial" ? "bg-blue-100 text-blue-700" :
                        r.status === "suspended" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {r.status === "active" ? "Actif" : r.status === "trial" ? "Essai" : r.status === "suspended" ? "Suspendu" : "Annulé"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">{r.ownerName}</p>
                      <p className="text-xs text-gray-500">{r.ownerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">
                      {r._count?.orders || 0}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">
                      {r._count?.customers || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => window.open(`/?restaurant=${r.slug}`, "_blank")}
                          className="p-1.5 hover:bg-gray-100 rounded-lg"
                          title="Voir le restaurant"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {r.status !== "suspended" ? (
                          <button
                            onClick={() => handleStatusChange(r.id, "suspended")}
                            className="p-1.5 hover:bg-red-50 rounded-lg"
                            title="Suspendre"
                          >
                            <Ban className="w-4 h-4 text-red-500" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(r.id, "active")}
                            className="p-1.5 hover:bg-green-50 rounded-lg"
                            title="Réactiver"
                          >
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-500">
            {filtered.length} restaurant(s) trouvé(s)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-700">Page {page}</span>
            <button
              onClick={() => setPage(page + 1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
