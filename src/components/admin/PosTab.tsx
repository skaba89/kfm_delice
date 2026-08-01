"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  UtensilsCrossed, ShoppingBag, Search, Leaf, Flame, Fish, CakeSlice,
  Clock, User, CircleDot, Minus, Plus, X, DollarSign, Smartphone,
  CreditCard, RefreshCw, CheckCircle2, Trash2, Percent, StickyNote, Printer, Receipt, FileDown,
  CupSoda, Bike,
} from "lucide-react";
import type { MenuItemDB, OrderDB } from "@/lib/types";
import { RESTO, MENU_CATS, formatPrice, statusColors, statusLabels, orderTypeLabels, paymentLabels } from "@/lib/constants";
import { notify } from "@/lib/notifications";

export interface PosTabProps {
  menuItems: MenuItemDB[];
  posCart: { menuItem: MenuItemDB; qty: number; note: string }[];
  setPosCart: (v: { menuItem: MenuItemDB; qty: number; note: string }[] | ((prev: { menuItem: MenuItemDB; qty: number; note: string }[]) => { menuItem: MenuItemDB; qty: number; note: string }[])) => void;
  posTable: number;
  setPosTable: (v: number) => void;
  posOrderType: "dine_in" | "takeaway" | "delivery";
  setPosOrderType: (v: "dine_in" | "takeaway" | "delivery") => void;
  posDeliveryAddress: string;
  setPosDeliveryAddress: (v: string) => void;
  posDeliveryFee: number;
  setPosDeliveryFee: (v: number) => void;
  posPayment: string;
  setPosPayment: (v: string) => void;
  posDiscount: number;
  setPosDiscount: (v: number) => void;
  posCustomerName: string;
  setPosCustomerName: (v: string) => void;
  posCustomerPhone: string;
  setPosCustomerPhone: (v: string) => void;
  posNote: string;
  setPosNote: (v: string) => void;
  posCategoryFilter: string;
  setPosCategoryFilter: (v: string) => void;
  posSearch: string;
  setPosSearch: (v: string) => void;
  posReceipt: OrderDB | null;
  setPosReceipt: (v: OrderDB | null) => void;
  posSubmitting: boolean;
  setPosSubmitting: (v: boolean) => void;
  loadData: () => Promise<void>;
  orders: OrderDB[];
  apiFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export function PosTab({
  menuItems, posCart, setPosCart, posTable, setPosTable,
  posOrderType, setPosOrderType, posDeliveryAddress, setPosDeliveryAddress, posDeliveryFee, setPosDeliveryFee,
  posPayment, setPosPayment, posDiscount, setPosDiscount, posCustomerName, setPosCustomerName,
  posCustomerPhone, setPosCustomerPhone, posNote, setPosNote,
  posCategoryFilter, setPosCategoryFilter, posSearch, setPosSearch,
  posReceipt, setPosReceipt, posSubmitting, setPosSubmitting,
  orders, loadData, apiFetch,
}: PosTabProps) {
  return (
    <div className="space-y-4">
      {/* POS Receipt Modal */}
      <AnimatePresence>
        {posReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPosReceipt(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 text-center">
                <Receipt className="w-8 h-8 mx-auto mb-2" />
                <h3 className="text-lg font-bold">{RESTO.name}</h3>
                <p className="text-xs opacity-80">{RESTO.address}</p>
                <p className="text-xs opacity-80">{RESTO.phone}</p>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>N° Commande</span>
                  <span className="font-mono font-bold">{posReceipt.id.slice(-6).toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Date</span>
                  <span>{new Date(posReceipt.createdAt).toLocaleString("fr-FR")}</span>
                </div>
                {posReceipt.tableNumber > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Table</span>
                    <span className="font-bold">N° {posReceipt.tableNumber}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Type</span>
                  <span>{orderTypeLabels[posReceipt.orderType]}</span>
                </div>
                {posReceipt.customerName && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Client</span>
                    <span>{posReceipt.customerName}</span>
                  </div>
                )}
                <Separator />
                <div className="space-y-1.5">
                  {(JSON.parse(posReceipt.items || "[]") as { name: string; price: number; qty: number; note?: string }[]).map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <div className="flex-1">
                        <span className="font-medium dark:text-gray-200">{item.name}</span>
                        <span className="text-gray-400 ml-1">x{item.qty}</span>
                        {item.note && <p className="text-xs text-gray-400 italic">→ {item.note}</p>}
                      </div>
                      <span className="font-mono dark:text-gray-300">{formatPrice(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>
                <Separator />
                {(JSON.parse(posReceipt.items || "[]") as { price: number; qty: number }[]).reduce((s: number, i: { price: number; qty: number }) => s + i.price * i.qty, 0) !== posReceipt.total && (
                  <>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400">
                      <span>Sous-total</span>
                      <span>{formatPrice((JSON.parse(posReceipt.items || "[]") as { price: number; qty: number }[]).reduce((s: number, i: { price: number; qty: number }) => s + i.price * i.qty, 0))}</span>
                    </div>
                    {posReceipt.discount > 0 && (
                      <div className="flex justify-between text-green-600 dark:text-green-400">
                        <span>Remise</span>
                        <span>-{formatPrice(posReceipt.discount)}</span>
                      </div>
                    )}
                    {posReceipt.tax > 0 && (
                      <div className="flex justify-between text-gray-500 dark:text-gray-400">
                        <span>Taxe</span>
                        <span>{formatPrice(posReceipt.tax)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-gray-100 pt-1">
                  <span>TOTAL</span>
                  <span>{formatPrice(posReceipt.total)}</span>
                </div>
                <div className="flex justify-between text-gray-500 dark:text-gray-400">
                  <span>Paiement</span>
                  <span className="font-medium">{paymentLabels[posReceipt.paymentMethod] || posReceipt.paymentMethod}</span>
                </div>
                {posReceipt.note && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Note : </span>{posReceipt.note}
                  </div>
                )}
                <Separator />
                <div className="text-center text-xs text-gray-400 dark:text-gray-500 pt-1">
                  <p>Merci de votre visite !</p>
                  <p>{RESTO.name} — {RESTO.tagline}</p>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 flex gap-2">
                <Button onClick={() => window.print()} className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl">
                  <Printer className="w-4 h-4 mr-2" /> Imprimer
                </Button>
                <a href={`/api/orders/${posReceipt.id}?format=pdf`} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full rounded-xl dark:border-gray-600">
                    <FileDown className="w-4 h-4 mr-2" /> PDF
                  </Button>
                </a>
                <Button variant="outline" onClick={() => { setPosReceipt(null); setPosCart([]); setPosDiscount(0); setPosCustomerName(""); setPosCustomerPhone(""); setPosNote(""); }} className="flex-1 rounded-xl dark:border-gray-600">
                  Nouvelle commande
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POS Main Layout */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* LEFT: Menu items grid */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={posSearch} onChange={e => setPosSearch(e.target.value)} placeholder="Rechercher un plat..." className="pl-9 rounded-xl dark:bg-gray-800 dark:border-gray-600" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setPosCategoryFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${posCategoryFilter === "all" ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"}`}>Tous</button>
              {MENU_CATS.map(cat => (
                <button key={cat.id} onClick={() => setPosCategoryFilter(cat.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${posCategoryFilter === cat.id ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"}`}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {menuItems
              .filter(m => m.available)
              .filter(m => posCategoryFilter === "all" || m.category === posCategoryFilter)
              .filter(m => !posSearch || m.name.toLowerCase().includes(posSearch.toLowerCase()))
              .length === 0 && (
                <div className="col-span-full text-center py-12">
                  <UtensilsCrossed className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">Aucun plat disponible</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Ajoutez des plats depuis l&apos;onglet Menu pour utiliser le POS</p>
                </div>
              )}
            {menuItems
              .filter(m => m.available)
              .filter(m => posCategoryFilter === "all" || m.category === posCategoryFilter)
              .filter(m => !posSearch || m.name.toLowerCase().includes(posSearch.toLowerCase()))
              .map(item => {
                const inCart = posCart.find(c => c.menuItem.id === item.id);
                return (
                  <button key={item.id} onClick={() => {
                    setPosCart(prev => {
                      const existing = prev.find(c => c.menuItem.id === item.id);
                      if (existing) return prev.map(c => c.menuItem.id === item.id ? { ...c, qty: c.qty + 1 } : c);
                      return [...prev, { menuItem: item, qty: 1, note: "" }];
                    });
                  }} className={`relative text-left p-2 rounded-xl border-2 transition-all hover:shadow-md ${inCart ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-600" : "border-gray-100 bg-white hover:border-orange-200 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-700"}`}>
                    {inCart && (
                      <span className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 text-white rounded-full text-xs font-bold flex items-center justify-center shadow-lg z-10">{inCart.qty}</span>
                    )}
                    {item.popular && <span className="absolute top-1 left-1 z-10"><Flame className="w-3.5 h-3.5 text-orange-500" /></span>}
                    {/* Afficher l'image du plat (même image que dans le menu public) */}
                    <div className="w-full h-20 rounded-lg overflow-hidden mb-2 bg-gray-100 dark:bg-gray-700">
                      {item.image ? (
                        <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {item.category === "entrees" ? <Leaf className="w-6 h-6 text-green-500" /> : item.category === "plats" ? <Flame className="w-6 h-6 text-orange-500" /> : item.category === "mer" ? <Fish className="w-6 h-6 text-blue-500" /> : item.category === "boissons" ? <CupSoda className="w-6 h-6 text-cyan-500" /> : <CakeSlice className="w-6 h-6 text-pink-500" />}
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight line-clamp-2">{item.name}</p>
                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400 mt-1">{formatPrice(item.price)}</p>
                    {item.badge && <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">{item.badge}</span>}
                  </button>
                );
              })}
          </div>

          {/* Today's POS orders summary */}
          <Card className="mt-4 dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" /> Commandes POS du jour
                <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs">{orders.filter(o => { const d = new Date(o.createdAt); const t = new Date(); return d.toDateString() === t.toDateString() && (o.orderType === "dine_in" || o.orderType === "takeaway"); }).length}</Badge>
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {orders.filter(o => { const d = new Date(o.createdAt); const t = new Date(); return d.toDateString() === t.toDateString() && (o.orderType === "dine_in" || o.orderType === "takeaway"); }).slice(0, 15).map(o => (
                  <div key={o.id} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <Badge className={`${statusColors[o.status]} text-[10px]`}>{statusLabels[o.status]}</Badge>
                      {o.tableNumber > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">T{o.tableNumber}</span>}
                      <span className="text-gray-700 dark:text-gray-300">{o.customerName || "Client"}</span>
                    </div>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{formatPrice(o.total)}</span>
                  </div>
                ))}
                {orders.filter(o => { const d = new Date(o.createdAt); const t = new Date(); return d.toDateString() === t.toDateString() && (o.orderType === "dine_in" || o.orderType === "takeaway"); }).length === 0 && (
                  <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-2">Aucune commande POS aujourd&apos;hui</p>
                )}
              </div>
              <div className="mt-3 pt-2 border-t dark:border-gray-700 flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Total du jour</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{formatPrice(orders.filter(o => { const d = new Date(o.createdAt); const t = new Date(); return d.toDateString() === t.toDateString() && (o.orderType === "dine_in" || o.orderType === "takeaway") && o.status !== "cancelled"; }).reduce((s, o) => s + o.total, 0))}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Cart & Payment */}
        <div className="space-y-3">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><CircleDot className="w-4 h-4 text-orange-500" /> Type de commande</h4>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button onClick={() => setPosOrderType("dine_in")} className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all ${posOrderType === "dine_in" ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"}`}>
                  <UtensilsCrossed className="w-4 h-4" /> Sur place
                </button>
                <button onClick={() => setPosOrderType("takeaway")} className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all ${posOrderType === "takeaway" ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"}`}>
                  <ShoppingBag className="w-4 h-4" /> À emporter
                </button>
                <button onClick={() => setPosOrderType("delivery")} className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all ${posOrderType === "delivery" ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"}`}>
                  <Bike className="w-4 h-4" /> Moto-taxi
                </button>
              </div>
              {posOrderType === "dine_in" && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Numéro de table</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPosTable(Math.max(1, posTable - 1))} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-400 transition-colors"><Minus className="w-4 h-4" /></button>
                    <div className="flex-1 text-center">
                      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{posTable}</span>
                    </div>
                    <button onClick={() => setPosTable(Math.min(50, posTable + 1))} className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-400 transition-colors"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(t => (
                      <button key={t} onClick={() => setPosTable(t)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${posTable === t ? "bg-orange-500 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"}`}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
              {posOrderType === "delivery" && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Adresse de livraison *</label>
                    <Input value={posDeliveryAddress} onChange={e => setPosDeliveryAddress(e.target.value)} placeholder="Adresse du client à Conakry..." className="rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                  <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                    <label className="text-xs font-medium text-orange-700 dark:text-orange-400">Frais moto-taxi (GNF)</label>
                    <Input type="number" value={posDeliveryFee} onChange={e => setPosDeliveryFee(Math.max(0, parseInt(e.target.value) || 0))} className="w-24 h-7 text-xs rounded-md dark:bg-gray-800 dark:border-gray-600" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><User className="w-4 h-4 text-orange-500" /> Client</h4>
              <div className="space-y-2">
                <Input value={posCustomerName} onChange={e => setPosCustomerName(e.target.value)} placeholder="Nom du client (optionnel)" className="rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600" />
                <Input value={posCustomerPhone} onChange={e => setPosCustomerPhone(e.target.value)} placeholder="Téléphone (optionnel)" className="rounded-xl text-sm dark:bg-gray-800 dark:border-gray-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-800 dark:bg-gray-800">
            <CardContent className="p-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-orange-500" /> Panier
                {posCart.length > 0 && <Badge className="bg-orange-500 text-white text-xs">{posCart.reduce((s, c) => s + c.qty, 0)}</Badge>}
              </h4>
              {posCart.length === 0 ? (
                <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Panier vide</p>
                  <p className="text-xs">Cliquez sur un plat pour l&apos;ajouter</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {posCart.map((cartItem, idx) => (
                    <div key={cartItem.menuItem.id} className="flex items-start gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{cartItem.menuItem.name}</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400 font-bold">{formatPrice(cartItem.menuItem.price)}</p>
                        <input value={cartItem.note} onChange={e => setPosCart(posCart.map((c, i) => i === idx ? { ...c, note: e.target.value } : c))} placeholder="Note..." className="mt-1 w-full h-6 text-xs border border-gray-200 dark:border-gray-600 rounded px-1.5 bg-white dark:bg-gray-800 dark:text-gray-200" />
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPosCart(posCart.map((c, i) => i === idx ? { ...c, qty: Math.max(0, c.qty - 1) } : c).filter(c => c.qty > 0))} className="w-7 h-7 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 flex items-center justify-center text-gray-600 dark:text-gray-300 transition-colors"><Minus className="w-3 h-3" /></button>
                        <span className="w-7 text-center text-sm font-bold dark:text-gray-200">{cartItem.qty}</span>
                        <button onClick={() => setPosCart(posCart.map((c, i) => i === idx ? { ...c, qty: c.qty + 1 } : c))} className="w-7 h-7 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 flex items-center justify-center text-gray-600 dark:text-gray-300 transition-colors"><Plus className="w-3 h-3" /></button>
                        <button onClick={() => setPosCart(posCart.filter((_, i) => i !== idx))} className="w-7 h-7 rounded-md bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/30 flex items-center justify-center text-red-500 transition-colors ml-0.5"><X className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {posCart.length > 0 && (
            <Card className="border-2 border-orange-300 bg-gradient-to-b from-orange-50/50 to-white dark:border-orange-700 dark:from-orange-900/10 dark:to-gray-800">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Sous-total ({posCart.reduce((s, c) => s + c.qty, 0)} articles)</span>
                  <span className="font-medium">{formatPrice(posCart.reduce((s, c) => s + c.menuItem.price * c.qty, 0))}</span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Percent className="w-3.5 h-3.5 text-green-500" />
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Remise (GNF)</label>
                  </div>
                  <Input type="number" value={posDiscount || ""} onChange={e => setPosDiscount(Math.max(0, parseInt(e.target.value) || 0))} placeholder="0" className="rounded-xl text-sm h-8 dark:bg-gray-800 dark:border-gray-600" />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StickyNote className="w-3.5 h-3.5 text-gray-400" />
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Note de commande</label>
                  </div>
                  <Input value={posNote} onChange={e => setPosNote(e.target.value)} placeholder="Instructions spéciales..." className="rounded-xl text-sm h-8 dark:bg-gray-800 dark:border-gray-600" />
                </div>

                <Separator />

                <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-gray-100">
                  <span>TOTAL</span>
                  <span>{formatPrice(Math.max(0, posCart.reduce((s, c) => s + c.menuItem.price * c.qty, 0) - posDiscount))}</span>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Mode de paiement</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "cash", label: "Espèces", icon: DollarSign },
                      { id: "orange_money", label: "Orange Money", icon: Smartphone },
                      { id: "mtn_money", label: "MTN Money", icon: Smartphone },
                      { id: "wave", label: "Wave", icon: Smartphone },
                      { id: "card", label: "Carte", icon: CreditCard },
                    ].map(pm => (
                      <button key={pm.id} onClick={() => setPosPayment(pm.id)} className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${posPayment === pm.id ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"}`}>
                        <pm.icon className="w-3.5 h-3.5" /> {pm.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Button disabled={posSubmitting || posCart.length === 0 || (posOrderType === "delivery" && !posDeliveryAddress)} onClick={async () => {
                    setPosSubmitting(true);
                    try {
                      const subtotal = posCart.reduce((s, c) => s + c.menuItem.price * c.qty, 0);
                      const deliveryFee = posOrderType === "delivery" ? posDeliveryFee : 0;
                      const total = Math.max(0, subtotal - posDiscount) + deliveryFee;
                      const items = posCart.map(c => ({ name: c.menuItem.name, price: c.menuItem.price, qty: c.qty, note: c.note }));
                      const res = await apiFetch("/api/orders", {
                        method: "POST",
                        body: JSON.stringify({
                          customerName: posCustomerName || (posOrderType === "delivery" ? "Client livraison" : "Client sur place"),
                          phone: posCustomerPhone,
                          items: JSON.stringify(items),
                          total,
                          status: "preparing",
                          orderType: posOrderType,
                          paymentMethod: posPayment,
                          tableNumber: posOrderType === "dine_in" ? posTable : 0,
                          discount: posDiscount,
                          deliveryAddress: posOrderType === "delivery" ? posDeliveryAddress : "",
                          deliveryFee,
                          tax: 0,
                          note: posNote,
                        }),
                      });
                      if (res.ok) {
                        const order = await res.json();
                        // Create a Payment record for non-cash methods
                        if (posPayment !== "cash" && order.id) {
                          try {
                            await apiFetch("/api/payment", {
                              method: "POST",
                              body: JSON.stringify({
                                orderId: order.id,
                                method: posPayment,
                                amount: total,
                                customerName: posCustomerName || "Client POS",
                                phone: posCustomerPhone || "",
                              }),
                            });
                          } catch { /* non-blocking — order is created */ }
                        }
                        // For cash, mark order as paid directly
                        if (posPayment === "cash" && order.id) {
                          try {
                            await apiFetch("/api/orders", {
                              method: "PATCH",
                              body: JSON.stringify({ id: order.id, paymentStatus: "paid" }),
                            });
                          } catch { /* non-blocking */ }
                        }
                        setPosReceipt(order);
                        loadData();
                        notify.posOrderSubmitted();
                        notify.posOrderReceipt();
                      }
                    } catch (e) { console.error(e); }
                    finally { setPosSubmitting(false); }
                  }} className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl py-6 text-base font-bold shadow-lg shadow-orange-500/30">
                    {posSubmitting ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : <><CheckCircle2 className="w-5 h-5 mr-2" /> Encaisser — {formatPrice(Math.max(0, posCart.reduce((s, c) => s + c.menuItem.price * c.qty, 0) - posDiscount) + (posOrderType === "delivery" ? posDeliveryFee : 0))}</>}
                  </Button>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={async () => {
                      setPosSubmitting(true);
                      try {
                        const subtotal = posCart.reduce((s, c) => s + c.menuItem.price * c.qty, 0);
                        const deliveryFee = posOrderType === "delivery" ? posDeliveryFee : 0;
                        const total = Math.max(0, subtotal - posDiscount) + deliveryFee;
                        const items = posCart.map(c => ({ name: c.menuItem.name, price: c.menuItem.price, qty: c.qty, note: c.note }));
                        await apiFetch("/api/orders", {
                          method: "POST",
                          body: JSON.stringify({
                            customerName: posCustomerName || (posOrderType === "delivery" ? "Client livraison" : "Client sur place"),
                            phone: posCustomerPhone,
                            items: JSON.stringify(items),
                            total,
                            status: "pending",
                            orderType: posOrderType,
                            paymentMethod: posPayment,
                            tableNumber: posOrderType === "dine_in" ? posTable : 0,
                            discount: posDiscount,
                            deliveryAddress: posOrderType === "delivery" ? posDeliveryAddress : "",
                            deliveryFee,
                            tax: 0,
                            note: posNote,
                          }),
                        });
                        setPosCart([]); setPosDiscount(0); setPosCustomerName(""); setPosCustomerPhone(""); setPosNote(""); setPosDeliveryAddress("");
                        loadData();
                        notify.posOrderSubmitted();
                      } catch (e) { console.error(e); }
                      finally { setPosSubmitting(false); }
                    }} className="flex-1 rounded-xl text-sm dark:border-gray-600" disabled={posSubmitting || (posOrderType === "delivery" && !posDeliveryAddress)}>
                      <Clock className="w-4 h-4 mr-1" /> Mettre en attente
                    </Button>
                    <Button variant="outline" onClick={() => { setPosCart([]); setPosDiscount(0); setPosNote(""); }} className="rounded-xl text-sm text-red-600 hover:bg-red-50 border-red-200 dark:text-red-400 dark:hover:bg-red-900/30 dark:border-red-800" disabled={posSubmitting}>
                      <Trash2 className="w-4 h-4 mr-1" /> Vider
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
