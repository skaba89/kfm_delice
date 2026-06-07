"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  UtensilsCrossed, CalendarCheck, Clock, Users, Star, MessageCircle,
  Phone, Mail, MapPin, ChevronRight, CheckCircle2, ArrowRight, Menu, X,
  Smartphone, BarChart3, ShieldCheck, Heart, Zap, TrendingUp, CreditCard,
  Flame, Leaf, Fish, CakeSlice, Settings, LogOut, LayoutDashboard,
  ShoppingBag, MessageSquare, ChevronDown, AlertCircle, Eye, EyeOff,
  XCircle, RefreshCw, Plus, Edit3, Trash2, Search, Bell, User, DollarSign,
  ArrowUpRight, ArrowDownRight, Activity, Bike, Car, Save, ChevronLeft,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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
interface DriverDB {
  id: string; name: string; phone: string; vehicle: string;
  status: string; rating: number; totalDeliveries: number;
  zone: string; createdAt: string;
}
interface OrderDB {
  id: string; customerName: string; phone: string; items: string;
  total: number; status: string; orderType: string; paymentMethod: string;
  deliveryAddress: string; deliveryFee: number; driverId: string | null;
  driver: DriverDB | null; createdAt: string;
}
interface ReviewDB {
  id: string; customerName: string; rating: number; comment: string;
  date: string; createdAt: string;
}
interface Stats {
  todayReservations: number; pendingReservations: number; todayRevenue: number;
  totalOrders: number; activeOrders: number; avgRating: number;
  totalReviews: number; popularDishes: { name: string; count: number; price: number; category: string }[];
  recentReservations: { id: string; customerName: string; date: string; time: string; guests: number; zone: string; status: string }[];
  deliveryOrders: number; activeDeliveries: number; availableDrivers: number;
  totalDrivers: number; deliveryRevenue: number; dineInOrders: number; takeawayOrders: number;
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
   LOOKUPS
   ═══════════════════════════════════════════════════ */
const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700", confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700", completed: "bg-blue-100 text-blue-700",
  preparing: "bg-orange-100 text-orange-700", ready: "bg-cyan-100 text-cyan-700",
  delivering: "bg-purple-100 text-purple-700", delivered: "bg-green-100 text-green-700",
};
const statusLabels: Record<string, string> = {
  pending: "En attente", confirmed: "Confirmée", cancelled: "Annulée", completed: "Terminée",
  preparing: "En préparation", ready: "Prêt", delivering: "En livraison", delivered: "Livré",
};
const paymentLabels: Record<string, string> = {
  cash: "Espèces", orange_money: "Orange Money", mtn_money: "MTN Money", card: "Carte",
};
const zoneLabels: Record<string, string> = {
  interieur: "Intérieur", terrasse: "Terrasse", vip: "VIP",
};
const orderTypeLabels: Record<string, string> = { dine_in: "Sur place", takeaway: "À emporter", delivery: "Livraison" };
const vehicleLabels: Record<string, string> = { moto: "Moto", velo: "Vélo", voiture: "Voiture" };
const driverStatusColors: Record<string, string> = {
  available: "bg-green-100 text-green-700", busy: "bg-orange-100 text-orange-700", offline: "bg-gray-100 text-gray-700",
};
const driverStatusLabels: Record<string, string> = { available: "Disponible", busy: "En livraison", offline: "Hors ligne" };

function OrderTypeIcon({ type }: { type: string }) {
  if (type === "delivery") return <Bike className="w-3.5 h-3.5" />;
  if (type === "takeaway") return <ShoppingBag className="w-3.5 h-3.5" />;
  return <UtensilsCrossed className="w-3.5 h-3.5" />;
}

