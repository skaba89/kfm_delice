"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed, CalendarCheck, Clock, Users, Star, MessageCircle,
  Phone, Mail, MapPin, ChevronRight, CheckCircle2, ArrowRight, Menu, X,
  Smartphone, BarChart3, ShieldCheck, Heart, Zap, TrendingUp, CreditCard,
  Flame, Leaf, Fish, CakeSlice, Settings, Palette, Code2, Layout,
  LogOut, LayoutDashboard, ClipboardList, ShoppingBag, MessageSquare,
  ChevronDown, AlertCircle, Eye, EyeOff, XCircle, RefreshCw, Plus,
  Edit3, Trash2, Search, Filter, Download, Bell, User, DollarSign,
  ArrowUpRight, ArrowDownRight, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */
interface Reservation {
  id: string; customerName: string; phone: string; date: string;
  time: string; guests: number; zone: string; notes: string;
  status: string; loyaltyPoint: number; createdAt: string;
}
interface MenuItemDB {
  id: string; name: string; description: string; price: number;
  category: string; image: string; badge: string; popular: boolean;
  available: boolean; order: number;
}
interface OrderDB {
  id: string; customerName: string; phone: string; items: string;
  total: number; status: string; paymentMethod: string; createdAt: string;
}
interface Stats {
  todayReservations: number; pendingReservations: number; todayRevenue: number;
  totalOrders: number; activeOrders: number; avgRating: number;
  totalReviews: number; popularDishes: { name: string; count: number; price: number; category: string }[];
  recentReservations: { id: string; customerName: string; date: string; time: string; guests: number; zone: string; status: string }[];
}
interface AdminUser { id: string; email: string; name: string; role: string; }

const RESTO = {
  name: "KFM Delice", tagline: "L'Art du Goût Guinéen",
  description: "Restaurant gastronomique au cœur de Conakry, KFM Delice vous propose une cuisine guinéenne revisitée avec une touche contemporaine. Produits frais, saveurs authentiques et service impeccable.",
  phone: "+224 622 34 56 78", whatsapp: "+224 622 34 56 78",
  email: "reservation@kfm-delice.com",
  address: "Almamya, Corniche Nord, Conakry, Guinée",
  hours: "Lun-Dim : 11h00 - 23h00", heroImage: "/images/kfm-hero.png",
  rating: 4.9, reviewCount: 327,
};

const MENU_CATS = [
  { id: "entrees", name: "Entrées", icon: Leaf },
  { id: "plats", name: "Plats Principaux", icon: Flame },
  { id: "mer", name: "Fruits de Mer", icon: Fish },
  { id: "desserts", name: "Desserts", icon: CakeSlice },
];

function formatPrice(p: number) { return p.toLocaleString("fr-FR") + " GNF"; }
function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const v = useInView(ref, { once: true, margin: "-60px" });
  return <motion.div ref={ref} initial={{ opacity: 0, y: 35 }} animate={v ? { opacity: 1, y: 0 } : { opacity: 0, y: 35 }} transition={{ duration: 0.55, delay, ease: "easeOut" }} className={className}>{children}</motion.div>;
}

/* ═══════════════════════════════════════════════════
   ADMIN LOGIN
   ═══════════════════════════════════════════════════ */
