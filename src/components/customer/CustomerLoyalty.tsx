"use client";

import { Award, ShoppingBag, DollarSign, Crown, CalendarCheck, MessageSquare, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { CustomerUser } from "@/lib/types";
import { formatPrice } from "@/lib/constants";
import { getTier, getTierProgress, TIER_THRESHOLDS } from "@/lib/hooks/use-loyalty";
import type { LucideIcon } from "lucide-react";

interface CustomerLoyaltyProps {
  customer: CustomerUser;
}

export function CustomerLoyalty({ customer }: CustomerLoyaltyProps) {
  const tier = getTier(customer.loyaltyPoints);
  const TierIcon: LucideIcon = tier.icon;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Tier card */}
      <Card className="dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
        <div className={`bg-gradient-to-r ${tier.color} p-6 text-white`}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <TierIcon className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium opacity-80">Votre niveau</p>
              <p className="text-2xl font-bold">{tier.name}</p>
              <p className="text-sm opacity-80">Remise de {tier.discount} sur vos commandes</p>
            </div>
          </div>
        </div>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{customer.loyaltyPoints} points</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{tier.next === Infinity ? "Niveau maximum !" : `${tier.next} points pour le prochain niveau`}</span>
          </div>
          <Progress value={getTierProgress(customer.loyaltyPoints)} className="h-3" />
          {tier.next !== Infinity && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Plus que <span className="font-semibold text-emerald-600 dark:text-emerald-400">{tier.next - customer.loyaltyPoints} points</span> avant le niveau suivant</p>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6 text-center">
            <Award className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{customer.loyaltyPoints}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Points de fidélité</p>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6 text-center">
            <ShoppingBag className="w-10 h-10 text-teal-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{customer.totalOrders}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Commandes totales</p>
          </CardContent>
        </Card>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardContent className="p-6 text-center">
            <DollarSign className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatPrice(customer.totalSpent)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total dépensé</p>
          </CardContent>
        </Card>
      </div>

      {/* Tier list */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><Crown className="w-5 h-5 text-emerald-500" /> Paliers de fidélité</h3>
          <div className="space-y-3">
            {TIER_THRESHOLDS.map(t => {
              const TIcon = t.icon;
              const isCurrent = customer.loyaltyPoints >= t.min && (t.next === Infinity || customer.loyaltyPoints < t.next);
              const isAchieved = customer.loyaltyPoints >= t.min;
              return (
                <div key={t.name} className={`flex items-center gap-3 p-3 rounded-xl ${isCurrent ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800" : "bg-gray-50 dark:bg-gray-700/50"}`}>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center ${isAchieved ? "" : "opacity-40"}`}>
                    <TIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isAchieved ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}>{t.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.min}+ points — Remise {t.discount}</p>
                  </div>
                  {isCurrent && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">Actuel</Badge>}
                  {isAchieved && !isCurrent && <span className="text-emerald-500 text-xs">✓</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* How to earn */}
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><Gift className="w-5 h-5 text-emerald-500" /> Comment gagner des points ?</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl"><CalendarCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /><div><p className="text-sm font-medium text-gray-900 dark:text-gray-100">Réservation</p><p className="text-xs text-gray-500 dark:text-gray-400">+50 points par réservation</p></div></div>
            <div className="flex items-center gap-3 p-3 bg-teal-50 dark:bg-teal-900/20 rounded-xl"><ShoppingBag className="w-5 h-5 text-teal-600 dark:text-teal-400" /><div><p className="text-sm font-medium text-gray-900 dark:text-gray-100">Commande</p><p className="text-xs text-gray-500 dark:text-gray-400">+10 points par 10 000 GNF dépensés</p></div></div>
            <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl"><MessageSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" /><div><p className="text-sm font-medium text-gray-900 dark:text-gray-100">Avis client</p><p className="text-xs text-gray-500 dark:text-gray-400">+25 points par avis publié</p></div></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
