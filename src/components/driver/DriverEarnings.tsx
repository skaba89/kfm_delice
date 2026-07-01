"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, Calendar, Wallet, Award, Bike,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/constants";

interface DriverEarningsData {
  profile: {
    id: string;
    name: string;
    commissionRate: number;
    totalEarnings: number;
    totalDeliveries: number;
    rating: number;
  };
  summary: {
    total: number;
    today: number;
    week: number;
    month: number;
    todayCount: number;
    weekCount: number;
    monthCount: number;
  };
  dailyEarnings: { date: string; earnings: number; count: number }[];
  recentOrders: {
    id: string;
    total: number;
    deliveryFee: number;
    driverEarning: number;
    orderType: string;
    customerName: string;
    updatedAt: string;
  }[];
}

export function DriverEarnings() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<DriverEarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/driver-earnings");
        if (res.ok) {
          setData(await res.json());
        }
      } catch (e) {
        console.error("[driver-earnings]", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [apiFetch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-gray-500 py-8">Impossible de charger les gains.</p>;
  }

  const maxEarning = Math.max(...data.dailyEarnings.map(d => d.earnings), 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-emerald-100 text-sm">Gains totaux</p>
            <p className="text-3xl font-bold">{formatPrice(data.summary.total)}</p>
            <p className="text-emerald-100 text-xs mt-1">
              {data.profile.totalDeliveries} livraison(s) • Commission {data.profile.commissionRate}%
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Period summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="w-4 h-4 text-blue-500 mx-auto mb-1" />
            <p className="text-[10px] text-gray-500 uppercase">Aujourd'hui</p>
            <p className="font-bold text-gray-900 dark:text-gray-100">{formatPrice(data.summary.today)}</p>
            <p className="text-[10px] text-gray-400">{data.summary.todayCount} livr.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-[10px] text-gray-500 uppercase">7 jours</p>
            <p className="font-bold text-gray-900 dark:text-gray-100">{formatPrice(data.summary.week)}</p>
            <p className="text-[10px] text-gray-400">{data.summary.weekCount} livr.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <p className="text-[10px] text-gray-500 uppercase">30 jours</p>
            <p className="font-bold text-gray-900 dark:text-gray-100">{formatPrice(data.summary.month)}</p>
            <p className="text-[10px] text-gray-400">{data.summary.monthCount} livr.</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily earnings chart (14 days) */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Gains — 14 derniers jours
          </h3>
          <div className="flex items-end justify-between gap-1 h-32">
            {data.dailyEarnings.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[9px] font-medium text-gray-500">
                  {d.earnings > 0 ? `${Math.round(d.earnings / 1000)}k` : ""}
                </div>
                <div
                  className="w-full bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t"
                  style={{
                    height: `${(d.earnings / maxEarning) * 100}%`,
                    minHeight: d.earnings > 0 ? "4px" : "1px",
                  }}
                  title={`${d.earnings > 0 ? formatPrice(d.earnings) : "Aucune livraison"} — ${d.count} livraison(s)`}
                />
                <div className="text-[8px] text-gray-400">
                  {new Date(d.date).toLocaleDateString("fr-FR", { day: "numeric" })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent paid orders */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Livraisons récentes rémunérées</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Commission = max({data.profile.commissionRate}% du total, frais de livraison)
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.recentOrders.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-500">
                Aucune livraison rémunérée pour le moment.
                <br />
                Acceptez des commandes pour commencer à gagner !
              </p>
            ) : data.recentOrders.slice(0, 20).map((o) => (
              <div key={o.id} className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Bike className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {o.customerName || "Client"} • #{o.id.slice(-6).toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(o.updatedAt).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                    {" • "}
                    <Badge variant="outline" className="text-[10px]">
                      {o.orderType === "delivery" ? "Livraison" : o.orderType === "takeaway" ? "Emporter" : "Sur place"}
                    </Badge>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatPrice(o.driverEarning || 0)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    sur {formatPrice(o.total)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
