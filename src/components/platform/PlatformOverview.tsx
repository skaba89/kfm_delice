"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, UtensilsCrossed, TrendingUp, Users, AlertTriangle, Activity } from "lucide-react";
import { formatPrice } from "@/lib/constants";
import { getPlanMonthlyPriceGnf, normalizeCommercialPlanValue } from "@/lib/commercial-plan-catalog";

interface OverviewData {
  stats: {
    totalRestaurants: number;
    activeRestaurants: number;
    trialRestaurants: number;
    totalRevenue: number;
    estimatedMonthlyCatalogValue?: number;
    unpricedCustomSubscriptions?: number;
  };
  accounts: Array<{
    id: string;
    name: string;
    plan: string;
    status: string;
    ownerEmail: string;
    _count: { restaurants: number; admins: number };
  }>;
}

const EMPTY_STATS: OverviewData["stats"] = {
  totalRestaurants: 0,
  activeRestaurants: 0,
  trialRestaurants: 0,
  totalRevenue: 0,
  estimatedMonthlyCatalogValue: 0,
  unpricedCustomSubscriptions: 0,
};

export function PlatformOverview({ token }: { token: string }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [restRes, accRes] = await Promise.all([
          fetch("/api/platform/restaurants", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/platform/accounts", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const restData = await restRes.json();
        const accData = await accRes.json();
        setData({
          stats: restData.stats || EMPTY_STATS,
          accounts: accData.data || [],
        });
      } catch (err) {
        console.error("Overview fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-gray-900 border-white/10 animate-pulse">
            <CardContent className="p-6 h-32" />
          </Card>
        ))}
      </div>
    );
  }

  const stats = data?.stats ?? EMPTY_STATS;
  const accounts = data?.accounts || [];
  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((a) => a.status === "active").length;
  const suspendedAccounts = accounts.filter((a) => a.status === "suspended" || a.status === "over_quota").length;

  const planDistribution = accounts.reduce((acc, a) => {
    acc[a.plan] = (acc[a.plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const estimatedMonthlyCatalogValue = stats.estimatedMonthlyCatalogValue ?? stats.totalRevenue ?? 0;
  const unpricedCustomSubscriptions = stats.unpricedCustomSubscriptions ?? 0;

  const statCards = [
    {
      title: "Comptes SaaS",
      value: totalAccounts,
      subtitle: `${activeAccounts} actifs · ${suspendedAccounts} suspendus`,
      icon: Building2,
      gradient: "from-blue-500 to-cyan-600",
    },
    {
      title: "Restaurants",
      value: stats.totalRestaurants || 0,
      subtitle: `${stats.activeRestaurants || 0} actifs · ${stats.trialRestaurants || 0} en essai`,
      icon: UtensilsCrossed,
      gradient: "from-orange-500 to-red-600",
    },
    {
      title: "Valeur catalogue active",
      value: formatPrice(estimatedMonthlyCatalogValue),
      subtitle: unpricedCustomSubscriptions > 0
        ? `Par mois · ${unpricedCustomSubscriptions} contrat(s) custom non chiffré(s)`
        : "Par mois · hors essais et comptes suspendus",
      icon: TrendingUp,
      gradient: "from-green-500 to-emerald-600",
    },
    {
      title: "Utilisateurs totaux",
      value: accounts.reduce((sum, a) => sum + (a._count?.admins || 0), 0),
      subtitle: "Admins restaurant",
      icon: Users,
      gradient: "from-purple-500 to-violet-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Card key={i} className="bg-gray-900 border-white/10 hover:border-white/20 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{card.value}</p>
              <p className="text-sm text-gray-400 mt-1">{card.subtitle}</p>
              <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider">{card.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" />
              Répartition des plans
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["free", "starter", "pro", "enterprise", "custom"].map((plan) => {
              const count = planDistribution[plan] || 0;
              const percentage = totalAccounts > 0 ? (count / totalAccounts) * 100 : 0;
              const planColors: Record<string, string> = {
                free: "bg-gray-600",
                starter: "bg-blue-600",
                pro: "bg-orange-600",
                enterprise: "bg-purple-600",
                custom: "bg-green-600",
              };
              const normalizedPlan = normalizeCommercialPlanValue(plan) ?? "free";
              const catalogPrice = getPlanMonthlyPriceGnf(normalizedPlan);
              const priceLabel = catalogPrice === null ? "Sur mesure" : formatPrice(catalogPrice);
              return (
                <div key={plan}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-300 capitalize">{plan}</span>
                    <span className="text-xs text-gray-500">{priceLabel} · {count} compte(s)</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${planColors[plan]} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {totalAccounts === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Aucun compte pour le moment</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-500" />
              Comptes récents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {accounts.slice(0, 8).map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{account.name}</p>
                  <p className="text-xs text-gray-500 truncate">{account.ownerEmail || "Pas d'email"}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant="outline"
                    className={
                      account.status === "active"
                        ? "border-green-500/30 text-green-400 bg-green-500/10"
                        : account.status === "over_quota"
                          ? "border-orange-500/30 text-orange-400 bg-orange-500/10"
                          : "border-red-500/30 text-red-400 bg-red-500/10"
                    }
                  >
                    {account.status}
                  </Badge>
                  <Badge variant="outline" className="border-white/10 text-gray-400 capitalize">
                    {account.plan}
                  </Badge>
                </div>
              </div>
            ))}
            {accounts.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Aucun compte pour le moment</p>
            )}
          </CardContent>
        </Card>
      </div>

      {suspendedAccounts > 0 && (
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-400">
                {suspendedAccounts} compte(s) nécessitent votre attention
              </p>
              <p className="text-xs text-gray-400">
                Des comptes sont suspendus ou en dépassement de quota. Vérifiez l'onglet Comptes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
