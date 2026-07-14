"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Clock, Utensils, DollarSign, Percent, RefreshCw, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { notify } from "@/lib/notifications";

interface AnalyticsData {
  dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
  orderTypes: { dine_in: number; takeaway: number; delivery: number };
  topItems: Array<{ name: string; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  avgMargin: number;
  monthOrders: number;
  monthRevenue: number;
  totalTips: number;
  totalCommission: number;
}

export function AnalyticsTab() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/analytics/advanced");
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch {
      notify.error("Erreur de chargement analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fmt = (n: number) => n.toLocaleString("fr-FR") + " GNF";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-gray-500">Aucune donnée disponible</div>;
  }

  const maxRevenue = Math.max(...data.dailyRevenue.map(d => d.revenue), 1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          Analytics avancés
        </h2>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" /> Rafraîchir
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ce mois-ci</p>
            <p className="text-2xl font-bold text-orange-600">{data.monthOrders}</p>
            <p className="text-xs text-gray-400">commandes</p>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Revenu du mois</p>
            <p className="text-2xl font-bold text-green-600">{fmt(data.monthRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
              <Percent className="w-3 h-3" /> Marge moyenne
            </p>
            <p className="text-2xl font-bold text-blue-600">{data.avgMargin}%</p>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Pourboires (7j)
            </p>
            <p className="text-2xl font-bold text-purple-600">{fmt(data.totalTips)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart (simple bars) */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Revenu des 7 derniers jours
          </h3>
          <div className="space-y-2">
            {data.dailyRevenue.map((d) => (
              <div key={d.date} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20">
                  {new Date(d.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}
                </span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${(d.revenue / maxRevenue) * 100}%`, minWidth: "30px" }}
                  >
                    <span className="text-[10px] text-white font-bold">{d.orders} cmd</span>
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-24 text-right">
                  {fmt(d.revenue)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two columns: Top items + Peak hours */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top items */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-orange-500" /> Plats les plus vendus (7j)
            </h3>
            <div className="space-y-2">
              {data.topItems.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item.name}</span>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    {item.count}×
                  </Badge>
                </div>
              ))}
              {data.topItems.length === 0 && (
                <p className="text-sm text-gray-400">Aucune commande sur la période</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Peak hours */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" /> Heures de pointe
            </h3>
            <div className="space-y-2">
              {data.peakHours.map((h) => (
                <div key={h.hour} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {h.hour}h - {h.hour + 1}h
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-full rounded-full"
                        style={{ width: `${(h.count / Math.max(...data.peakHours.map(p => p.count), 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8">{h.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order type breakdown */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Répartition par type de commande (7j)
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Sur place", count: data.orderTypes.dine_in, color: "bg-orange-500" },
              { label: "À emporter", count: data.orderTypes.takeaway, color: "bg-blue-500" },
              { label: "Livraison", count: data.orderTypes.delivery, color: "bg-green-500" },
            ].map(t => {
              const total = data.orderTypes.dine_in + data.orderTypes.takeaway + data.orderTypes.delivery || 1;
              return (
                <div key={t.label} className="text-center">
                  <div className={`w-16 h-16 mx-auto rounded-full ${t.color} flex items-center justify-center mb-2`}>
                    <span className="text-white font-bold text-lg">{t.count}</span>
                  </div>
                  <p className="text-xs text-gray-500">{t.label}</p>
                  <p className="text-xs text-gray-400">{Math.round((t.count / total) * 100)}%</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
