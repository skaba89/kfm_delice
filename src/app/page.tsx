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
  Package, FileText, Wallet, Receipt, UserCog, ClipboardList, UserCheck, Award, PenSquare, UserPlus,
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
interface StaffDB {
  id: string; name: string; phone: string; role: string;
  salary: number; status: string; hireDate: string; notes: string; createdAt: string;
}
interface AdminDB {
  id: string; email: string; password: string; name: string;
  role: string; status: string; createdAt: string;
}
interface InvoiceDB {
  id: string; number: string; customerName: string; customerPhone: string;
  items: string; subtotal: number; tax: number; total: number;
  status: string; dueDate: string; notes: string; createdAt: string;
}
interface QuoteDB {
  id: string; number: string; customerName: string; customerPhone: string;
  items: string; subtotal: number; discount: number; total: number;
  status: string; validUntil: string; notes: string; createdAt: string;
}
interface ExpenseDB {
  id: string; description: string; amount: number; category: string;
  date: string; paidBy: string; notes: string; createdAt: string;
}
interface AdminUser { id: string; email: string; name: string; role: string; }
interface CustomerUser { id: string; email: string; name: string; phone: string; address: string; loyaltyPoints: number; totalOrders: number; totalSpent: number; status: string; }

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
const staffRoleLabels: Record<string, string> = { cuisinier: "Cuisinier", serveur: "Serveur", barman: "Barman", gerant: "Gérant", plongeur: "Plongeur", securite: "Sécurité", caissier: "Caissier" };
const staffStatusColors: Record<string, string> = { active: "bg-green-100 text-green-700", inactive: "bg-red-100 text-red-700", on_leave: "bg-amber-100 text-amber-700" };
const staffStatusLabels: Record<string, string> = { active: "Actif", inactive: "Inactif", on_leave: "En congé" };
const adminRoleLabels: Record<string, string> = { admin: "Administrateur", manager: "Manager", staff: "Personnel" };
const invoiceStatusColors: Record<string, string> = { pending: "bg-amber-100 text-amber-700", paid: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-700", overdue: "bg-red-200 text-red-800" };
const invoiceStatusLabels: Record<string, string> = { pending: "En attente", paid: "Payée", cancelled: "Annulée", overdue: "En retard" };
const quoteStatusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-700", sent: "bg-blue-100 text-blue-700", accepted: "bg-green-100 text-green-700", refused: "bg-red-100 text-red-700", expired: "bg-amber-100 text-amber-700" };
const quoteStatusLabels: Record<string, string> = { draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", refused: "Refusé", expired: "Expiré" };
const expenseCategoryLabels: Record<string, string> = { ingredients: "Ingrédients", utilities: "Services publics", rent: "Loyer", salary: "Salaires", equipment: "Équipement", transport: "Transport", other: "Autre" };
const expenseCategoryColors: Record<string, string> = { ingredients: "bg-orange-100 text-orange-700", utilities: "bg-blue-100 text-blue-700", rent: "bg-purple-100 text-purple-700", salary: "bg-green-100 text-green-700", equipment: "bg-cyan-100 text-cyan-700", transport: "bg-amber-100 text-amber-700", other: "bg-gray-100 text-gray-700" };

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
   CUSTOMER LOGIN
   ═══════════════════════════════════════════════════ */
function CustomerLogin({ onLogin, onRegister, onBack }: { onLogin: (customer: CustomerUser) => void; onRegister: () => void; onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const res = await fetch("/api/customer-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) { const data = await res.json().catch(() => null); setError(data?.error || "Email ou mot de passe incorrect"); return; }
      onLogin(await res.json());
    } catch { setError("Erreur de connexion au serveur"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-4">
      <div className="absolute top-20 right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl" />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md relative">
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                <UserCheck className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Espace Client</h1>
              <p className="text-gray-400 text-sm mt-1">Connectez-vous à votre compte</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Email</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 rounded-xl" />
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
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl py-6">
                {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : "Se Connecter"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button onClick={onRegister} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">Pas de compte ? Inscrivez-vous</button>
            </div>
            <div className="mt-4">
              <button onClick={onBack} className="w-full text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Retour au site
              </button>
            </div>
            <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10">
              <p className="text-xs text-gray-400 text-center">Demo : <span className="text-emerald-400">aminata@gmail.com</span> / <span className="text-emerald-400">client123</span></p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CUSTOMER REGISTER
   ═══════════════════════════════════════════════════ */
function CustomerRegister({ onRegister, onLogin, onBack }: { onRegister: (customer: CustomerUser) => void; onLogin: () => void; onBack: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", address: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const res = await fetch("/api/customer-register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const data = await res.json().catch(() => null); setError(data?.error || "Erreur lors de l'inscription"); return; }
      onRegister(await res.json());
    } catch { setError("Erreur de connexion au serveur"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-4">
      <div className="absolute top-20 right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl" />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md relative">
        <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                <UserPlus className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Créer un Compte</h1>
              <p className="text-gray-400 text-sm mt-1">Rejoignez KFM Delice</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Nom complet *</label>
                <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Votre nom" className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 rounded-xl" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Email *</label>
                <Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="votre@email.com" className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 rounded-xl" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Téléphone</label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+224 6XX XX XX XX" className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 rounded-xl" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Mot de passe *</label>
                <div className="relative">
                  <Input required type={showPw ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 rounded-xl pr-10" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1 block">Adresse</label>
                <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Votre adresse" className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 rounded-xl" />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl py-6">
                {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : "S'inscrire"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button onClick={onLogin} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">Déjà un compte ? Connectez-vous</button>
            </div>
            <div className="mt-4">
              <button onClick={onBack} className="w-full text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Retour au site
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CUSTOMER ACCOUNT DASHBOARD
   ═══════════════════════════════════════════════════ */
function CustomerAccount({ customer, onLogout, onUpdate }: { customer: CustomerUser; onLogout: () => void; onUpdate: (c: CustomerUser) => void }) {
  const [activeTab, setActiveTab] = useState("profil");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [orders, setOrders] = useState<OrderDB[]>([]);
  const [reviews, setReviews] = useState<ReviewDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Profile edit form
  const [profileForm, setProfileForm] = useState({ name: customer.name, email: customer.email, phone: customer.phone, address: customer.address });
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // New review form
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMsg, setReviewMsg] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, o, rv] = await Promise.all([
        fetch("/api/reservations").then(r => r.json()).catch(() => []),
        fetch("/api/orders").then(r => r.json()).catch(() => []),
        fetch("/api/reviews").then(r => r.json()).catch(() => []),
      ]);
      // Filter by customer
      setReservations((r as Reservation[]).filter((x: Reservation) => x.customerName === customer.name || x.phone === customer.phone));
      setOrders((o as OrderDB[]).filter((x: OrderDB) => x.customerName === customer.name || x.phone === customer.phone));
      setReviews((rv as ReviewDB[]).filter((x: ReviewDB) => x.customerName === customer.name));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [customer.name, customer.phone]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMsg("");
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customer.id, ...profileForm }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate({ ...customer, ...profileForm });
        setProfileMsg("Profil mis à jour avec succès !");
      } else {
        setProfileMsg("Erreur lors de la mise à jour");
      }
    } catch { setProfileMsg("Erreur de connexion"); }
    finally { setProfileSaving(false); }
  };

  const savePassword = async () => {
    if (!passwordForm.new) return;
    setProfileSaving(true); setProfileMsg("");
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customer.id, password: passwordForm.new }),
      });
      if (res.ok) { setProfileMsg("Mot de passe modifié !"); setPasswordForm({ current: "", new: "" }); }
      else { setProfileMsg("Erreur lors du changement de mot de passe"); }
    } catch { setProfileMsg("Erreur de connexion"); }
    finally { setProfileSaving(false); }
  };

  const submitReview = async () => {
    setReviewSaving(true); setReviewMsg("");
    try {
      const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
      const now = new Date();
      const dateStr = `${months[now.getMonth()]} ${now.getFullYear()}`;
      const res = await fetch("/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: customer.name, rating: reviewForm.rating, comment: reviewForm.comment, date: dateStr }),
      });
      if (res.ok) {
        setReviewMsg("Avis publié avec succès !");
        setReviewForm({ rating: 5, comment: "" });
        loadData();
      } else { setReviewMsg("Erreur lors de la publication"); }
    } catch { setReviewMsg("Erreur de connexion"); }
    finally { setReviewSaving(false); }
  };

  const sidebarItems = [
    { id: "profil", label: "Profil", icon: User },
    { id: "reservations", label: "Mes Réservations", icon: CalendarCheck, badge: reservations.filter(r => r.status === "pending" || r.status === "confirmed").length || undefined },
    { id: "commandes", label: "Mes Commandes", icon: ShoppingBag, badge: orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length || undefined },
    { id: "avis", label: "Mes Avis", icon: MessageSquare, badge: reviews.length || undefined },
    { id: "fidelite", label: "Points de fidélité", icon: Award },
  ];

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 hidden md:flex">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div className="overflow-hidden"><p className="font-bold text-gray-900 text-sm">KFM Delice</p><p className="text-[10px] text-gray-400">Mon Compte</p></div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === item.id ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20" : "text-gray-600 hover:bg-gray-100"}`}>
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.badge ? <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${activeTab === item.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{item.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 text-sm">
            <LogOut className="w-5 h-5 shrink-0" /><span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      <div className="md:hidden fixed bottom-4 left-4 z-50">
        <Button onClick={() => setSidebarOpen(!sidebarOpen)} size="sm" className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg">
          {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>
      </div>
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="md:hidden fixed top-0 left-0 bottom-0 w-72 bg-white z-50 shadow-xl flex flex-col">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0"><UserCheck className="w-5 h-5 text-white" /></div>
                    <div><p className="font-bold text-gray-900 text-sm">KFM Delice</p><p className="text-[10px] text-gray-400">Mon Compte</p></div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {sidebarItems.map((item) => (
                  <button key={item.id} onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === item.id ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20" : "text-gray-600 hover:bg-gray-100"}`}>
                    <item.icon className="w-5 h-5 shrink-0" /><span className="truncate">{item.label}</span>
                    {item.badge ? <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${activeTab === item.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{item.badge}</span> : null}
                  </button>
                ))}
              </nav>
              <div className="p-3 border-t border-gray-100">
                <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 text-sm"><LogOut className="w-5 h-5 shrink-0" /><span>Déconnexion</span></button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">{sidebarItems.find(s => s.id === activeTab)?.label}</h1>
            <p className="text-sm text-gray-500">Bonjour, {customer.name}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={loadData} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" /></button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold">{customer.name[0]}</div>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          {/* ═══════ PROFIL ═══════ */}
          {activeTab === "profil" && (
            <div className="space-y-6 max-w-2xl">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><User className="w-5 h-5 text-emerald-500" /> Informations personnelles</h3>
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div><label className="text-sm font-medium text-gray-700 mb-1 block">Nom</label><Input value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} /></div>
                      <div><label className="text-sm font-medium text-gray-700 mb-1 block">Email</label><Input type="email" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} /></div>
                      <div><label className="text-sm font-medium text-gray-700 mb-1 block">Téléphone</label><Input value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
                      <div><label className="text-sm font-medium text-gray-700 mb-1 block">Adresse</label><Input value={profileForm.address} onChange={e => setProfileForm({ ...profileForm, address: e.target.value })} /></div>
                    </div>
                    <Button onClick={saveProfile} disabled={profileSaving} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white">
                      {profileSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Enregistrer
                    </Button>
                  </div>
                  {profileMsg && <p className={`mt-3 text-sm ${profileMsg.includes("succès") ? "text-green-600" : "text-red-600"}`}>{profileMsg}</p>}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-500" /> Changer le mot de passe</h3>
                  <div className="space-y-4">
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Nouveau mot de passe</label><Input type="password" value={passwordForm.new} onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })} /></div>
                    <Button onClick={savePassword} disabled={profileSaving || !passwordForm.new} variant="outline" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50">
                      {profileSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />} Changer le mot de passe
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══════ MES RÉSERVATIONS ═══════ */}
          {activeTab === "reservations" && (
            <div className="space-y-4">
              {reservations.length === 0 ? (
                <Card><CardContent className="p-8 text-center"><CalendarCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Aucune réservation trouvée</p></CardContent></Card>
              ) : (
                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="bg-gray-50 border-b">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date & Heure</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pers.</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Zone</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Notes</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {reservations.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-700">{r.date} à {r.time}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{r.guests}</td>
                            <td className="px-4 py-3"><Badge variant="outline">{zoneLabels[r.zone] || r.zone}</Badge></td>
                            <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{r.notes || "-"}</td>
                            <td className="px-4 py-3"><Badge className={`${statusColors[r.status] || ""} text-xs`}>{statusLabels[r.status] || r.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════ MES COMMANDES ═══════ */}
          {activeTab === "commandes" && (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <Card><CardContent className="p-8 text-center"><ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Aucune commande trouvée</p></CardContent></Card>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {orders.map((o) => {
                    let items: { name: string; price: number; qty: number }[] = [];
                    try { items = JSON.parse(o.items); } catch { /* */ }
                    return (
                      <Card key={o.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <OrderTypeIcon type={o.orderType} />
                              <span className="text-sm font-medium text-gray-900">{orderTypeLabels[o.orderType] || o.orderType}</span>
                            </div>
                            <Badge className={`${statusColors[o.status] || ""} text-xs`}>{statusLabels[o.status] || o.status}</Badge>
                          </div>
                          <div className="space-y-1 mb-3">
                            {items.map((it, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-600">{it.name} x{it.qty}</span>
                                <span className="text-gray-900 font-medium">{formatPrice(it.price * it.qty)}</span>
                              </div>
                            ))}
                          </div>
                          {o.deliveryAddress && <p className="text-xs text-gray-500 mb-2">📍 {o.deliveryAddress}</p>}
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</span>
                            <span className="text-sm font-bold text-gray-900">{formatPrice(o.total + o.deliveryFee)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════ MES AVIS ═══════ */}
          {activeTab === "avis" && (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><PenSquare className="w-5 h-5 text-emerald-500" /> Écrire un avis</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Note</label>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(i => (
                          <button key={i} onClick={() => setReviewForm({ ...reviewForm, rating: i })} className="p-1">
                            <Star className={`w-6 h-6 ${i <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"} transition-colors`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Commentaire</label>
                      <Textarea value={reviewForm.comment} onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })} placeholder="Partagez votre expérience..." rows={3} />
                    </div>
                    <Button onClick={submitReview} disabled={reviewSaving || !reviewForm.comment} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white">
                      {reviewSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />} Publier l'avis
                    </Button>
                    {reviewMsg && <p className={`text-sm ${reviewMsg.includes("succès") ? "text-green-600" : "text-red-600"}`}>{reviewMsg}</p>}
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <Card><CardContent className="p-8 text-center"><MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Aucun avis publié</p></CardContent></Card>
                ) : (
                  reviews.map((r) => (
                    <Card key={r.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-1 mb-2">{[1,2,3,4,5].map(i => <Star key={i} className={`w-4 h-4 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} />)}</div>
                        <p className="text-sm text-gray-600 mb-2">&ldquo;{r.comment}&rdquo;</p>
                        <p className="text-xs text-gray-400">{r.date}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ═══════ POINTS DE FIDÉLITÉ ═══════ */}
          {activeTab === "fidelite" && (
            <div className="space-y-6 max-w-2xl">
              <div className="grid sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6 text-center">
                    <Award className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-900">{customer.loyaltyPoints}</p>
                    <p className="text-sm text-gray-500">Points de fidélité</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <ShoppingBag className="w-10 h-10 text-teal-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-900">{customer.totalOrders}</p>
                    <p className="text-sm text-gray-500">Commandes totales</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 text-center">
                    <DollarSign className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-900">{formatPrice(customer.totalSpent)}</p>
                    <p className="text-sm text-gray-500">Total dépensé</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Comment gagner des points ?</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl"><CalendarCheck className="w-5 h-5 text-emerald-600" /><div><p className="text-sm font-medium text-gray-900">Réservation</p><p className="text-xs text-gray-500">+50 points par réservation</p></div></div>
                    <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-xl"><ShoppingBag className="w-5 h-5 text-teal-600" /><div><p className="text-sm font-medium text-gray-900">Commande</p><p className="text-xs text-gray-500">+10 points par 10 000 GNF dépensés</p></div></div>
                    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl"><MessageSquare className="w-5 h-5 text-amber-600" /><div><p className="text-sm font-medium text-gray-900">Avis client</p><p className="text-xs text-gray-500">+25 points par avis publié</p></div></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
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
  const [staffList, setStaffList] = useState<StaffDB[]>([]);
  const [admins, setAdmins] = useState<AdminDB[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDB[]>([]);
  const [quotes, setQuotes] = useState<QuoteDB[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Staff form
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffDB | null>(null);
  const [deleteStaffConfirm, setDeleteStaffConfirm] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({ name: "", phone: "", role: "serveur", salary: 0, status: "active", hireDate: "", notes: "" });

  // Admin form
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminDB | null>(null);
  const [deleteAdminConfirm, setDeleteAdminConfirm] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState({ email: "", password: "", name: "", role: "staff", status: "active" });

  // Invoice form
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceDB | null>(null);
  const [deleteInvoiceConfirm, setDeleteInvoiceConfirm] = useState<string | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({ number: "", customerName: "", customerPhone: "", items: "[]", subtotal: 0, tax: 0, total: 0, status: "pending", dueDate: "", notes: "" });

  // Quote form
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuoteDB | null>(null);
  const [deleteQuoteConfirm, setDeleteQuoteConfirm] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState({ number: "", customerName: "", customerPhone: "", items: "[]", subtotal: 0, discount: 0, total: 0, status: "draft", validUntil: "", notes: "" });

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseDB | null>(null);
  const [deleteExpenseConfirm, setDeleteExpenseConfirm] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({ description: "", amount: 0, category: "other", date: "", paidBy: "", notes: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, m, o, d, rv, st, ad, inv, quo, exp] = await Promise.all([
        fetch("/api/stats").then(r => r.json()),
        fetch("/api/reservations").then(r => r.json()),
        fetch("/api/menu").then(r => r.json()),
        fetch("/api/orders").then(r => r.json()),
        fetch("/api/drivers").then(r => r.json()),
        fetch("/api/reviews").then(r => r.json()).catch(() => []),
        fetch("/api/staff").then(r => r.json()).catch(() => []),
        fetch("/api/admins").then(r => r.json()).catch(() => []),
        fetch("/api/invoices").then(r => r.json()).catch(() => []),
        fetch("/api/quotes").then(r => r.json()).catch(() => []),
        fetch("/api/expenses").then(r => r.json()).catch(() => []),
      ]);
      setStats(s); setReservations(r); setMenuItems(m); setOrders(o); setDrivers(d); setReviews(rv); setStaffList(st); setAdmins(ad); setInvoices(inv); setQuotes(quo); setExpenses(exp);
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

  const allSidebarItems = [
    { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard, roles: ["admin", "manager"] },
    { id: "reservations", label: "Réservations", icon: CalendarCheck, badge: stats?.pendingReservations, roles: ["admin", "manager", "staff"] },
    { id: "orders", label: "Commandes", icon: ShoppingBag, badge: stats?.activeOrders, roles: ["admin", "manager", "staff"] },
    { id: "menu", label: "Menu", icon: UtensilsCrossed, badge: menuItems.length, roles: ["admin", "manager"] },
    { id: "deliveries", label: "Livraisons", icon: Bike, badge: stats?.activeDeliveries, roles: ["admin", "manager", "staff"] },
    { id: "drivers", label: "Livreurs", icon: Car, badge: stats?.availableDrivers, roles: ["admin", "manager"] },
    { id: "reviews", label: "Avis", icon: MessageSquare, badge: stats?.totalReviews, roles: ["admin", "manager", "staff"] },
    { id: "staff", label: "Personnel", icon: Users, badge: staffList.length, roles: ["admin", "manager"] },
    { id: "admins", label: "Utilisateurs", icon: UserCog, badge: admins.length, roles: ["admin"] },
    { id: "invoices", label: "Factures", icon: FileText, badge: invoices.filter(i => i.status === "pending").length || undefined, roles: ["admin", "manager"] },
    { id: "quotes", label: "Devis", icon: ClipboardList, badge: quotes.filter(q => q.status === "sent").length || undefined, roles: ["admin", "manager"] },
    { id: "expenses", label: "Dépenses", icon: Wallet, badge: expenses.length, roles: ["admin", "manager"] },
  ];

  const sidebarItems = allSidebarItems.filter(item => item.roles.includes(admin.role));
  const isAdmin = admin.role === "admin";
  const isManager = admin.role === "manager";
  const isStaffRole = admin.role === "staff";
  const canCreate = isAdmin || isManager;
  const canDelete = isAdmin;

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
          {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>
      </div>
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="md:hidden fixed top-0 left-0 bottom-0 w-72 bg-white z-50 shadow-xl flex flex-col"
            >
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-5 h-5 text-white" />
                    </div>
                    <div><p className="font-bold text-gray-900 text-sm">KFM Delice</p><p className="text-[10px] text-gray-400">Administration</p></div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {sidebarItems.map((item) => (
                  <button key={item.id} onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === item.id ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/20" : "text-gray-600 hover:bg-gray-100"}`}>
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.badge ? <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${activeTab === item.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{item.badge}</span> : null}
                  </button>
                ))}
              </nav>
              <div className="p-3 border-t border-gray-100">
                <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 text-sm">
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
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

          {/* ═══════ PERSONNEL ═══════ */}
          {activeTab === "staff" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-700">{staffList.filter(s => s.status === "active").length} Actifs</Badge>
                  <Badge className="bg-amber-100 text-amber-700">{staffList.filter(s => s.status === "on_leave").length} En congé</Badge>
                  <Badge className="bg-red-100 text-red-700">{staffList.filter(s => s.status === "inactive").length} Inactifs</Badge>
                </div>
                <Button onClick={() => { setEditingStaff(null); setStaffForm({ name: "", phone: "", role: "serveur", salary: 0, status: "active", hireDate: new Date().toISOString().split("T")[0], notes: "" }); setShowStaffForm(true); }} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </div>

              <AnimatePresence>
                {showStaffForm && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="border-orange-200 bg-orange-50/30">
                      <CardContent className="p-4 sm:p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">{editingStaff ? "Modifier le membre" : "Ajouter un membre"}</h3>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label><Input value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} placeholder="Nom complet" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone</label><Input value={staffForm.phone} onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })} placeholder="+224 6XX XX XX XX" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Rôle *</label>
                            <select value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                              {Object.entries(staffRoleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Salaire (GNF)</label><Input type="number" value={staffForm.salary || ""} onChange={e => setStaffForm({ ...staffForm, salary: parseInt(e.target.value) || 0 })} placeholder="600000" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Statut</label>
                            <select value={staffForm.status} onChange={e => setStaffForm({ ...staffForm, status: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                              <option value="active">Actif</option><option value="on_leave">En congé</option><option value="inactive">Inactif</option>
                            </select>
                          </div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Date d'embauche</label><Input type="date" value={staffForm.hireDate} onChange={e => setStaffForm({ ...staffForm, hireDate: e.target.value })} /></div>
                          <div className="sm:col-span-2 lg:col-span-3"><label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label><Input value={staffForm.notes} onChange={e => setStaffForm({ ...staffForm, notes: e.target.value })} placeholder="Notes supplémentaires" /></div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button onClick={async () => { if (editingStaff) { await apiPatch("/api/staff", { id: editingStaff.id, ...staffForm }); } else { await apiPost("/api/staff", staffForm); } setShowStaffForm(false); setEditingStaff(null); }} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingStaff ? "Enregistrer" : "Ajouter"}</Button>
                          <Button variant="outline" onClick={() => { setShowStaffForm(false); setEditingStaff(null); }}>Annuler</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="bg-gray-50 border-b">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nom</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rôle</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Téléphone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Salaire</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {staffList.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900">{s.name}</p><p className="text-xs text-gray-500">Depuis {s.hireDate || "-"}</p></td>
                          <td className="px-4 py-3"><Badge className={`${expenseCategoryColors[s.role] || "bg-gray-100 text-gray-700"} text-xs`}>{staffRoleLabels[s.role] || s.role}</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-700">{s.phone || "-"}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatPrice(s.salary)}</td>
                          <td className="px-4 py-3"><Badge className={`${staffStatusColors[s.status] || ""} text-xs`}>{staffStatusLabels[s.status] || s.status}</Badge></td>
                          <td className="px-4 py-3"><div className="flex items-center gap-1">
                            <button onClick={() => { setEditingStaff(s); setStaffForm({ name: s.name, phone: s.phone, role: s.role, salary: s.salary, status: s.status, hireDate: s.hireDate, notes: s.notes }); setShowStaffForm(true); }} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600" title="Modifier"><Edit3 className="w-4 h-4" /></button>
                            {deleteStaffConfirm === s.id ? (
                              <div className="flex items-center gap-1"><button onClick={() => { apiDelete("/api/staff", { id: s.id }); setDeleteStaffConfirm(null); }} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button><button onClick={() => setDeleteStaffConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">Non</button></div>
                            ) : (
                              <button onClick={() => setDeleteStaffConfirm(s.id)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ UTILISATEURS ═══════ */}
          {activeTab === "admins" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-700">{admins.filter(a => a.status === "active").length} Actifs</Badge>
                  <Badge className="bg-red-100 text-red-700">{admins.filter(a => a.status === "inactive").length} Inactifs</Badge>
                </div>
                <Button onClick={() => { setEditingAdmin(null); setAdminForm({ email: "", password: "", name: "", role: "staff", status: "active" }); setShowAdminForm(true); }} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
                  <Plus className="w-4 h-4 mr-1" /> Ajouter un utilisateur
                </Button>
              </div>

              <AnimatePresence>
                {showAdminForm && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="border-orange-200 bg-orange-50/30">
                      <CardContent className="p-4 sm:p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">{editingAdmin ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}</h3>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Nom *</label><Input value={adminForm.name} onChange={e => setAdminForm({ ...adminForm, name: e.target.value })} placeholder="Nom complet" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Email *</label><Input type="email" value={adminForm.email} onChange={e => setAdminForm({ ...adminForm, email: e.target.value })} placeholder="email@exemple.com" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Mot de passe {!editingAdmin && "*"}</label><Input type="password" value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} placeholder={editingAdmin ? "Laisser vide pour ne pas changer" : "Mot de passe"} /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Rôle *</label>
                            <select value={adminForm.role} onChange={e => setAdminForm({ ...adminForm, role: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                              {Object.entries(adminRoleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Statut</label>
                            <select value={adminForm.status} onChange={e => setAdminForm({ ...adminForm, status: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                              <option value="active">Actif</option><option value="inactive">Inactif</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button onClick={async () => { const body: any = { ...adminForm }; if (editingAdmin) { if (!body.password) delete body.password; await apiPatch("/api/admins", { id: editingAdmin.id, ...body }); } else { await apiPost("/api/admins", body); } setShowAdminForm(false); setEditingAdmin(null); }} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingAdmin ? "Enregistrer" : "Ajouter"}</Button>
                          <Button variant="outline" onClick={() => { setShowAdminForm(false); setEditingAdmin(null); }}>Annuler</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {admins.map(a => (
                  <Card key={a.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center text-sm font-bold text-orange-600">{a.name[0]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{a.name}</p>
                          <p className="text-xs text-gray-500 truncate">{a.email}</p>
                        </div>
                        <Badge className={`${a.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} text-xs`}>{a.status === "active" ? "Actif" : "Inactif"}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">{adminRoleLabels[a.role] || a.role}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => apiPatch("/api/admins", { id: a.id, status: a.status === "active" ? "inactive" : "active" })} className={`flex-1 text-xs rounded-lg ${a.status === "active" ? "text-red-500 border-red-200" : "text-green-500 border-green-200"}`}>
                          {a.status === "active" ? "Désactiver" : "Activer"}
                        </Button>
                        <button onClick={() => { setEditingAdmin(a); setAdminForm({ email: a.email, password: "", name: a.name, role: a.role, status: a.status }); setShowAdminForm(true); }} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600" title="Modifier"><Edit3 className="w-4 h-4" /></button>
                        {a.id !== admin.id && (deleteAdminConfirm === a.id ? (
                          <div className="flex items-center gap-1"><button onClick={() => { apiDelete("/api/admins", { id: a.id }); setDeleteAdminConfirm(null); }} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button><button onClick={() => setDeleteAdminConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">Non</button></div>
                        ) : (
                          <button onClick={() => setDeleteAdminConfirm(a.id)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ═══════ FACTURES ═══════ */}
          {activeTab === "invoices" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-100 text-amber-700">{invoices.filter(i => i.status === "pending").length} En attente</Badge>
                  <Badge className="bg-green-100 text-green-700">{invoices.filter(i => i.status === "paid").length} Payées</Badge>
                  <Badge className="bg-red-100 text-red-700">{invoices.filter(i => i.status === "overdue").length} En retard</Badge>
                </div>
                <Button onClick={() => { setEditingInvoice(null); const today = new Date().toISOString().split("T")[0]; const count = invoices.length + 1; setInvoiceForm({ number: `FAC-2026-${String(count).padStart(3, "0")}`, customerName: "", customerPhone: "", items: "[]", subtotal: 0, tax: 0, total: 0, status: "pending", dueDate: today, notes: "" }); setShowInvoiceForm(true); }} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
                  <Plus className="w-4 h-4 mr-1" /> Nouvelle facture
                </Button>
              </div>

              {/* Invoice summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card><CardContent className="p-3"><p className="text-xs text-gray-500">Total facturé</p><p className="text-lg font-bold text-gray-900">{formatPrice(invoices.reduce((s, i) => s + i.total, 0))}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-xs text-gray-500">Payé</p><p className="text-lg font-bold text-green-600">{formatPrice(invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0))}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-xs text-gray-500">En attente</p><p className="text-lg font-bold text-amber-600">{formatPrice(invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.total, 0))}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-xs text-gray-500">En retard</p><p className="text-lg font-bold text-red-600">{formatPrice(invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.total, 0))}</p></CardContent></Card>
              </div>

              <AnimatePresence>
                {showInvoiceForm && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="border-orange-200 bg-orange-50/30">
                      <CardContent className="p-4 sm:p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">{editingInvoice ? "Modifier la facture" : "Nouvelle facture"}</h3>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">N° Facture *</label><Input value={invoiceForm.number} onChange={e => setInvoiceForm({ ...invoiceForm, number: e.target.value })} placeholder="FAC-2026-001" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Client *</label><Input value={invoiceForm.customerName} onChange={e => setInvoiceForm({ ...invoiceForm, customerName: e.target.value })} placeholder="Nom du client" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone</label><Input value={invoiceForm.customerPhone} onChange={e => setInvoiceForm({ ...invoiceForm, customerPhone: e.target.value })} placeholder="+224 ..." /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Sous-total (GNF)</label><Input type="number" value={invoiceForm.subtotal || ""} onChange={e => { const v = parseInt(e.target.value) || 0; setInvoiceForm({ ...invoiceForm, subtotal: v, total: v + invoiceForm.tax }); }} placeholder="350000" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Taxe (GNF)</label><Input type="number" value={invoiceForm.tax || ""} onChange={e => { const v = parseInt(e.target.value) || 0; setInvoiceForm({ ...invoiceForm, tax: v, total: invoiceForm.subtotal + v }); }} placeholder="52500" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Total (GNF)</label><p className="h-9 flex items-center text-sm font-bold text-orange-600">{formatPrice(invoiceForm.total)}</p></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Échéance</label><Input type="date" value={invoiceForm.dueDate} onChange={e => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} /></div>
                          <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label><Input value={invoiceForm.notes} onChange={e => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} placeholder="Notes" /></div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button onClick={async () => { if (editingInvoice) { await apiPatch("/api/invoices", { id: editingInvoice.id, ...invoiceForm }); } else { await apiPost("/api/invoices", invoiceForm); } setShowInvoiceForm(false); setEditingInvoice(null); }} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingInvoice ? "Enregistrer" : "Créer"}</Button>
                          <Button variant="outline" onClick={() => { setShowInvoiceForm(false); setEditingInvoice(null); }}>Annuler</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {invoices.map(inv => {
                  let lineItems: { description: string; qty: number; unitPrice: number; total: number }[] = [];
                  try { lineItems = JSON.parse(inv.items); } catch { /* */ }
                  return (
                    <Card key={inv.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="flex items-center gap-2"><p className="font-semibold text-gray-900 text-sm">{inv.number}</p><Badge className={`${invoiceStatusColors[inv.status] || ""} text-xs`}>{invoiceStatusLabels[inv.status] || inv.status}</Badge></div>
                            <p className="text-sm text-gray-700">{inv.customerName}</p>
                            {inv.customerPhone && <p className="text-xs text-gray-500">{inv.customerPhone}</p>}
                          </div>
                          <p className="text-lg font-bold text-orange-600">{formatPrice(inv.total)}</p>
                        </div>
                        {lineItems.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-2 mb-2 text-xs space-y-1">
                            {lineItems.map((li, j) => <div key={j} className="flex justify-between"><span className="text-gray-600">{li.description} x{li.qty}</span><span className="font-medium">{formatPrice(li.total)}</span></div>)}
                            <Separator className="my-1" />
                            <div className="flex justify-between"><span className="text-gray-500">Sous-total: {formatPrice(inv.subtotal)}</span><span className="text-gray-500">Taxe: {formatPrice(inv.tax)}</span></div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                          <span>Échéance: {inv.dueDate || "-"}</span>
                          {inv.notes && <span>• {inv.notes}</span>}
                        </div>
                        <div className="flex gap-2">
                          {inv.status === "pending" && <Button size="sm" onClick={() => apiPatch("/api/invoices", { id: inv.id, status: "paid" })} className="bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Marquer payée</Button>}
                          {inv.status === "pending" && <Button size="sm" variant="outline" onClick={() => apiPatch("/api/invoices", { id: inv.id, status: "overdue" })} className="text-red-500 border-red-200 hover:bg-red-50 text-xs rounded-lg">En retard</Button>}
                          {inv.status === "overdue" && <Button size="sm" onClick={() => apiPatch("/api/invoices", { id: inv.id, status: "paid" })} className="bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Marquer payée</Button>}
                          {inv.status !== "cancelled" && inv.status !== "paid" && <Button size="sm" variant="outline" onClick={() => apiPatch("/api/invoices", { id: inv.id, status: "cancelled" })} className="text-red-500 border-red-200 text-xs rounded-lg"><XCircle className="w-3 h-3" /></Button>}
                          <button onClick={() => { setEditingInvoice(inv); setInvoiceForm({ number: inv.number, customerName: inv.customerName, customerPhone: inv.customerPhone, items: inv.items, subtotal: inv.subtotal, tax: inv.tax, total: inv.total, status: inv.status, dueDate: inv.dueDate, notes: inv.notes }); setShowInvoiceForm(true); }} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600" title="Modifier"><Edit3 className="w-4 h-4" /></button>
                          {deleteInvoiceConfirm === inv.id ? (
                            <div className="flex items-center gap-1"><button onClick={() => { apiDelete("/api/invoices", { id: inv.id }); setDeleteInvoiceConfirm(null); }} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button><button onClick={() => setDeleteInvoiceConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">Non</button></div>
                          ) : (
                            <button onClick={() => setDeleteInvoiceConfirm(inv.id)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {invoices.length === 0 && <Card><CardContent className="p-8 text-center"><Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Aucune facture</p></CardContent></Card>}
              </div>
            </div>
          )}

          {/* ═══════ DEVIS ═══════ */}
          {activeTab === "quotes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-gray-100 text-gray-700">{quotes.filter(q => q.status === "draft").length} Brouillons</Badge>
                  <Badge className="bg-blue-100 text-blue-700">{quotes.filter(q => q.status === "sent").length} Envoyés</Badge>
                  <Badge className="bg-green-100 text-green-700">{quotes.filter(q => q.status === "accepted").length} Acceptés</Badge>
                </div>
                <Button onClick={() => { setEditingQuote(null); const count = quotes.length + 1; setQuoteForm({ number: `DEV-2026-${String(count).padStart(3, "0")}`, customerName: "", customerPhone: "", items: "[]", subtotal: 0, discount: 0, total: 0, status: "draft", validUntil: "", notes: "" }); setShowQuoteForm(true); }} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
                  <Plus className="w-4 h-4 mr-1" /> Nouveau devis
                </Button>
              </div>

              <AnimatePresence>
                {showQuoteForm && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="border-orange-200 bg-orange-50/30">
                      <CardContent className="p-4 sm:p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">{editingQuote ? "Modifier le devis" : "Nouveau devis"}</h3>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">N° Devis *</label><Input value={quoteForm.number} onChange={e => setQuoteForm({ ...quoteForm, number: e.target.value })} placeholder="DEV-2026-001" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Client *</label><Input value={quoteForm.customerName} onChange={e => setQuoteForm({ ...quoteForm, customerName: e.target.value })} placeholder="Nom du client" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone</label><Input value={quoteForm.customerPhone} onChange={e => setQuoteForm({ ...quoteForm, customerPhone: e.target.value })} placeholder="+224 ..." /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Sous-total (GNF)</label><Input type="number" value={quoteForm.subtotal || ""} onChange={e => { const v = parseInt(e.target.value) || 0; setQuoteForm({ ...quoteForm, subtotal: v, total: v - quoteForm.discount }); }} /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Remise (GNF)</label><Input type="number" value={quoteForm.discount || ""} onChange={e => { const v = parseInt(e.target.value) || 0; setQuoteForm({ ...quoteForm, discount: v, total: quoteForm.subtotal - v }); }} /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Total (GNF)</label><p className="h-9 flex items-center text-sm font-bold text-orange-600">{formatPrice(quoteForm.total)}</p></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Valide jusqu'au</label><Input type="date" value={quoteForm.validUntil} onChange={e => setQuoteForm({ ...quoteForm, validUntil: e.target.value })} /></div>
                          <div className="sm:col-span-2"><label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label><Input value={quoteForm.notes} onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })} placeholder="Notes" /></div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button onClick={async () => { if (editingQuote) { await apiPatch("/api/quotes", { id: editingQuote.id, ...quoteForm }); } else { await apiPost("/api/quotes", quoteForm); } setShowQuoteForm(false); setEditingQuote(null); }} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingQuote ? "Enregistrer" : "Créer"}</Button>
                          <Button variant="outline" onClick={() => { setShowQuoteForm(false); setEditingQuote(null); }}>Annuler</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-3">
                {quotes.map(q => {
                  let lineItems: { description: string; qty: number; unitPrice: number; total: number }[] = [];
                  try { lineItems = JSON.parse(q.items); } catch { /* */ }
                  return (
                    <Card key={q.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="flex items-center gap-2"><p className="font-semibold text-gray-900 text-sm">{q.number}</p><Badge className={`${quoteStatusColors[q.status] || ""} text-xs`}>{quoteStatusLabels[q.status] || q.status}</Badge></div>
                            <p className="text-sm text-gray-700">{q.customerName}</p>
                          </div>
                          <p className="text-lg font-bold text-orange-600">{formatPrice(q.total)}</p>
                        </div>
                        {lineItems.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-2 mb-2 text-xs space-y-1">
                            {lineItems.map((li, j) => <div key={j} className="flex justify-between"><span className="text-gray-600">{li.description} x{li.qty}</span><span className="font-medium">{formatPrice(li.total)}</span></div>)}
                            {q.discount > 0 && <div className="flex justify-between text-green-600"><span>Remise</span><span>-{formatPrice(q.discount)}</span></div>}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                          <span>Valide jusqu'au: {q.validUntil || "-"}</span>
                          {q.notes && <span>• {q.notes}</span>}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {q.status === "draft" && <Button size="sm" onClick={() => apiPatch("/api/quotes", { id: q.id, status: "sent" })} className="bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg">Envoyer</Button>}
                          {q.status === "sent" && <><Button size="sm" onClick={() => apiPatch("/api/quotes", { id: q.id, status: "accepted" })} className="bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Accepter</Button><Button size="sm" variant="outline" onClick={() => apiPatch("/api/quotes", { id: q.id, status: "refused" })} className="text-red-500 border-red-200 text-xs rounded-lg">Refuser</Button></>}
                          <button onClick={() => { setEditingQuote(q); setQuoteForm({ number: q.number, customerName: q.customerName, customerPhone: q.customerPhone, items: q.items, subtotal: q.subtotal, discount: q.discount, total: q.total, status: q.status, validUntil: q.validUntil, notes: q.notes }); setShowQuoteForm(true); }} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600" title="Modifier"><Edit3 className="w-4 h-4" /></button>
                          {deleteQuoteConfirm === q.id ? (
                            <div className="flex items-center gap-1"><button onClick={() => { apiDelete("/api/quotes", { id: q.id }); setDeleteQuoteConfirm(null); }} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button><button onClick={() => setDeleteQuoteConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">Non</button></div>
                          ) : (
                            <button onClick={() => setDeleteQuoteConfirm(q.id)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {quotes.length === 0 && <Card><CardContent className="p-8 text-center"><ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">Aucun devis</p></CardContent></Card>}
              </div>
            </div>
          )}

          {/* ═══════ DÉPENSES ═══════ */}
          {activeTab === "expenses" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-500">Total: <span className="font-bold text-gray-900">{formatPrice(expenses.reduce((s, e) => s + e.amount, 0))}</span></p>
                </div>
                <Button onClick={() => { setEditingExpense(null); setExpenseForm({ description: "", amount: 0, category: "other", date: new Date().toISOString().split("T")[0], paidBy: "", notes: "" }); setShowExpenseForm(true); }} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
                  <Plus className="w-4 h-4 mr-1" /> Ajouter une dépense
                </Button>
              </div>

              {/* Expense summary by category */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {Object.entries(expenseCategoryLabels).map(([key, label]) => {
                  const total = expenses.filter(e => e.category === key).reduce((s, e) => s + e.amount, 0);
                  return (
                    <Card key={key} className="hover:shadow-sm transition-shadow"><CardContent className="p-2.5 text-center">
                      <Badge className={`${expenseCategoryColors[key]} text-[10px] mb-1`}>{label}</Badge>
                      <p className="text-xs font-bold text-gray-900">{formatPrice(total)}</p>
                    </CardContent></Card>
                  );
                })}
              </div>

              <AnimatePresence>
                {showExpenseForm && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <Card className="border-orange-200 bg-orange-50/30">
                      <CardContent className="p-4 sm:p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">{editingExpense ? "Modifier la dépense" : "Ajouter une dépense"}</h3>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Description *</label><Input value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Description de la dépense" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Montant (GNF) *</label><Input type="number" value={expenseForm.amount || ""} onChange={e => setExpenseForm({ ...expenseForm, amount: parseInt(e.target.value) || 0 })} placeholder="500000" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Catégorie *</label>
                            <select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                              {Object.entries(expenseCategoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Date *</label><Input type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Payé par</label><Input value={expenseForm.paidBy} onChange={e => setExpenseForm({ ...expenseForm, paidBy: e.target.value })} placeholder="Nom" /></div>
                          <div><label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label><Input value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })} placeholder="Notes" /></div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button onClick={async () => { if (editingExpense) { await apiPatch("/api/expenses", { id: editingExpense.id, ...expenseForm }); } else { await apiPost("/api/expenses", expenseForm); } setShowExpenseForm(false); setEditingExpense(null); }} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"><Save className="w-4 h-4 mr-1" /> {editingExpense ? "Enregistrer" : "Ajouter"}</Button>
                          <Button variant="outline" onClick={() => { setShowExpenseForm(false); setEditingExpense(null); }}>Annuler</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="bg-gray-50 border-b">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Montant</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Catégorie</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Payé par</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {expenses.map(e => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900">{e.description}</p>{e.notes && <p className="text-xs text-gray-500">{e.notes}</p>}</td>
                          <td className="px-4 py-3 text-sm font-bold text-red-600">{formatPrice(e.amount)}</td>
                          <td className="px-4 py-3"><Badge className={`${expenseCategoryColors[e.category] || "bg-gray-100 text-gray-700"} text-xs`}>{expenseCategoryLabels[e.category] || e.category}</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-700">{e.date}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{e.paidBy || "-"}</td>
                          <td className="px-4 py-3"><div className="flex items-center gap-1">
                            <button onClick={() => { setEditingExpense(e); setExpenseForm({ description: e.description, amount: e.amount, category: e.category, date: e.date, paidBy: e.paidBy, notes: e.notes }); setShowExpenseForm(true); }} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600" title="Modifier"><Edit3 className="w-4 h-4" /></button>
                            {deleteExpenseConfirm === e.id ? (
                              <div className="flex items-center gap-1"><button onClick={() => { apiDelete("/api/expenses", { id: e.id }); setDeleteExpenseConfirm(null); }} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button><button onClick={() => setDeleteExpenseConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">Non</button></div>
                            ) : (
                              <button onClick={() => setDeleteExpenseConfirm(e.id)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
function PublicNavbar({ onAdminClick, onCustomerClick, customer }: { onAdminClick: () => void; onCustomerClick: () => void; customer: CustomerUser | null; }) {
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
            {customer ? (
              <button onClick={onCustomerClick} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${scrolled ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"}`}>
                <UserCheck className="w-4 h-4" /> {customer.name.split(" ")[0]}
              </button>
            ) : (
              <button onClick={onCustomerClick} className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${scrolled ? "text-emerald-600 hover:text-emerald-700" : "text-emerald-400 hover:text-emerald-300"}`}>
                <User className="w-4 h-4" /> Connexion
              </button>
            )}
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
            {customer ? (
              <button onClick={() => { setMenuOpen(false); onCustomerClick(); }} className="w-full mt-2 py-3 px-4 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm flex items-center gap-2"><UserCheck className="w-4 h-4" /> Mon Compte ({customer.name})</button>
            ) : (
              <button onClick={() => { setMenuOpen(false); onCustomerClick(); }} className="w-full mt-2 py-3 px-4 text-emerald-600 hover:bg-emerald-50 rounded-lg text-sm flex items-center gap-2"><User className="w-4 h-4" /> Connexion Client</button>
            )}
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
                    <a href={`https://wa.me/224622345678?text=${encodeURIComponent(`Bonjour, je souhaite commander: ${item.name} - ${formatPrice(item.price)}`)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"><MessageCircle className="w-3.5 h-3.5" /> Commander</a>
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
    try { await fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, status: "pending", loyaltyPoint: 50 }) }); setSubmitted(true); } catch { /* */ }
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
   PUBLIC AVIS (REVIEWS) SECTION
   ═══════════════════════════════════════════════════ */
function AvisSection() {
  const [reviews, setReviews] = useState<ReviewDB[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/reviews").then(r => r.json()).then(d => { setReviews(d); setLoading(false); }).catch(() => setLoading(false)); }, []);
  return (
    <section id="avis" className="py-20 bg-gradient-to-br from-orange-50/50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-orange-100 text-orange-700 mb-4">Avis Clients</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Ce Que Disent Nos <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">Clients</span></h2>
          <p className="text-gray-500 max-w-2xl mx-auto">Découvrez les témoignages de nos clients satisfaits</p>
        </AnimatedSection>
        {loading ? <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 text-orange-500 animate-spin" /></div> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.slice(0, 6).map((r) => (
              <AnimatedSection key={r.id}>
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-1 mb-3">
                      {[1,2,3,4,5].map(i => <Star key={i} className={`w-4 h-4 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} />)}
                    </div>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">&ldquo;{r.comment}&rdquo;</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center text-sm font-bold text-orange-600">{r.customerName[0]}</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{r.customerName}</p>
                        <p className="text-xs text-gray-500">{r.date}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
            {reviews.length === 0 && <p className="text-gray-500 text-center col-span-full py-8">Aucun avis pour le moment</p>}
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   PUBLIC ABOUT SECTION
   ═══════════════════════════════════════════════════ */
function AboutSection() {
  const features = [
    { icon: UtensilsCrossed, title: "Cuisine Authentique", desc: "Des plats traditionnels guinéens préparés avec passion et savoir-faire" },
    { icon: Clock, title: "Service Rapide", desc: "Un service efficace et attentionné pour votre plus grand confort" },
    { icon: Smartphone, title: "Commande en Ligne", desc: "Commandez facilement via WhatsApp et recevez chez vous" },
    { icon: Heart, title: "Fait avec Amour", desc: "Chaque plat est préparé avec des ingrédients frais et sélectionnés" },
    { icon: ShieldCheck, title: "Hygiène Certifiée", desc: "Respect strict des normes d'hygiène et de sécurité alimentaire" },
    { icon: MapPin, title: "Emplacement Idéal", desc: "Au cœur de Conakry, sur la Corniche Nord avec vue magnifique" },
  ];
  return (
    <section id="apropos" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-orange-100 text-orange-700 mb-4">À Propos</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Pourquoi Choisir <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">KFM Delice</span></h2>
          <p className="text-gray-500 max-w-2xl mx-auto">{RESTO.description}</p>
        </AnimatedSection>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <AnimatedSection key={i} delay={i * 0.1}>
              <Card className="h-full hover:shadow-lg transition-shadow border-none shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center mx-auto mb-4">
                    <f.icon className="w-7 h-7 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500">{f.desc}</p>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
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
            <a href="https://wa.me/224622345678" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-orange-500 hover:text-white transition-colors"><MessageCircle className="w-4 h-4" /></a>
            <a href="tel:+224622345678" className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-orange-500 hover:text-white transition-colors"><Smartphone className="w-4 h-4" /></a>
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
  const [mode, setMode] = useState<"public" | "login" | "admin" | "customer_login" | "customer_register" | "customer_account">("public");
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [customer, setCustomer] = useState<CustomerUser | null>(null);

  // Seed DB on first load
  useEffect(() => { fetch("/api/seed", { method: "POST" }).catch(() => {}); }, []);

  if (mode === "admin" && admin) return <AdminDashboard admin={admin} onLogout={() => { setMode("public"); setAdmin(null); }} />;
  if (mode === "login") return <AdminLogin onLogin={(a) => { setAdmin(a); setMode("admin"); }} />;
  if (mode === "customer_login") return <CustomerLogin onLogin={(c) => { setCustomer(c); setMode("customer_account"); }} onRegister={() => setMode("customer_register")} onBack={() => setMode("public")} />;
  if (mode === "customer_register") return <CustomerRegister onRegister={(c) => { setCustomer(c); setMode("customer_account"); }} onLogin={() => setMode("customer_login")} onBack={() => setMode("public")} />;
  if (mode === "customer_account" && customer) return <CustomerAccount customer={customer} onLogout={() => { setCustomer(null); setMode("public"); }} onUpdate={(c) => setCustomer(c)} />;

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar onAdminClick={() => setMode("login")} onCustomerClick={() => { if (customer) setMode("customer_account"); else setMode("customer_login"); }} customer={customer} />
      <HeroSection />
      <MenuSection />
      <ReservationSection />
      <AvisSection />
      <AboutSection />
      <PublicFooter />
      {/* Floating WhatsApp button */}
      <a href="https://wa.me/224622345678" target="_blank" rel="noopener noreferrer" className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg shadow-green-500/30 transition-colors" title="Commander via WhatsApp">
        <MessageCircle className="w-6 h-6" />
      </a>
    </div>
  );
}
