"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarCheck, DollarSign, ShoppingBag, Star, Bike, Car,
  UtensilsCrossed, CreditCard, ArrowUpRight, Flame, TrendingUp,
  BarChart3, Clock, Wallet,
} from "lucide-react";
import type { Stats, OrderDB } from "@/lib/types";
import { formatPrice, statusColors, statusLabels, paymentLabels } from "@/lib/constants";

export interface OverviewTabProps {
  stats: Stats;
  orders: OrderDB[];
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function OverviewTab({ stats, orders, apiFetch }: OverviewTabProps) {
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await apiFetch('/api/analytics');
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        }
      } catch { /* silently fail */ }
    };
    fetchAnalytics();
  }, [apiFetch]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: CalendarCheck, label: "Réservations", value: stats.todayReservations, sub: "aujourd'hui", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
          { icon: DollarSign, label: "Revenus du jour", value: formatPrice(stats.todayRevenue), sub: "", color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
          { icon: ShoppingBag, label: "Commandes actives", value: stats.activeOrders, sub: `${stats.totalOrders} total`, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
          { icon: Star, label: "Note moyenne", value: `${stats.avgRating}/5`, sub: `${stats.totalReviews} avis`, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" },
          { icon: Bike, label: "Livraisons actives", value: stats.activeDeliveries, sub: `${stats.deliveryOrders} total`, color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
          { icon: Car, label: "Livreurs dispo", value: `${stats.availableDrivers}/${stats.totalDrivers}`, sub: "chauffeurs", color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" },
          { icon: UtensilsCrossed, label: "Sur place", value: stats.dineInOrders, sub: "commandes", color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400" },
          { icon: CreditCard, label: "Rev. livraison", value: formatPrice(stats.deliveryRevenue), sub: "frais", color: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" },
        ].map((card, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${card.color} flex items-center justify-center`}><card.icon className="w-4 h-4 sm:w-5 sm:h-5" /></div>
                <ArrowUpRight className="w-3 h-3 text-green-600" />
              </div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</p>
              {card.sub && <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">{card.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><Flame className="w-5 h-5 text-orange-500" /> Plats Populaires</h3>
            <div className="space-y-3">
              {stats.popularDishes.map((dish, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{dish.name}</p><p className="text-xs text-gray-500 dark:text-gray-400">{dish.category} - {formatPrice(dish.price)}</p></div>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{dish.count}x</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-green-500" /> Dernières Réservations</h3>
            <div className="space-y-3">
              {stats.recentReservations.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">{r.customerName.split(" ").map(n => n[0]).join("")}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.customerName}</p><p className="text-xs text-gray-500 dark:text-gray-400">{r.date} à {r.time} - {r.guests} pers.</p></div>
                  <Badge className={`${statusColors[r.status] || "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"} text-xs`}>{statusLabels[r.status] || r.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active deliveries overview */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><Bike className="w-5 h-5 text-purple-500" /> Livraisons en cours</h3>
          {orders.filter(o => o.orderType === "delivery" && ["ready", "delivering"].includes(o.status)).length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Aucune livraison en cours</p>
          ) : (
            <div className="space-y-3">
              {orders.filter(o => o.orderType === "delivery" && ["ready", "delivering"].includes(o.status)).map(o => (
                <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                  <div className={`w-10 h-10 rounded-xl ${statusColors[o.status]} flex items-center justify-center`}><Bike className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{o.customerName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{o.deliveryAddress}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={`${statusColors[o.status]} text-xs`}>{statusLabels[o.status]}</Badge>
                    {o.driver && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{o.driver.name}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Analytics Section */}
      {analytics && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Analyse avancée</h2>
          </div>

          {/* Revenue last 7 days - CSS bar chart */}
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" />
                Chiffre d&apos;affaires (7 derniers jours)
              </h3>
              <div className="flex items-end gap-2 h-40">
                {analytics?.revenueByDay?.map((day: { date: string; revenue: number; count: number }, i: number) => {
                  const maxRevenue = Math.max(...(analytics?.revenueByDay?.map((d: { revenue: number }) => d.revenue) || [1]));
                  const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">{formatPrice(day.revenue)}</span>
                      <div className="w-full bg-gradient-to-t from-orange-500 to-red-500 rounded-t-md transition-all duration-500" style={{ height: `${Math.max(height, 4)}%` }} />
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">{new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top dishes + Order types side by side */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Top selling dishes */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  Plats les plus vendus
                </h3>
                <div className="space-y-2">
                  {analytics?.topDishes?.slice(0, 5).map((dish: { name: string; qty: number; revenue: number }, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{dish.name}</p>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div className="bg-orange-500 h-2 rounded-full transition-all duration-500" style={{ width: `${(dish.qty / (analytics?.topDishes?.[0]?.qty || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{dish.qty} vendus</span>
                    </div>
                  ))}
                  {(!analytics?.topDishes || analytics.topDishes.length === 0) && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Aucune donnée disponible</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Order types + Peak hours */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-blue-500" />
                  Types de commandes
                </h3>
                <div className="space-y-2">
                  {analytics?.ordersByType && Object.entries(analytics.ordersByType).map(([type, count]: [string, unknown]) => {
                    const total = Object.values(analytics.ordersByType).reduce((s: number, c: unknown) => s + (c as number), 0);
                    const pct = total > 0 ? Math.round(((count as number) / total) * 100) : 0;
                    const labels: Record<string, string> = { dine_in: 'Sur place', takeaway: 'À emporter', delivery: 'Livraison' };
                    const colors: Record<string, string> = { dine_in: 'bg-blue-500', takeaway: 'bg-amber-500', delivery: 'bg-green-500' };
                    const bgColors: Record<string, string> = { dine_in: 'bg-blue-100 dark:bg-blue-900/30', takeaway: 'bg-amber-100 dark:bg-amber-900/30', delivery: 'bg-green-100 dark:bg-green-900/30' };
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${colors[type] || 'bg-gray-400'}`} />
                        <span className="text-sm flex-1 text-gray-900 dark:text-gray-100">{labels[type] || type}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{count as number}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">({pct}%)</span>
                      </div>
                    );
                  })}
                </div>

                {/* Visual bar for order types */}
                {analytics?.ordersByType && (() => {
                  const total = Object.values(analytics.ordersByType).reduce((s: number, c: unknown) => s + (c as number), 0);
                  if (total === 0) return null;
                  const types: { key: string; color: string }[] = [
                    { key: 'dine_in', color: 'bg-blue-500' },
                    { key: 'takeaway', color: 'bg-amber-500' },
                    { key: 'delivery', color: 'bg-green-500' },
                  ];
                  return (
                    <div className="flex h-3 rounded-full overflow-hidden mt-2">
                      {types.map(t => {
                        const val = analytics.ordersByType[t.key as keyof typeof analytics.ordersByType] as number;
                        const pct = total > 0 ? (val / total) * 100 : 0;
                        return pct > 0 ? <div key={t.key} className={`${t.color} transition-all duration-500`} style={{ width: `${pct}%` }} /> : null;
                      })}
                    </div>
                  );
                })()}

                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  Heures de pointe
                </h3>
                <div className="flex gap-1">
                  {analytics?.ordersByHour?.filter((h: { hour: number; count: number }) => h.count > 0).sort((a: { hour: number; count: number }, b: { hour: number; count: number }) => b.count - a.count).slice(0, 8).sort((a: { hour: number; count: number }, b: { hour: number; count: number }) => a.hour - b.hour).map((h: { hour: number; count: number }, i: number) => (
                    <div key={i} className="flex-1 text-center">
                      <div className="bg-orange-100 dark:bg-orange-900/30 rounded px-1 py-2">
                        <span className="text-xs font-bold text-orange-700 dark:text-orange-400">{h.count}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">{h.hour}h</span>
                    </div>
                  ))}
                  {analytics?.ordersByHour?.filter((h: { hour: number; count: number }) => h.count > 0).length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Aucune donnée</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue by payment method + Monthly comparison */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Revenue by payment method */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-green-500" />
                  Revenus par méthode de paiement
                </h3>
                <div className="space-y-3">
                  {analytics?.revenueByPayment && Object.entries(analytics.revenueByPayment).map(([method, revenue]: [string, unknown]) => {
                    const totalRevenue = Object.values(analytics.revenueByPayment).reduce((s: number, c: unknown) => s + (c as number), 0);
                    const pct = totalRevenue > 0 ? ((revenue as number) / totalRevenue) * 100 : 0;
                    const colors: Record<string, string> = { cash: 'bg-green-500', orange_money: 'bg-orange-500', mtn_money: 'bg-yellow-500', card: 'bg-blue-500' };
                    const bgColors: Record<string, string> = { cash: 'bg-green-100 dark:bg-green-900/30', orange_money: 'bg-orange-100 dark:bg-orange-900/30', mtn_money: 'bg-yellow-100 dark:bg-yellow-900/30', card: 'bg-blue-100 dark:bg-blue-900/30' };
                    return (
                      <div key={method} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-900 dark:text-gray-100">{paymentLabels[method] || method}</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatPrice(revenue as number)}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div className={`${colors[method] || 'bg-gray-400'} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {analytics?.avgDeliveryMinutes !== undefined && (
                    <div className="mt-4 pt-3 border-t dark:border-gray-700 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Temps de livraison moyen</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 ml-auto">{analytics.avgDeliveryMinutes} min</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Monthly comparison */}
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  Comparaison mensuelle
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Ce mois</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatPrice(analytics?.thisMonthRevenue || 0)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{analytics?.thisMonthOrders || 0} commandes</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Mois dernier</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatPrice(analytics?.lastMonthRevenue || 0)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{analytics?.lastMonthOrders || 0} commandes</p>
                  </div>
                </div>
                {analytics?.lastMonthRevenue > 0 && (
                  <div className="mt-3 text-center">
                    <span className={`text-sm font-bold ${(analytics?.thisMonthRevenue || 0) >= (analytics?.lastMonthRevenue || 0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {(analytics?.thisMonthRevenue || 0) >= (analytics?.lastMonthRevenue || 0) ? '↑' : '↓'} {Math.abs(Math.round(((analytics?.thisMonthRevenue || 0) - (analytics?.lastMonthRevenue || 0)) / analytics.lastMonthRevenue * 100))}% vs mois dernier
                    </span>
                  </div>
                )}
                {analytics?.avgRating !== undefined && (
                  <div className="mt-4 pt-3 border-t dark:border-gray-700 flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">Satisfaction client</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 ml-auto">{analytics.avgRating}/5</span>
                    <span className="text-xs text-gray-400">({analytics.reviewCount} avis)</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