function VehicleIcon({ vehicle }: { vehicle: string }) {
  if (vehicle === "voiture") return <Car className="w-4 h-4" />;
  return <Bike className="w-4 h-4" />;
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
    e.preventDefault(); setLoading(true); setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) { setError("Email ou mot de passe incorrect"); return; }
      onLogin(await res.json());
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
                <Input value={email} onChange={e => setEmail(e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 rounded-xl" />
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
  const [drivers, setDrivers] = useState<DriverDB[]>([]);
  const [reviews, setReviews] = useState<ReviewDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Menu form states
  const [showMenuForm, setShowMenuForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemDB | null>(null);
  const [menuFilter, setMenuFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [menuForm, setMenuForm] = useState({ name: "", description: "", price: 0, category: "entrees", image: "", badge: "", popular: false, available: true });

  // Driver form states
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DriverDB | null>(null);
  const [deleteDriverConfirm, setDeleteDriverConfirm] = useState<string | null>(null);
  const [driverForm, setDriverForm] = useState({ name: "", phone: "", vehicle: "moto", zone: "Conakry" });

  // Assign driver state
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, m, o, d, rv] = await Promise.all([
        fetch("/api/stats").then(r => r.json()),
        fetch("/api/reservations").then(r => r.json()),
        fetch("/api/menu").then(r => r.json()),
        fetch("/api/orders").then(r => r.json()),
        fetch("/api/drivers").then(r => r.json()),
        fetch("/api/reviews").then(r => r.json()).catch(() => []),
      ]);
      setStats(s); setReservations(r); setMenuItems(m); setOrders(o); setDrivers(d); setReviews(rv);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const apiPatch = async (url: string, body: object) => {
    await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    loadData();
  };
  const apiPost = async (url: string, body: object) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    loadData();
    return res;
  };
  const apiDelete = async (url: string, body: object) => {
    await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    loadData();
  };

  const sidebarItems = [
    { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
    { id: "reservations", label: "Réservations", icon: CalendarCheck, badge: stats?.pendingReservations },
    { id: "orders", label: "Commandes", icon: ShoppingBag, badge: stats?.activeOrders },
    { id: "menu", label: "Menu", icon: UtensilsCrossed, badge: menuItems.length },
    { id: "deliveries", label: "Livraisons", icon: Bike, badge: stats?.activeDeliveries },
    { id: "drivers", label: "Livreurs", icon: Car, badge: stats?.availableDrivers },
    { id: "reviews", label: "Avis", icon: MessageSquare, badge: stats?.totalReviews },
  ];

  if (loading || !stats) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-orange-500 animate-spin" /></div>;
  }

  // Menu CRUD helpers
  const openAddMenu = () => { setEditingItem(null); setMenuForm({ name: "", description: "", price: 0, category: "entrees", image: "", badge: "", popular: false, available: true }); setShowMenuForm(true); };
  const openEditMenu = (item: MenuItemDB) => { setEditingItem(item); setMenuForm({ name: item.name, description: item.description, price: item.price, category: item.category, image: item.image, badge: item.badge, popular: item.popular, available: item.available }); setShowMenuForm(true); };
  const saveMenu = async () => {
    if (editingItem) {
      await apiPatch("/api/menu", { id: editingItem.id, ...menuForm });
    } else {
      await apiPost("/api/menu", { ...menuForm, order: menuItems.length + 1 });
    }
    setShowMenuForm(false); setEditingItem(null);
  };

  // Driver CRUD helpers
  const openAddDriver = () => { setEditingDriver(null); setDriverForm({ name: "", phone: "", vehicle: "moto", zone: "Conakry" }); setShowDriverForm(true); };
  const openEditDriver = (d: DriverDB) => { setEditingDriver(d); setDriverForm({ name: d.name, phone: d.phone, vehicle: d.vehicle, zone: d.zone }); setShowDriverForm(true); };
  const saveDriver = async () => {
    if (editingDriver) {
      await apiPatch("/api/drivers", { id: editingDriver.id, ...driverForm });
    } else {
      await apiPost("/api/drivers", { ...driverForm, status: "available", rating: 5.0, totalDeliveries: 0 });
    }
    setShowDriverForm(false); setEditingDriver(null);
  };

  // Filtered menu items
  const filteredMenuItems = menuFilter === "all" ? menuItems : menuItems.filter(m => m.category === menuFilter);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-64" : "w-20"} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shrink-0 hidden md:flex`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && <div className="overflow-hidden"><p className="font-bold text-gray-900 text-sm">KFM Delice</p><p className="text-[10px] text-gray-400">Administration</p></div>}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === item.id ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/20" : "text-gray-600 hover:bg-gray-100"}`}>
              <item.icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
              {sidebarOpen && item.badge ? <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${activeTab === item.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{item.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-100 text-sm">
            {sidebarOpen ? <ChevronLeft className="w-5 h-5 shrink-0" /> : <ChevronRight className="w-5 h-5 shrink-0" />}
            {sidebarOpen && <span>Réduire</span>}
          </button>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 text-sm">
            <LogOut className="w-5 h-5 shrink-0" />
            {sidebarOpen && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      <div className="md:hidden fixed bottom-4 left-4 z-50">
        <Button onClick={() => setSidebarOpen(!sidebarOpen)} size="sm" className="rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg">
          <Menu className="w-4 h-4" />
        </Button>
      </div>
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {!sidebarOpen && false ? null : null}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">{sidebarItems.find(s => s.id === activeTab)?.label}</h1>
            <p className="text-sm text-gray-500">Bienvenue, {admin.name}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={loadData} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" /></button>
            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 relative">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {stats.pendingReservations > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{stats.pendingReservations}</span>}
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-sm font-bold">{admin.name[0]}</div>
          </div>
        </header>

        <div className="p-4 sm:p-6">

          {/* ═══════ OVERVIEW ═══════ */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { icon: CalendarCheck, label: "Réservations", value: stats.todayReservations, sub: "aujourd'hui", color: "bg-orange-100 text-orange-600" },
                  { icon: DollarSign, label: "Revenus du jour", value: formatPrice(stats.todayRevenue), sub: "", color: "bg-green-100 text-green-600" },
                  { icon: ShoppingBag, label: "Commandes actives", value: stats.activeOrders, sub: `${stats.totalOrders} total`, color: "bg-blue-100 text-blue-600" },
                  { icon: Star, label: "Note moyenne", value: `${stats.avgRating}/5`, sub: `${stats.totalReviews} avis`, color: "bg-amber-100 text-amber-600" },
                  { icon: Bike, label: "Livraisons actives", value: stats.activeDeliveries, sub: `${stats.deliveryOrders} total`, color: "bg-purple-100 text-purple-600" },
                  { icon: Car, label: "Livreurs dispo", value: `${stats.availableDrivers}/${stats.totalDrivers}`, sub: "chauffeurs", color: "bg-emerald-100 text-emerald-600" },
                  { icon: UtensilsCrossed, label: "Sur place", value: stats.dineInOrders, sub: "commandes", color: "bg-cyan-100 text-cyan-600" },
                  { icon: CreditCard, label: "Rev. livraison", value: formatPrice(stats.deliveryRevenue), sub: "frais", color: "bg-rose-100 text-rose-600" },
                ].map((card, i) => (
                  <Card key={i} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3 sm:p-5">
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${card.color} flex items-center justify-center`}><card.icon className="w-4 h-4 sm:w-5 sm:h-5" /></div>
                        <ArrowUpRight className="w-3 h-3 text-green-600" />
                      </div>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">{card.value}</p>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{card.label}</p>
                      {card.sub && <p className="text-[10px] sm:text-xs text-gray-400">{card.sub}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Flame className="w-5 h-5 text-orange-500" /> Plats Populaires</h3>
                    <div className="space-y-3">
                      {stats.popularDishes.map((dish, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{dish.name}</p><p className="text-xs text-gray-500">{dish.category} - {formatPrice(dish.price)}</p></div>
                          <span className="text-sm font-bold text-gray-700">{dish.count}x</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-green-500" /> Dernières Réservations</h3>
                    <div className="space-y-3">
                      {stats.recentReservations.map((r, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">{r.customerName.split(" ").map(n => n[0]).join("")}</div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{r.customerName}</p><p className="text-xs text-gray-500">{r.date} à {r.time} - {r.guests} pers.</p></div>
                          <Badge className={`${statusColors[r.status] || "bg-gray-100 text-gray-600"} text-xs`}>{statusLabels[r.status] || r.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Active deliveries overview */}
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Bike className="w-5 h-5 text-purple-500" /> Livraisons en cours</h3>
                  {orders.filter(o => o.orderType === "delivery" && ["ready", "delivering"].includes(o.status)).length === 0 ? (
                    <p className="text-sm text-gray-500">Aucune livraison en cours</p>
                  ) : (
                    <div className="space-y-3">
                      {orders.filter(o => o.orderType === "delivery" && ["ready", "delivering"].includes(o.status)).map(o => (
                        <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          <div className={`w-10 h-10 rounded-xl ${statusColors[o.status]} flex items-center justify-center`}><Bike className="w-5 h-5" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{o.customerName}</p>
                            <p className="text-xs text-gray-500">{o.deliveryAddress}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={`${statusColors[o.status]} text-xs`}>{statusLabels[o.status]}</Badge>
                            {o.driver && <p className="text-[10px] text-gray-400 mt-0.5">{o.driver.name}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
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
                    <thead><tr className="bg-gray-50 border-b">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date & Heure</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pers.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Zone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Notes</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {reservations.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900">{r.customerName}</p><p className="text-xs text-gray-500">{r.phone}</p></td>
                          <td className="px-4 py-3 text-sm text-gray-700">{r.date} à {r.time}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{r.guests}</td>
                          <td className="px-4 py-3"><Badge variant="outline">{zoneLabels[r.zone] || r.zone}</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{r.notes || "-"}</td>
                          <td className="px-4 py-3"><Badge className={`${statusColors[r.status] || ""} text-xs`}>{statusLabels[r.status] || r.status}</Badge></td>
                          <td className="px-4 py-3"><div className="flex items-center gap-1">
                            {r.status === "pending" && <button onClick={() => apiPatch("/api/reservations", { id: r.id, status: "confirmed" })} className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200" title="Confirmer"><CheckCircle2 className="w-4 h-4" /></button>}
                            {r.status !== "cancelled" && r.status !== "completed" && <button onClick={() => apiPatch("/api/reservations", { id: r.id, status: "cancelled" })} className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200" title="Annuler"><XCircle className="w-4 h-4" /></button>}
                            {r.status === "confirmed" && <button onClick={() => apiPatch("/api/reservations", { id: r.id, status: "completed" })} className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200" title="Terminer"><CheckCircle2 className="w-4 h-4" /></button>}
                          </div></td>
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
                <Badge className="bg-purple-100 text-purple-700">{orders.filter(o => o.status === "delivering").length} En livraison</Badge>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.map((o) => {
                  let items: { name: string; price: number; qty: number }[] = [];
                  try { items = JSON.parse(o.items); } catch { /* */ }
                  return (
                    <Card key={o.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={`${statusColors[o.status] || ""} text-xs`}>{statusLabels[o.status] || o.status}</Badge>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs flex items-center gap-1"><OrderTypeIcon type={o.orderType} /> {orderTypeLabels[o.orderType] || o.orderType}</Badge>
                          </div>
                        </div>
                        <p className="font-semibold text-gray-900 text-sm mb-0.5">{o.customerName || "Client sur place"}</p>
                        <p className="text-xs text-gray-500 mb-2">{o.phone || "-"}</p>
                        {o.orderType === "delivery" && o.deliveryAddress && (
                          <div className="flex items-center gap-1 text-xs text-purple-600 mb-2"><MapPin className="w-3 h-3" /><span className="truncate">{o.deliveryAddress}</span></div>
                        )}
                        <div className="space-y-1 mb-2">
                          {items.map((item, j) => (
                            <div key={j} className="flex justify-between text-xs">
                              <span className="text-gray-600">{item.qty}x {item.name}</span>
                              <span className="text-gray-900 font-medium">{formatPrice(item.price * item.qty)}</span>
                            </div>
                          ))}
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-gray-900">Total</span>
                          <span className="text-sm font-bold text-orange-600">{formatPrice(o.total)}</span>
                        </div>
                        {o.deliveryFee > 0 && <p className="text-[10px] text-gray-400 mb-2">+ {formatPrice(o.deliveryFee)} frais de livraison</p>}
                        {o.driver && <div className="flex items-center gap-1 text-xs text-gray-500 mb-2 bg-gray-50 p-1.5 rounded-lg"><Bike className="w-3 h-3" /> {o.driver.name}</div>}
                        <div className="flex gap-2 flex-wrap">
                          {o.status === "pending" && <Button size="sm" onClick={() => apiPatch("/api/orders", { id: o.id, status: "preparing" })} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg">Préparer</Button>}
                          {o.status === "preparing" && <Button size="sm" onClick={() => apiPatch("/api/orders", { id: o.id, status: "ready" })} className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs rounded-lg">Prêt</Button>}
                          {o.status === "ready" && o.orderType === "delivery" && (
                            <Button size="sm" onClick={() => apiPatch("/api/orders", { id: o.id, status: "delivering" })} className="flex-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg">Livrer</Button>
                          )}
                          {o.status === "ready" && o.orderType !== "delivery" && (
                            <Button size="sm" onClick={() => apiPatch("/api/orders", { id: o.id, status: "delivered" })} className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Servi</Button>
                          )}
                          {o.status === "delivering" && (
                            <Button size="sm" onClick={() => apiPatch("/api/orders", { id: o.id, status: "delivered" })} className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Livré</Button>
                          )}
                          {o.status !== "cancelled" && o.status !== "delivered" && (
                            <Button size="sm" variant="outline" onClick={() => apiPatch("/api/orders", { id: o.id, status: "cancelled" })} className="text-red-500 border-red-200 hover:bg-red-50 text-xs rounded-lg"><XCircle className="w-3 h-3" /></Button>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1"><Badge variant="outline" className="text-[10px]">{paymentLabels[o.paymentMethod] || o.paymentMethod}</Badge></div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════ MENU - FULL CRUD ═══════ */}
          {activeTab === "menu" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-500">{menuItems.length} plats</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setMenuFilter("all")} className={`text-xs px-2 py-1 rounded-lg ${menuFilter === "all" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>Tous</button>
                    {MENU_CATS.map(c => <button key={c.id} onClick={() => setMenuFilter(c.id)} className={`text-xs px-2 py-1 rounded-lg ${menuFilter === c.id ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>{c.name}</button>)}
                  </div>
                </div>
                <Button onClick={openAddMenu} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </div>

              {/* Menu Add/Edit Form */}
              <AnimatePresence>
                {showMenuForm && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="border-orange-200 bg-orange-50/30">
                      <CardContent className="p-4 sm:p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">{editingItem ? "Modifier le plat" : "Ajouter un plat"}</h3>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label><Input value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="Nom du plat" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Prix (GNF) *</label><Input type="number" value={menuForm.price || ""} onChange={e => setMenuForm({ ...menuForm, price: parseInt(e.target.value) || 0 })} placeholder="35000" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Catégorie *</label>
                            <select value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                              {MENU_CATS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                          <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600 mb-1 block">Description</label><Textarea value={menuForm.description} onChange={e => setMenuForm({ ...menuForm, description: e.target.value })} placeholder="Description du plat" rows={2} /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Image URL</label><Input value={menuForm.image} onChange={e => setMenuForm({ ...menuForm, image: e.target.value })} placeholder="/images/dish.png" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Badge</label><Input value={menuForm.badge} onChange={e => setMenuForm({ ...menuForm, badge: e.target.value })} placeholder="Signature, Premium..." /></div>
                          <div className="flex items-center gap-6 pt-5">
                            <div className="flex items-center gap-2"><Switch checked={menuForm.popular} onCheckedChange={v => setMenuForm({ ...menuForm, popular: v })} /><span className="text-sm text-gray-600">Populaire</span></div>
                            <div className="flex items-center gap-2"><Switch checked={menuForm.available} onCheckedChange={v => setMenuForm({ ...menuForm, available: v })} /><span className="text-sm text-gray-600">Disponible</span></div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button onClick={saveMenu} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingItem ? "Enregistrer" : "Ajouter"}</Button>
                          <Button variant="outline" onClick={() => { setShowMenuForm(false); setEditingItem(null); }}>Annuler</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Menu Items Grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMenuItems.map((item) => (
                  <Card key={item.id} className={`overflow-hidden ${!item.available ? "opacity-60" : ""} hover:shadow-md transition-shadow`}>
                    <div className="flex">
                      <div className="w-24 h-24 shrink-0 bg-gray-100">
                        {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UtensilsCrossed className="w-8 h-8 text-gray-300" /></div>}
                      </div>
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {item.popular && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{item.description}</p>
                        <p className="text-sm font-bold text-orange-600 mt-1">{formatPrice(item.price)}</p>
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <button onClick={() => apiPatch("/api/menu", { id: item.id, available: !item.available })}
                            className={`text-xs px-2 py-0.5 rounded-full ${item.available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {item.available ? "Disponible" : "Indisponible"}
                          </button>
                          {item.badge && <Badge className="bg-gray-100 text-gray-600 text-[10px]">{item.badge}</Badge>}
                          <Badge variant="outline" className="text-[10px]">{MENU_CATS.find(c => c.id === item.category)?.name || item.category}</Badge>
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <button onClick={() => openEditMenu(item)} className="p-1 rounded-md bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600" title="Modifier"><Edit3 className="w-3.5 h-3.5" /></button>
                          {deleteConfirm === item.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => { apiDelete("/api/menu", { id: item.id }); setDeleteConfirm(null); }} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">Non</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(item.id)} className="p-1 rounded-md bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ═══════ LIVRAISONS ═══════ */}
          {activeTab === "deliveries" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className="bg-cyan-100 text-cyan-700">{orders.filter(o => o.orderType === "delivery" && o.status === "ready").length} Prêts à livrer</Badge>
                <Badge className="bg-purple-100 text-purple-700">{orders.filter(o => o.orderType === "delivery" && o.status === "delivering").length} En livraison</Badge>
                <Badge className="bg-green-100 text-green-700">{drivers.filter(d => d.status === "available").length} Livreurs dispo</Badge>
              </div>

              {/* Delivery orders */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders.filter(o => o.orderType === "delivery" && o.status !== "delivered" && o.status !== "cancelled").map(o => {
                  let items: { name: string; price: number; qty: number }[] = [];
                  try { items = JSON.parse(o.items); } catch { /* */ }
                  const availableDrivers = drivers.filter(d => d.status === "available");
                  return (
                    <Card key={o.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={`${statusColors[o.status] || ""} text-xs`}>{statusLabels[o.status] || o.status}</Badge>
                          <Badge variant="outline" className="text-xs flex items-center gap-1"><Bike className="w-3 h-3" /> Livraison</Badge>
                        </div>
                        <p className="font-semibold text-gray-900 text-sm">{o.customerName}</p>
                        <div className="flex items-center gap-1 text-xs text-purple-600 my-1"><MapPin className="w-3 h-3" /><span className="truncate">{o.deliveryAddress || "Adresse non spécifiée"}</span></div>
                        <div className="space-y-0.5 mb-2">
                          {items.map((item, j) => <div key={j} className="flex justify-between text-xs"><span className="text-gray-600">{item.qty}x {item.name}</span><span className="font-medium">{formatPrice(item.price * item.qty)}</span></div>)}
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold">Total</span>
                          <span className="text-sm font-bold text-orange-600">{formatPrice(o.total + (o.deliveryFee || 0))}</span>
                        </div>
                        {o.deliveryFee > 0 && <p className="text-[10px] text-gray-400">dont {formatPrice(o.deliveryFee)} livraison</p>}

                        {/* Driver assignment */}
                        {o.driver ? (
                          <div className="flex items-center gap-2 mt-2 p-2 bg-gray-50 rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center"><Bike className="w-4 h-4 text-purple-600" /></div>
                            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{o.driver.name}</p><p className="text-[10px] text-gray-500">{o.driver.phone}</p></div>
                            <Badge className={`${driverStatusColors[o.driver.status]} text-[10px]`}>{driverStatusLabels[o.driver.status]}</Badge>
                          </div>
                        ) : (
                          <div className="mt-2">
                            {assigningOrderId === o.id ? (
                              <div className="space-y-2">
                                <select onChange={async (e) => { if (e.target.value) { await apiPatch("/api/orders", { id: o.id, driverId: e.target.value }); setAssigningOrderId(null); } }} className="w-full h-8 rounded-md border border-gray-200 bg-white px-2 text-xs">
                                  <option value="">Choisir un livreur...</option>
                                  {availableDrivers.map(d => <option key={d.id} value={d.id}>{d.name} - {vehicleLabels[d.vehicle]} ({d.zone})</option>)}
                                </select>
                                <button onClick={() => setAssigningOrderId(null)} className="text-xs text-gray-500 hover:text-gray-700">Annuler</button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setAssigningOrderId(o.id)} className="w-full text-xs rounded-lg" disabled={availableDrivers.length === 0}>
                                <Bike className="w-3 h-3 mr-1" /> {availableDrivers.length === 0 ? "Aucun livreur dispo" : "Assigner un livreur"}
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Status flow for delivery */}
                        <div className="flex gap-2 mt-2">
                          {o.status === "pending" && <Button size="sm" onClick={() => apiPatch("/api/orders", { id: o.id, status: "preparing" })} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg">Préparer</Button>}
                          {o.status === "preparing" && <Button size="sm" onClick={() => apiPatch("/api/orders", { id: o.id, status: "ready" })} className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs rounded-lg">Prêt</Button>}
                          {o.status === "ready" && <Button size="sm" onClick={() => apiPatch("/api/orders", { id: o.id, status: "delivering" })} className="flex-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg">En livraison</Button>}
                          {o.status === "delivering" && <Button size="sm" onClick={() => apiPatch("/api/orders", { id: o.id, status: "delivered" })} className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Livré</Button>}
                          {o.status !== "cancelled" && o.status !== "delivered" && <Button size="sm" variant="outline" onClick={() => apiPatch("/api/orders", { id: o.id, status: "cancelled" })} className="text-red-500 border-red-200 hover:bg-red-50 text-xs rounded-lg"><XCircle className="w-3 h-3" /></Button>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {orders.filter(o => o.orderType === "delivery" && o.status !== "delivered" && o.status !== "cancelled").length === 0 && (
                <Card><CardContent className="p-8 text-center"><Package className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Aucune livraison active</p></CardContent></Card>
              )}
            </div>
          )}

          {/* ═══════ LIVREURS ═══════ */}
          {activeTab === "drivers" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-700">{drivers.filter(d => d.status === "available").length} Disponibles</Badge>
                  <Badge className="bg-orange-100 text-orange-700">{drivers.filter(d => d.status === "busy").length} En livraison</Badge>
                  <Badge className="bg-gray-100 text-gray-700">{drivers.filter(d => d.status === "offline").length} Hors ligne</Badge>
                </div>
                <Button onClick={openAddDriver} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
                  <Plus className="w-4 h-4 mr-1" /> Ajouter un livreur
                </Button>
              </div>

              {/* Driver Add/Edit Form */}
              <AnimatePresence>
                {showDriverForm && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="border-orange-200 bg-orange-50/30">
                      <CardContent className="p-4 sm:p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">{editingDriver ? "Modifier le livreur" : "Ajouter un livreur"}</h3>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label><Input value={driverForm.name} onChange={e => setDriverForm({ ...driverForm, name: e.target.value })} placeholder="Nom complet" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone *</label><Input value={driverForm.phone} onChange={e => setDriverForm({ ...driverForm, phone: e.target.value })} placeholder="+224 6XX XX XX XX" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Véhicule</label>
                            <select value={driverForm.vehicle} onChange={e => setDriverForm({ ...driverForm, vehicle: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                              <option value="moto">Moto</option><option value="velo">Vélo</option><option value="voiture">Voiture</option>
                            </select>
                          </div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Zone</label><Input value={driverForm.zone} onChange={e => setDriverForm({ ...driverForm, zone: e.target.value })} placeholder="Conakry" /></div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button onClick={saveDriver} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingDriver ? "Enregistrer" : "Ajouter"}</Button>
                          <Button variant="outline" onClick={() => { setShowDriverForm(false); setEditingDriver(null); }}>Annuler</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Drivers Grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {drivers.map(d => (
                  <Card key={d.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center">
                          <VehicleIcon vehicle={d.vehicle} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{d.name}</p>
                          <p className="text-xs text-gray-500">{d.phone}</p>
                        </div>
                        <Badge className={`${driverStatusColors[d.status] || ""} text-xs`}>{driverStatusLabels[d.status] || d.status}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                          <p className="text-sm font-bold text-gray-900">{d.totalDeliveries}</p>
                          <p className="text-[10px] text-gray-500">Livraisons</p>
                        </div>
                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                          <p className="text-sm font-bold text-gray-900">{d.rating}</p>
                          <p className="text-[10px] text-gray-500">Note</p>
                        </div>
                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                          <p className="text-xs font-bold text-gray-900">{vehicleLabels[d.vehicle] || d.vehicle}</p>
                          <p className="text-[10px] text-gray-500">{d.zone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          const newStatus = d.status === "available" ? "offline" : "available";
                          apiPatch("/api/drivers", { id: d.id, status: newStatus });
                        }} className={`flex-1 text-xs rounded-lg ${d.status === "available" ? "text-orange-600 border-orange-200 hover:bg-orange-50" : "text-green-600 border-green-200 hover:bg-green-50"}`}>
                          {d.status === "available" ? "M hors ligne" : "M dispo"}
                        </Button>
                        <button onClick={() => openEditDriver(d)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600" title="Modifier"><Edit3 className="w-4 h-4" /></button>
                        {deleteDriverConfirm === d.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => { apiDelete("/api/drivers", { id: d.id }); setDeleteDriverConfirm(null); }} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button>
                            <button onClick={() => setDeleteDriverConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">Non</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteDriverConfirm(d.id)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {drivers.length === 0 && (
                <Card><CardContent className="p-8 text-center"><Car className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Aucun livreur enregistré</p></CardContent></Card>
              )}
            </div>
          )}

          {/* ═══════ AVIS ═══════ */}
          {activeTab === "reviews" && (
            <div className="space-y-4">
              <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
                  <div className="text-center">
                    <p className="text-5xl font-extrabold">{stats.avgRating}</p>
                    <div className="flex gap-0.5 mt-1 justify-center">
                      {[1,2,3,4,5].map(i => <Star key={i} className={`w-5 h-5 ${i <= Math.round(stats.avgRating) ? "fill-white text-white" : "fill-white/30 text-white/30"}`} />)}
                    </div>
                    <p className="text-sm text-white/80 mt-1">{stats.totalReviews} avis</p>
                  </div>
                  <div className="flex-1 w-full space-y-1.5">
                    {[5,4,3,2,1].map(star => {
                      const count = reviews.filter(r => r.rating === star).length;
                      const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-sm w-3">{star}</span><Star className="w-3 h-3 fill-white" />
                          <div className="flex-1 bg-white/20 rounded-full h-2"><div className="bg-white rounded-full h-2" style={{ width: `${pct}%` }} /></div>
                          <span className="text-xs w-6">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-3">
                {reviews.map((r) => (
                  <Card key={r.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600">{r.customerName[0]}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{r.customerName}</p>
                            <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} />)}</div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{r.comment}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{r.date}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {reviews.length === 0 && <p className="text-sm text-gray-500 text-center py-8">Aucun avis pour le moment</p>}
              </div>
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30"><UtensilsCrossed className="w-5 h-5 text-white" /></div>
            <div className="leading-tight">
              <span className={`text-xl font-extrabold tracking-tight transition-colors ${scrolled ? "text-gray-900" : "text-white"}`}>KFM <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">Delice</span></span>
              <p className={`text-[10px] font-medium tracking-widest uppercase ${scrolled ? "text-gray-400" : "text-white/60"}`}>Restaurant & Bar</p>
            </div>
          </a>
          <div className="hidden lg:flex items-center gap-7">
            {links.map(l => <a key={l.href} href={l.href} className={`text-sm font-medium transition-colors hover:text-orange-500 ${scrolled ? "text-gray-700" : "text-white/90"}`}>{l.label}</a>)}
            <a href="#reservation"><Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-full px-6 shadow-lg shadow-orange-500/25">Réserver</Button></a>
            <button onClick={onAdminClick} className={`p-2 rounded-lg transition-colors ${scrolled ? "text-gray-400 hover:text-orange-500" : "text-white/50 hover:text-orange-400"}`} title="Admin"><LayoutDashboard className="w-5 h-5" /></button>
          </div>
          <button className="lg:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className={scrolled ? "text-gray-900" : "text-white"} /> : <Menu className={scrolled ? "text-gray-900" : "text-white"} />}
          </button>
        </div>
        <AnimatePresence>{menuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="lg:hidden bg-white rounded-2xl shadow-xl p-4 mb-4">
            {links.map(l => <a key={l.href} href={l.href} className="block py-3 px-4 text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg" onClick={() => setMenuOpen(false)}>{l.label}</a>)}
            <a href="#reservation" onClick={() => setMenuOpen(false)}><Button className="w-full mt-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full">Réserver</Button></a>
            <button onClick={() => { setMenuOpen(false); onAdminClick(); }} className="w-full mt-2 py-3 px-4 text-gray-500 hover:bg-gray-50 rounded-lg text-sm flex items-center gap-2"><LayoutDashboard className="w-4 h-4" /> Administration</button>
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
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   PUBLIC MENU SECTION
   ═══════════════════════════════════════════════════ */
function MenuSection() {
  const [menuItems, setMenuItems] = useState<MenuItemDB[]>([]);
  const [activeCat, setActiveCat] = useState("entrees");
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/menu").then(r => r.json()).then(d => { setMenuItems(d); setLoading(false); }).catch(() => setLoading(false)); }, []);
  const items = menuItems.filter(i => i.category === activeCat && i.available);
  return (
    <section id="menu" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-orange-100 text-orange-700 mb-4">Notre Carte</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Le Menu <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">KFM Delice</span></h2>
          <p className="text-gray-500 max-w-2xl mx-auto">Des plats préparés avec passion, des ingrédients frais et un savoir-faire guinéen authentique</p>
        </AnimatedSection>
        <div className="flex justify-center gap-2 sm:gap-4 mb-10 flex-wrap">
          {MENU_CATS.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)} className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${activeCat === c.id ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <c.icon className="w-4 h-4" /> {c.name}
            </button>
          ))}
        </div>
        {loading ? <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 text-orange-500 animate-spin" /></div> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <AnimatedSection key={item.id}>
                <Card className="overflow-hidden hover:shadow-xl transition-all group">
                  <div className="h-48 overflow-hidden relative">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    {item.badge && <Badge className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs">{item.badge}</Badge>}
                    {item.popular && <Badge className="absolute top-3 left-3 bg-amber-500 text-white text-xs"><Star className="w-3 h-3 mr-1 fill-white" /> Populaire</Badge>}
                  </div>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2"><h3 className="text-lg font-bold text-gray-900">{item.name}</h3><span className="text-lg font-extrabold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">{formatPrice(item.price)}</span></div>
                    <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   PUBLIC RESERVATION SECTION
   ═══════════════════════════════════════════════════ */
function ReservationSection() {
  const [form, setForm] = useState({ customerName: "", phone: "", date: "", time: "", guests: 2, zone: "interieur", notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);
    try { await fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); setSubmitted(true); } catch { /* */ }
    finally { setSubmitting(false); }
  };
  return (
    <section id="reservation" className="py-20 bg-gradient-to-br from-gray-50 to-orange-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-orange-100 text-orange-700 mb-4">Réservation</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Réservez Votre <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">Table</span></h2>
          <p className="text-gray-500 max-w-2xl mx-auto">Réservez en ligne et profitez de 50 points de fidélité offerts</p>
        </AnimatedSection>
        <AnimatedSection>
          <Card className="max-w-2xl mx-auto shadow-xl">
            <CardContent className="p-6 sm:p-8">
              {submitted ? (
                <div className="text-center py-8"><CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Réservation Confirmée !</h3><p className="text-gray-500">Nous vous contacterons pour confirmer votre réservation.</p><Button onClick={() => { setSubmitted(false); setForm({ customerName: "", phone: "", date: "", time: "", guests: 2, zone: "interieur", notes: "" }); }} className="mt-4 bg-gradient-to-r from-orange-500 to-red-500 text-white">Nouvelle réservation</Button></div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Nom complet *</label><Input required value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="Votre nom" /></div>
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Téléphone *</label><Input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+224 6XX XX XX XX" /></div>
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Date *</label><Input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Heure *</label><Input required type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Nombre de personnes</label><Input type="number" min={1} max={20} value={form.guests} onChange={e => setForm({ ...form, guests: parseInt(e.target.value) || 2 })} /></div>
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Zone</label>
                      <select value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                        <option value="interieur">Intérieur</option><option value="terrasse">Terrasse</option><option value="vip">VIP</option>
                      </select>
                    </div>
                  </div>
                  <div><label className="text-sm font-medium text-gray-700 mb-1 block">Notes spéciales</label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Allergies, occasions spéciales..." rows={3} /></div>
                  <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl py-6 text-lg">
                    {submitting ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : <><CalendarCheck className="mr-2 w-5 h-5" />Réserver</>}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   PUBLIC FOOTER
   ═══════════════════════════════════════════════════ */
function PublicFooter() {
  return (
    <footer id="contact" className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center"><UtensilsCrossed className="w-5 h-5 text-white" /></div>
              <div><p className="font-extrabold text-lg">KFM Delice</p><p className="text-[10px] text-gray-400 uppercase tracking-widest">Restaurant & Bar</p></div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">{RESTO.description}</p>
          </div>
          <div>
            <h4 className="font-bold mb-4">Navigation</h4>
            <div className="space-y-2">{["Menu", "Réserver", "Avis", "À Propos"].map(l => <a key={l} href={`#${l.toLowerCase().replace("à propos", "apropos")}`} className="block text-sm text-gray-400 hover:text-orange-400 transition-colors">{l}</a>)}</div>
          </div>
          <div>
            <h4 className="font-bold mb-4">Contact</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-400"><Phone className="w-4 h-4 text-orange-400" /> {RESTO.phone}</div>
              <div className="flex items-center gap-2 text-sm text-gray-400"><Mail className="w-4 h-4 text-orange-400" /> {RESTO.email}</div>
              <div className="flex items-center gap-2 text-sm text-gray-400"><MapPin className="w-4 h-4 text-orange-400" /> {RESTO.address}</div>
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-4">Horaires</h4>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2"><Clock className="w-4 h-4 text-orange-400" /> {RESTO.hours}</div>
            <p className="text-xs text-gray-500 mt-4">Livraison disponible sur Conakry</p>
          </div>
        </div>
        <Separator className="bg-gray-800 mb-8" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">&copy; 2024 KFM Delice. Tous droits réservés.</p>
          <div className="flex items-center gap-3">
            <a href="#" className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-orange-500 hover:text-white transition-colors"><MessageCircle className="w-4 h-4" /></a>
            <a href="#" className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-orange-500 hover:text-white transition-colors"><Smartphone className="w-4 h-4" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN HOME
   ═══════════════════════════════════════════════════ */
export default function Home() {
  const [mode, setMode] = useState<"public" | "login" | "admin">("public");
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  // Seed DB on first load
  useEffect(() => { fetch("/api/seed", { method: "POST" }).catch(() => {}); }, []);

  if (mode === "admin" && admin) return <AdminDashboard admin={admin} onLogout={() => { setMode("public"); setAdmin(null); }} />;
  if (mode === "login") return <AdminLogin onLogin={(a) => { setAdmin(a); setMode("admin"); }} />;

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar onAdminClick={() => setMode("login")} />
      <HeroSection />
      <MenuSection />
      <ReservationSection />
      <PublicFooter />
    </div>
  );
}