function AdminLogin({ onLogin }: { onLogin: (admin: AdminUser) => void }) {
  const [email, setEmail] = useState("admin@kfm-delice.com");
  const [password, setPassword] = useState("kfm2024");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) { setError("Email ou mot de passe incorrect"); return; }
      const admin = await res.json();
      onLogin(admin);
    } catch { setError("Erreur de connexion au serveur"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-4">
      <div className="absolute top-20 right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-red-500/10 rounded-full blur-3xl" />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md relative">
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
                <LayoutDashboard className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Admin KFM Delice</h1>
              <p className="text-gray-400 text-sm mt-1">Accédez au tableau de bord</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Email</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 rounded-xl" placeholder="admin@kfm-delice.com" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Mot de passe</label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 rounded-xl pr-10" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl py-6">
                {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : "Se Connecter"}
              </Button>
            </form>
            <div className="mt-6 p-3 bg-white/5 rounded-xl border border-white/10">
              <p className="text-xs text-gray-400 text-center">Demo : <span className="text-orange-400">admin@kfm-delice.com</span> / <span className="text-orange-400">kfm2024</span></p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ADMIN DASHBOARD
   ═══════════════════════════════════════════════════ */
function AdminDashboard({ admin, onLogout }: { admin: AdminUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemDB[]>([]);
  const [orders, setOrders] = useState<OrderDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, m, o] = await Promise.all([
        fetch("/api/stats").then(r => r.json()),
        fetch("/api/reservations").then(r => r.json()),
        fetch("/api/menu").then(r => r.json()),
        fetch("/api/orders").then(r => r.json()),
      ]);
      setStats(s); setReservations(r); setMenuItems(m); setOrders(o);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateReservationStatus = async (id: string, status: string) => {
    await fetch("/api/reservations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    loadData();
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    loadData();
  };

  const toggleMenuAvailability = async (id: string, available: boolean) => {
    await fetch("/api/menu", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, available }) });
    loadData();
  };

  const sidebarItems = [
    { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
    { id: "reservations", label: "Réservations", icon: CalendarCheck, badge: stats?.pendingReservations },
    { id: "orders", label: "Commandes", icon: ShoppingBag, badge: stats?.activeOrders },
    { id: "menu", label: "Menu", icon: UtensilsCrossed, badge: menuItems.length },
    { id: "reviews", label: "Avis", icon: MessageSquare, badge: stats?.totalReviews },
  ];

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700", confirmed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700", completed: "bg-blue-100 text-blue-700",
    preparing: "bg-orange-100 text-orange-700", ready: "bg-cyan-100 text-cyan-700",
    delivered: "bg-green-100 text-green-700",
  };
  const statusLabels: Record<string, string> = {
    pending: "En attente", confirmed: "Confirmée", cancelled: "Annulée", completed: "Terminée",
    preparing: "En préparation", ready: "Prêt", delivered: "Livré",
  };
  const paymentLabels: Record<string, string> = {
    cash: "Espèces", orange_money: "Orange Money", mtn_money: "MTN Money", card: "Carte",
  };
  const zoneLabels: Record<string, string> = {
    interieur: "Intérieur", terrasse: "Terrasse", vip: "VIP",
  };

  if (loading || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-64" : "w-20"} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shrink-0`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="font-bold text-gray-900 text-sm">KFM Delice</p>
                <p className="text-[10px] text-gray-400">Administration</p>
              </div>
            )}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/20"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
              {sidebarOpen && item.badge ? (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === item.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                }`}>{item.badge}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-100 text-sm">
            <Settings className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>Réduire</span>}
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 text-sm">
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {sidebarItems.find(s => s.id === activeTab)?.label}
            </h1>
            <p className="text-sm text-gray-500">Bienvenue, {admin.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><RefreshCw className="w-5 h-5" /></button>
            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 relative">
              <Bell className="w-5 h-5" />
              {stats.pendingReservations > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{stats.pendingReservations}</span>
              )}
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-sm font-bold">
              {admin.name[0]}
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* ═══════ OVERVIEW ═══════ */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: CalendarCheck, label: "Réservations aujourd'hui", value: stats.todayReservations, change: "+2", up: true, color: "bg-orange-100 text-orange-600" },
                  { icon: DollarSign, label: "Revenus du jour", value: formatPrice(stats.todayRevenue), change: "+18%", up: true, color: "bg-green-100 text-green-600" },
                  { icon: ShoppingBag, label: "Commandes actives", value: stats.activeOrders, change: `${stats.totalOrders} total`, up: true, color: "bg-blue-100 text-blue-600" },
                  { icon: Star, label: "Note moyenne", value: `${stats.avgRating}/5`, change: `${stats.totalReviews} avis`, up: true, color: "bg-amber-100 text-amber-600" },
                ].map((card, i) => (
                  <Card key={i} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center`}>
                          <card.icon className="w-5 h-5" />
                        </div>
                        <span className={`text-xs font-medium flex items-center gap-0.5 ${card.up ? "text-green-600" : "text-red-600"}`}>
                          {card.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {card.change}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                      <p className="text-sm text-gray-500 mt-1">{card.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Plats populaires */}
                <Card>
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Flame className="w-5 h-5 text-orange-500" /> Plats Populaires
                    </h3>
                    <div className="space-y-3">
                      {stats.popularDishes.map((dish, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{dish.name}</p>
                            <p className="text-xs text-gray-500">{dish.category} - {formatPrice(dish.price)}</p>
                          </div>
                          <span className="text-sm font-bold text-gray-700">{dish.count}x</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Dernières réservations */}
                <Card>
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <CalendarCheck className="w-5 h-5 text-green-500" /> Dernières Réservations
                    </h3>
                    <div className="space-y-3">
                      {stats.recentReservations.map((r, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                            {r.customerName.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.customerName}</p>
                            <p className="text-xs text-gray-500">{r.date} à {r.time} - {r.guests} pers. - {zoneLabels[r.zone] || r.zone}</p>
                          </div>
                          <Badge className={`${statusColors[r.status] || "bg-gray-100 text-gray-600"} text-xs`}>
                            {statusLabels[r.status] || r.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ═══════ RESERVATIONS ═══════ */}
          {activeTab === "reservations" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className="bg-amber-100 text-amber-700">{reservations.filter(r => r.status === "pending").length} En attente</Badge>
                <Badge className="bg-green-100 text-green-700">{reservations.filter(r => r.status === "confirmed").length} Confirmées</Badge>
                <Badge className="bg-blue-100 text-blue-700">{reservations.filter(r => r.status === "completed").length} Terminées</Badge>
              </div>
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date & Heure</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Personnes</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Zone</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Notes</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reservations.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{r.customerName}</p>
                            <p className="text-xs text-gray-500">{r.phone}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{r.date} à {r.time}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{r.guests}</td>
                          <td className="px-4 py-3"><Badge variant="outline">{zoneLabels[r.zone] || r.zone}</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{r.notes || "-"}</td>
                          <td className="px-4 py-3"><Badge className={`${statusColors[r.status] || ""} text-xs`}>{statusLabels[r.status] || r.status}</Badge></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {r.status === "pending" && (
                                <button onClick={() => updateReservationStatus(r.id, "confirmed")} className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200" title="Confirmer">
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                              {r.status !== "cancelled" && r.status !== "completed" && (
                                <button onClick={() => updateReservationStatus(r.id, "cancelled")} className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200" title="Annuler">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                              {r.status === "confirmed" && (
                                <button onClick={() => updateReservationStatus(r.id, "completed")} className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200" title="Terminer">
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ COMMANDES ═══════ */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className="bg-amber-100 text-amber-700">{orders.filter(o => o.status === "pending").length} En attente</Badge>
                <Badge className="bg-orange-100 text-orange-700">{orders.filter(o => o.status === "preparing").length} En préparation</Badge>
                <Badge className="bg-cyan-100 text-cyan-700">{orders.filter(o => o.status === "ready").length} Prêts</Badge>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.map((o) => {
                  let items: { name: string; price: number; qty: number }[] = [];
                  try { items = JSON.parse(o.items); } catch { /* */ }
                  return (
                    <Card key={o.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={`${statusColors[o.status] || ""} text-xs`}>{statusLabels[o.status] || o.status}</Badge>
                          <Badge variant="outline" className="text-xs">{paymentLabels[o.paymentMethod] || o.paymentMethod}</Badge>
                        </div>
                        <p className="font-semibold text-gray-900 text-sm mb-1">{o.customerName || "Client sur place"}</p>
                        <p className="text-xs text-gray-500 mb-3">{o.phone || "-"}</p>
                        <div className="space-y-1 mb-3">
                          {items.map((item, j) => (
                            <div key={j} className="flex justify-between text-xs">
                              <span className="text-gray-600">{item.qty}x {item.name}</span>
                              <span className="text-gray-900 font-medium">{formatPrice(item.price * item.qty)}</span>
                            </div>
                          ))}
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-bold text-gray-900">Total</span>
                          <span className="text-sm font-bold text-orange-600">{formatPrice(o.total)}</span>
                        </div>
                        <div className="flex gap-2">
                          {o.status === "pending" && (
                            <Button size="sm" onClick={() => updateOrderStatus(o.id, "preparing")} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg">
                              Préparer
                            </Button>
                          )}
                          {o.status === "preparing" && (
                            <Button size="sm" onClick={() => updateOrderStatus(o.id, "ready")} className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs rounded-lg">
                              Prêt
                            </Button>
                          )}
                          {o.status === "ready" && (
                            <Button size="sm" onClick={() => updateOrderStatus(o.id, "delivered")} className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">
                              Livré
                            </Button>
                          )}
                          {o.status !== "cancelled" && o.status !== "delivered" && (
                            <Button size="sm" variant="outline" onClick={() => updateOrderStatus(o.id, "cancelled")} className="text-red-500 border-red-200 hover:bg-red-50 text-xs rounded-lg">
                              <XCircle className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════ MENU ═══════ */}
          {activeTab === "menu" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{menuItems.length} plats au menu</p>
                <Button className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
                  <Plus className="w-4 h-4 mr-1" /> Ajouter un plat
                </Button>
              </div>
              {MENU_CATS.map((cat) => {
                const catItems = menuItems.filter(m => m.category === cat.id);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <cat.icon className="w-5 h-5 text-orange-500" /> {cat.name}
                      <Badge variant="outline" className="text-xs">{catItems.length}</Badge>
                    </h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {catItems.map((item) => (
                        <Card key={item.id} className={`overflow-hidden ${!item.available ? "opacity-60" : ""}`}>
                          <div className="flex">
                            <div className="w-24 h-24 shrink-0">
                              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 p-3 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                                {item.popular && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
                              <p className="text-sm font-bold text-orange-600 mt-1">{formatPrice(item.price)}</p>
                              <div className="flex items-center gap-1 mt-2">
                                <button onClick={() => toggleMenuAvailability(item.id, !item.available)}
                                  className={`text-xs px-2 py-0.5 rounded-full ${item.available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                  {item.available ? "Disponible" : "Indisponible"}
                                </button>
                                {item.badge && <Badge className="bg-gray-100 text-gray-600 text-[10px]">{item.badge}</Badge>}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══════ AVIS ═══════ */}
          {activeTab === "reviews" && (
            <div className="space-y-4">
              <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <CardContent className="p-6 flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-5xl font-extrabold">{stats.avgRating}</p>
                    <div className="flex gap-0.5 mt-1 justify-center">
                      {[1,2,3,4,5].map(i => <Star key={i} className={`w-5 h-5 ${i <= Math.round(stats.avgRating) ? "fill-white text-white" : "fill-white/30 text-white/30"}`} />)}
                    </div>
                    <p className="text-sm text-white/80 mt-1">{stats.totalReviews} avis</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[5,4,3,2,1].map(star => {
                      const count = star === 5 ? 4 : star === 4 ? 1 : 0;
                      const pct = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-sm w-3">{star}</span>
                          <Star className="w-3 h-3 fill-white" />
                          <div className="flex-1 bg-white/20 rounded-full h-2"><div className="bg-white rounded-full h-2" style={{ width: `${pct}%` }} /></div>
                          <span className="text-xs w-6">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              <p className="text-sm text-gray-500">Les avis clients apparaîtront ici quand les clients en laisseront via le site public.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PUBLIC SITE - Navbar
   ═══════════════════════════════════════════════════ */
function PublicNavbar({ onAdminClick }: { onAdminClick: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 20); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);
  const links = [
    { href: "#menu", label: "Menu" }, { href: "#reservation", label: "Réserver" },
    { href: "#avis", label: "Avis" }, { href: "#apropos", label: "À Propos" }, { href: "#contact", label: "Contact" },
  ];
  return (
    <motion.nav initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all ${scrolled ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-orange-100" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <a href="#" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <span className={`text-xl font-extrabold tracking-tight transition-colors ${scrolled ? "text-gray-900" : "text-white"}`}>
                KFM <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">Delice</span>
              </span>
              <p className={`text-[10px] font-medium tracking-widest uppercase ${scrolled ? "text-gray-400" : "text-white/60"}`}>Restaurant & Bar</p>
            </div>
          </a>
          <div className="hidden lg:flex items-center gap-7">
            {links.map(l => <a key={l.href} href={l.href} className={`text-sm font-medium transition-colors hover:text-orange-500 ${scrolled ? "text-gray-700" : "text-white/90"}`}>{l.label}</a>)}
            <a href="#reservation"><Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full px-6 shadow-lg shadow-orange-500/25">Réserver</Button></a>
            <button onClick={onAdminClick} className={`p-2 rounded-lg transition-colors ${scrolled ? "text-gray-400 hover:text-orange-500" : "text-white/50 hover:text-orange-400"}`} title="Admin">
              <LayoutDashboard className="w-5 h-5" />
            </button>
          </div>
          <button className="lg:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className={scrolled ? "text-gray-900" : "text-white"} /> : <Menu className={scrolled ? "text-gray-900" : "text-white"} />}
          </button>
        </div>
        <AnimatePresence>{menuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="lg:hidden bg-white rounded-2xl shadow-xl p-4 mb-4">
            {links.map(l => <a key={l.href} href={l.href} className="block py-3 px-4 text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg" onClick={() => setMenuOpen(false)}>{l.label}</a>)}
            <a href="#reservation" onClick={() => setMenuOpen(false)}><Button className="w-full mt-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full">Réserver</Button></a>
            <button onClick={() => { setMenuOpen(false); onAdminClick(); }} className="w-full mt-2 py-3 px-4 text-gray-500 hover:bg-gray-50 rounded-lg text-sm flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" /> Administration
            </button>
          </motion.div>
        )}</AnimatePresence>
      </div>
    </motion.nav>
  );
}

/* ═══════════════════════════════════════════════════
   PUBLIC HERO
   ═══════════════════════════════════════════════════ */
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0"><img src={RESTO.heroImage} alt={RESTO.name} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/45" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" /></div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 px-4 py-1.5 text-sm mb-6"><UtensilsCrossed className="w-3.5 h-3.5 mr-1.5" />{RESTO.tagline}</Badge>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.1] mb-6">KFM <span className="bg-gradient-to-r from-orange-400 via-red-400 to-amber-400 bg-clip-text text-transparent">Delice</span></motion.h1>
            <motion.p initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="text-lg text-gray-300 mb-4 max-w-lg leading-relaxed">{RESTO.description}</motion.p>
            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} className="flex items-center gap-4 mb-8">
              <div className="flex items-center gap-1">{[1,2,3,4,5].map(i => <Star key={i} className={`w-5 h-5 ${i <= Math.floor(RESTO.rating) ? "fill-amber-400 text-amber-400" : "fill-amber-200 text-amber-200"}`} />)}</div>
              <span className="text-white font-bold">{RESTO.rating}/5</span>
              <span className="text-gray-400">({RESTO.reviewCount} avis)</span>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="flex flex-col sm:flex-row gap-4">
              <a href="#reservation"><Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full px-8 py-6 text-lg shadow-xl shadow-orange-500/30"><CalendarCheck className="mr-2 w-5 h-5" />Réserver une Table</Button></a>
              <a href="#menu"><Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-full px-8 py-6 text-lg">Voir le Menu<ArrowRight className="ml-2 w-5 h-5" /></Button></a>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }} className="flex flex-wrap items-center gap-6 mt-8 text-sm text-gray-400">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-orange-400" />{RESTO.hours}</span>
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-orange-400" />{RESTO.address}</span>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="hidden lg:block">
            <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl max-w-sm ml-auto">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center"><CalendarCheck className="w-6 h-6 text-green-400" /></div><div><h3 className="text-white font-semibold">Réservation Confirmée</h3><p className="text-gray-400 text-sm">Table pour 4 personnes</p></div></div>
                <div className="space-y-3 mb-4"><div className="flex items-center gap-2 text-gray-300 text-sm"><Clock className="w-4 h-4 text-orange-400" />Samedi 7 Juin, 20:00</div><div className="flex items-center gap-2 text-gray-300 text-sm"><MapPin className="w-4 h-4 text-orange-400" />KFM Delice - Terrasse VIP</div><div className="flex items-center gap-2 text-gray-300 text-sm"><Users className="w-4 h-4 text-orange-400" />Zone VIP, vue mer</div></div>
                <Separator className="bg-white/10 mb-4" />
                <div className="flex items-center justify-between"><span className="text-amber-400 font-semibold text-sm">+50 pts fidélité</span><Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Confirmé ✓</Badge></div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   PUBLIC MENU
   ═══════════════════════════════════════════════════ */
function MenuSection() {
  const [activeCat, setActiveCat] = useState("plats");
  const [menuItems, setMenuItems] = useState<MenuItemDB[]>([]);
  const [cart, setCart] = useState<{ name: string; price: number }[]>([]);

  useEffect(() => { fetch("/api/menu").then(r => r.json()).then(setMenuItems).catch(console.error); }, []);

  const catItems = menuItems.filter(m => m.category === activeCat && m.available);

  return (
    <section id="menu" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-orange-100 text-orange-600 border-orange-200 mb-4">Notre Carte</Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Le Menu <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">KFM Delice</span></h2>
        </AnimatedSection>
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {MENU_CATS.map(cat => (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${activeCat === cat.id ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <cat.icon className="w-4 h-4" />{cat.name}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {catItems.map((item, i) => (
            <AnimatedSection key={item.id} delay={i * 0.05}>
              <Card className="overflow-hidden group hover:shadow-xl transition-all hover:-translate-y-1">
                <div className="relative h-52 overflow-hidden">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {item.badge && <div className="absolute top-3 left-3"><Badge className="bg-orange-500 text-white text-xs">{item.badge}</Badge></div>}
                  {item.popular && <div className="absolute top-3 right-3"><Badge className="bg-amber-500 text-white text-xs flex items-center gap-1"><Star className="w-3 h-3 fill-white" />Populaire</Badge></div>}
                  <div className="absolute bottom-3 right-3"><span className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-bold text-orange-600">{formatPrice(item.price)}</span></div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-bold text-gray-900 text-base mb-1.5">{item.name}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-3">{item.description}</p>
                  <Button size="sm" variant="outline" className="w-full border-orange-200 text-orange-600 hover:bg-orange-50 rounded-xl" onClick={() => setCart([...cart, { name: item.name, price: item.price }])}>
                    Ajouter
                  </Button>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
        <AnimatePresence>{cart.length > 0 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white rounded-2xl shadow-2xl border border-orange-200 px-6 py-4 flex items-center gap-4">
            <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">{cart.length}</div>
            <div><p className="font-semibold text-gray-900 text-sm">Votre commande</p><p className="text-orange-600 font-bold">{formatPrice(cart.reduce((s, i) => s + i.price, 0))}</p></div>
            <Button size="sm" className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl ml-2">Commander<ArrowRight className="w-4 h-4 ml-1" /></Button>
            <button onClick={() => setCart([])} className="text-gray-400 hover:text-red-500 ml-1"><X className="w-4 h-4" /></button>
          </motion.div>
        )}</AnimatePresence>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   PUBLIC RESERVATION
   ═══════════════════════════════════════════════════ */
function ReservationSection() {
  const [form, setForm] = useState({ name: "", phone: "", date: "", time: "", guests: "2", zone: "interieur", notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: form.name, phone: form.phone, date: form.date, time: form.time, guests: parseInt(form.guests), zone: form.zone, notes: form.notes, status: "pending", loyaltyPoint: 50 }) });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };
  const zones = [{ id: "interieur", name: "Intérieur", desc: "Climatisé, ambiance cosy" }, { id: "terrasse", name: "Terrasse", desc: "Vue mer, brise fraîche" }, { id: "vip", name: "VIP", desc: "Espace privé, service premium" }];

  return (
    <section id="reservation" className="py-20 lg:py-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <AnimatedSection>
            <Badge className="bg-red-100 text-red-600 border-red-200 mb-4">Réservation</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Réservez Votre Table <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">KFM Delice</span></h2>
            <p className="text-gray-600 text-lg mb-8">Garantissez votre place au KFM Delice. Confirmation par SMS et WhatsApp.</p>
            <div className="space-y-4 mb-8">
              {[{ icon: Zap, title: "Confirmation Instantanée", desc: "SMS + WhatsApp automatiques" }, { icon: Clock, title: "Rappel 2h Avant", desc: "Ne jamais oublier" }, { icon: Heart, title: "+50 Points Fidélité", desc: "À chaque réservation" }, { icon: MessageCircle, title: "Notes Spéciales", desc: "Allergies, anniversaires" }].map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-xl hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0"><item.icon className="w-5 h-5 text-orange-600" /></div>
                  <div><h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4><p className="text-gray-500 text-sm">{item.desc}</p></div>
                </div>
              ))}
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm text-orange-800 font-medium mb-2">📞 Réservation par téléphone</p>
              <p className="text-orange-600 font-bold text-lg">{RESTO.phone}</p>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={0.15}>
            <Card className="shadow-2xl border-0">
              <CardContent className="p-8">
                {submitted ? (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-10">
                    <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center"><CheckCircle2 className="w-10 h-10 text-green-600" /></div>
                    <h4 className="font-bold text-gray-900 text-xl mb-2">Réservation Envoyée !</h4>
                    <p className="text-gray-600">Merci <strong>{form.name}</strong> ! Confirmation par SMS & WhatsApp.</p>
                    <p className="text-orange-600 text-sm mt-3 font-medium">+50 points fidélité KFM Delice</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Nom complet</label><Input placeholder="Ex: Amadou Diallo" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="rounded-xl" required /></div>
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Téléphone</label><Input placeholder="+224 6XX XX XX XX" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="rounded-xl" required /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-sm font-medium text-gray-700 mb-1 block">Date</label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="rounded-xl" required /></div>
                      <div><label className="text-sm font-medium text-gray-700 mb-1 block">Heure</label><select value={form.time} onChange={e => setForm({...form, time: e.target.value})} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" required><option value="">Choisir</option>{["11:00","11:30","12:00","12:30","13:00","13:30","19:00","19:30","20:00","20:30","21:00"].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-sm font-medium text-gray-700 mb-1 block">Personnes</label><select value={form.guests} onChange={e => setForm({...form, guests: e.target.value})} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">{[1,2,3,4,5,6,7,8,"9+"].map(n => <option key={n} value={n}>{n} {n === 1 ? "personne" : "personnes"}</option>)}</select></div>
                      <div><label className="text-sm font-medium text-gray-700 mb-1 block">Zone</label><select value={form.zone} onChange={e => setForm({...form, zone: e.target.value})} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">{zones.map(z => <option key={z.id} value={z.id}>{z.name} - {z.desc}</option>)}</select></div>
                    </div>
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label><Input placeholder="Allergies, anniversaire..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="rounded-xl" /></div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl py-6 text-lg shadow-lg shadow-orange-500/25">Confirmer la Réservation<CalendarCheck className="ml-2 w-5 h-5" /></Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   PUBLIC FOOTER + CONTACT
   ═══════════════════════════════════════════════════ */
function PublicFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center"><UtensilsCrossed className="w-5 h-5 text-white" /></div>
              <span className="text-xl font-extrabold text-white">KFM <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">Delice</span></span>
            </div>
            <p className="text-sm">{RESTO.tagline}</p>
            <p className="text-xs text-gray-500 mt-2">{RESTO.hours}</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Contact</h4>
            <p className="text-sm flex items-center gap-2 mb-2"><Phone className="w-4 h-4 text-orange-400" />{RESTO.phone}</p>
            <p className="text-sm flex items-center gap-2 mb-2"><MessageCircle className="w-4 h-4 text-green-400" />WhatsApp: {RESTO.whatsapp}</p>
            <p className="text-sm flex items-center gap-2 mb-2"><Mail className="w-4 h-4 text-blue-400" />{RESTO.email}</p>
            <p className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-red-400" />{RESTO.address}</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Paiements</h4>
            <div className="flex flex-wrap gap-2">{["Orange Money", "MTN Money", "Espèces", "Visa"].map(p => <Badge key={p} variant="outline" className="border-gray-700 text-gray-400 text-xs">{p}</Badge>)}</div>
          </div>
        </div>
        <Separator className="bg-gray-800 mb-4" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <p>© 2026 {RESTO.name}. Tous droits réservés.</p>
          <p className="text-gray-600">Propulsé par <span className="text-orange-500 font-medium">RestoPro GN</span></p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE - Mode Switcher
   ═══════════════════════════════════════════════════ */
export default function Home() {
  const [mode, setMode] = useState<"public" | "login" | "admin">("public");
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  const handleAdminClick = () => setMode("login");
  const handleLogin = (user: AdminUser) => { setAdmin(user); setMode("admin"); };
  const handleLogout = () => { setAdmin(null); setMode("public"); };

  if (mode === "login") return <AdminLogin onLogin={handleLogin} />;
  if (mode === "admin" && admin) return <AdminDashboard admin={admin} onLogout={handleLogout} />;

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar onAdminClick={handleAdminClick} />
      <main className="flex-1">
        <HeroSection />
        <MenuSection />
        <ReservationSection />
      </main>
      <PublicFooter />
    </div>
  );
}
