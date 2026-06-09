"use client";

import {
  ShoppingBag, CalendarCheck, Star, Clock, DollarSign,
  TrendingUp, Plus, PenSquare, ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Reservation, OrderDB, ReviewDB, CustomerUser } from "@/lib/types";
import { statusColors, statusLabels, zoneLabels, formatPrice } from "@/lib/constants";
import { getTier } from "@/lib/hooks/use-loyalty";
import type { LucideIcon } from "lucide-react";

interface CustomerDashboardProps {
  customer: CustomerUser;
  orders: OrderDB[];
  reservations: Reservation[];
  reviews: ReviewDB[];
  onTabChange: (tab: string) => void;
  onShowQuickReserve: () => void;
}

export function CustomerDashboard({
  customer,
  orders,
  reservations,
  reviews,
  onTabChange,
  onShowQuickReserve,
}: CustomerDashboardProps) {
  const tier = getTier(customer.loyaltyPoints);
  const TierIcon: LucideIcon = tier.icon;

  // Recent activity for dashboard
  const recentActivity = [
    ...orders.slice(0, 3).map(o => ({ type: "order" as const, date: o.createdAt, label: `Commande ${statusLabels[o.status] || o.status}`, detail: `${formatPrice(o.total)}` })),
    ...reservations.slice(0, 3).map(r => ({ type: "reservation" as const, date: r.createdAt, label: `Réservation ${statusLabels[r.status] || r.status}`, detail: `${r.date} à ${r.time}` })),
    ...reviews.slice(0, 2).map(rv => ({ type: "review" as const, date: rv.createdAt, label: "Avis publié", detail: `${"⭐".repeat(rv.rating)}` })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  // Upcoming reservations
  const upcomingReservations = reservations.filter(r => r.status === "confirmed" || r.status === "pending").slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 border-0 overflow-hidden">
        <CardContent className="p-6 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 right-20 w-20 h-20 bg-white/5 rounded-full translate-y-6" />
          <h2 className="text-2xl font-bold text-white">Bonjour, {customer.name} 👋</h2>
          <p className="text-emerald-100 mt-1">Bienvenue dans votre espace KFM Delice</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Button size="sm" variant="secondary" onClick={() => onTabChange("commander")} className="rounded-lg"><ShoppingCart className="w-4 h-4 mr-1" /> Commander</Button>
            <Button size="sm" variant="secondary" onClick={() => { onTabChange("reservations"); onShowQuickReserve(); }} className="rounded-lg"><CalendarCheck className="w-4 h-4 mr-1" /> Réserver</Button>
            <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/20 rounded-lg" onClick={() => onTabChange("avis")}><PenSquare className="w-4 h-4 mr-1" /> Laisser un avis</Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0"><TierIcon className="w-5 h-5 text-white" /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{customer.loyaltyPoints}</p><p className="text-xs text-gray-500 dark:text-gray-400">Points de fidélité</p></div>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0"><ShoppingBag className="w-5 h-5 text-white" /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length}</p><p className="text-xs text-gray-500 dark:text-gray-400">Commandes en cours</p></div>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center shrink-0"><Clock className="w-5 h-5 text-white" /></div>
            <div><p className="text-sm font-bold text-gray-900 dark:text-gray-100">{orders.length > 0 ? new Date(orders[0].createdAt).toLocaleDateString("fr-FR") : "—"}</p><p className="text-xs text-gray-500 dark:text-gray-400">Dernière commande</p></div>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shrink-0"><DollarSign className="w-5 h-5 text-white" /></div>
            <div><p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatPrice(customer.totalSpent)}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total dépensé</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent activity */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-500" /> Activité récente</h3>
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">Aucune activité récente</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((act, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${act.type === "order" ? "bg-orange-100 dark:bg-orange-900/30" : act.type === "reservation" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}>
                      {act.type === "order" ? <ShoppingBag className="w-4 h-4 text-orange-600 dark:text-orange-400" /> : act.type === "reservation" ? <CalendarCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <Star className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{act.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{act.detail}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">{new Date(act.date).toLocaleDateString("fr-FR")}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming reservations */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-emerald-500" /> Prochaines réservations</h3>
              <Button size="sm" variant="outline" onClick={() => { onTabChange("reservations"); onShowQuickReserve(); }} className="text-xs rounded-lg dark:border-gray-600"><Plus className="w-3 h-3 mr-1" /> Réserver</Button>
            </div>
            {upcomingReservations.length === 0 ? (
              <div className="text-center py-4">
                <CalendarCheck className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucune réservation à venir</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingReservations.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0 text-white text-xs font-bold">{r.date.slice(0, 2)}<br />{r.date.slice(3, 5)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.time} — {r.guests} pers.</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{zoneLabels[r.zone] || r.zone}</p>
                    </div>
                    <Badge className={`${statusColors[r.status]} text-[10px]`}>{statusLabels[r.status]}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
