"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock, Flame, CheckCircle2, XCircle, RotateCcw, Play,
  ChefHat, TrendingUp, Timer, Utensils, Activity, Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notifications";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/constants";

interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
  notes?: string;
}

interface KitchenOrder {
  id: string;
  number: string;
  items: string; // JSON
  status: string;
  orderType: string;
  tableNumber: number;
  customerName: string;
  customerPhone: string;
  notes: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  _count?: { payments: number };
}

interface KitchenData {
  queues: {
    pending: KitchenOrder[];
    preparing: KitchenOrder[];
    ready: KitchenOrder[];
  };
  summary: {
    totalToday: number;
    pending: number;
    preparing: number;
    ready: number;
    deliveredToday: number;
    avgPrepTimeMin: number;
  };
  dailyCounts: { date: string; count: number }[];
  topDishes: { name: string; qty: number }[];
}

const ORDER_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  dine_in: { label: "Sur place", icon: "🍽️", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  takeaway: { label: "À emporter", icon: "🥡", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  delivery: { label: "Livraison", icon: "🛵", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
};

function parseItems(items: string): OrderItem[] {
  try {
    const parsed = JSON.parse(items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return `il y a ${h}h${min % 60 ? ` ${min % 60}min` : ""}`;
}

function getOrderAge(iso: string): { min: number; alert: boolean } {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return { min, alert: min >= 20 }; // alert if > 20 min
}

export function KitchenDashboard({ onLogout }: { onLogout: () => void }) {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<KitchenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/kitchen");
      if (res.ok) {
        const d = await res.json();
        setData(d);
      } else {
        notify.error("Erreur de chargement");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  // Poll every 5s
  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  // Refresh "time ago" labels every 30s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const updateStatus = async (orderId: string, action: "start" | "finish" | "cancel" | "recall") => {
    try {
      const res = await apiFetch("/api/kitchen", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });
      if (res.ok) {
        const messages: Record<string, string> = {
          start: "Préparation démarrée",
          finish: "Commande prête !",
          cancel: "Commande annulée",
          recall: "Commande reprise en cuisine",
        };
        notify.success(messages[action]);
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        notify.error(err.error || "Erreur");
      }
    } catch (e) {
      console.error(e);
      notify.error("Erreur réseau");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <ChefHat className="w-12 h-12 text-orange-500 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-500">Chargement de la cuisine...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Impossible de charger les données</p>
      </div>
    );
  }

  const maxDailyCount = Math.max(...data.dailyCounts.map((d) => d.count), 1);
  const maxDishQty = Math.max(...data.topDishes.map((d) => d.qty), 1);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Cuisine KFM Delice</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(now).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live
            </span>
            <Button variant="outline" size="sm" onClick={onLogout}>Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={Activity} label="Total aujourd'hui" value={String(data.summary.totalToday)} color="text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400" />
          <StatCard icon={Clock} label="En attente" value={String(data.summary.pending)} color="text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400" />
          <StatCard icon={Flame} label="En préparation" value={String(data.summary.preparing)} color="text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400" />
          <StatCard icon={CheckCircle2} label="Prêtes" value={String(data.summary.ready)} color="text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20 dark:text-cyan-400" />
          <StatCard icon={Timer} label="Temps moyen" value={data.summary.avgPrepTimeMin ? `${data.summary.avgPrepTimeMin} min` : "—"} color="text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400" />
        </div>

        {/* 3-column queue */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pending */}
          <QueueColumn
            title="File d'attente"
            icon={Clock}
            color="amber"
            count={data.queues.pending.length}
            orders={data.queues.pending}
            actionLabel="Commencer"
            actionIcon={Play}
            onAction={(id) => updateStatus(id, "start")}
            emptyMessage="Aucune commande en attente 🎉"
          />

          {/* Preparing */}
          <QueueColumn
            title="En préparation"
            icon={Flame}
            color="orange"
            count={data.queues.preparing.length}
            orders={data.queues.preparing}
            actionLabel="Marquer prêt"
            actionIcon={CheckCircle2}
            onAction={(id) => updateStatus(id, "finish")}
            secondaryAction={{
              label: "Annuler",
              icon: XCircle,
              onClick: (id) => updateStatus(id, "cancel"),
            }}
            emptyMessage="Aucune préparation en cours"
          />

          {/* Ready */}
          <QueueColumn
            title="Prêtes à servir"
            icon={CheckCircle2}
            color="cyan"
            count={data.queues.ready.length}
            orders={data.queues.ready}
            actionLabel="Reprendre"
            actionIcon={RotateCcw}
            onAction={(id) => updateStatus(id, "recall")}
            emptyMessage="Aucune commande prête"
            isReady
          />
        </div>

        {/* Production stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 7-day production chart */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Production — 7 derniers jours</h3>
              </div>
              <div className="flex items-end justify-between gap-2 h-40">
                {data.dailyCounts.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">{d.count}</div>
                    <div
                      className="w-full bg-gradient-to-t from-orange-500 to-amber-400 rounded-t transition-all"
                      style={{ height: `${(d.count / maxDailyCount) * 100}%`, minHeight: d.count > 0 ? "8px" : "2px" }}
                    />
                    <div className="text-[10px] text-gray-400">
                      {new Date(d.date).toLocaleDateString("fr-FR", { weekday: "short" })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{data.summary.deliveredToday}</span> commande(s) livrée(s) aujourd'hui
              </div>
            </CardContent>
          </Card>

          {/* Top dishes today */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Top plats du jour</h3>
              </div>
              {data.topDishes.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">Aucune donnée pour aujourd'hui</p>
              ) : (
                <div className="space-y-2">
                  {data.topDishes.map((dish, i) => (
                    <div key={dish.name} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center text-xs font-bold text-orange-600 dark:text-orange-400">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{dish.name}</p>
                        <div className="mt-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
                            style={{ width: `${(dish.qty / maxDishQty) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{dish.qty}×</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QueueColumn({
  title, icon: Icon, color, count, orders, actionLabel, actionIcon: ActionIcon, onAction, secondaryAction, emptyMessage, isReady,
}: {
  title: string;
  icon: typeof Clock;
  color: "amber" | "orange" | "cyan";
  count: number;
  orders: KitchenOrder[];
  actionLabel: string;
  actionIcon: typeof Play;
  onAction: (id: string) => void;
  secondaryAction?: { label: string; icon: typeof XCircle; onClick: (id: string) => void };
  emptyMessage: string;
  isReady?: boolean;
}) {
  const colorClasses = {
    amber: "border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10",
    orange: "border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/10",
    cyan: "border-cyan-200 dark:border-cyan-900/50 bg-cyan-50/50 dark:bg-cyan-900/10",
  };
  const iconBg = {
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  };

  return (
    <div className={`rounded-xl border-2 ${colorClasses[color]} flex flex-col max-h-[800px]`}>
      <div className="p-4 flex items-center justify-between border-b border-current/10">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
        <span className={`text-2xl font-bold ${iconBg[color].split(" ").find((c) => c.startsWith("text-"))}`}>
          {count}
        </span>
      </div>
      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">{emptyMessage}</p>
        ) : orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            actionLabel={actionLabel}
            actionIcon={ActionIcon}
            onAction={onAction}
            secondaryAction={secondaryAction}
            isReady={isReady}
          />
        ))}
      </div>
    </div>
  );
}

function OrderCard({
  order, actionLabel, actionIcon: ActionIcon, onAction, secondaryAction, isReady,
}: {
  order: KitchenOrder;
  actionLabel: string;
  actionIcon: typeof Play;
  onAction: (id: string) => void;
  secondaryAction?: { label: string; icon: typeof XCircle; onClick: (id: string) => void };
  isReady?: boolean;
}) {
  const items = parseItems(order.items);
  const age = getOrderAge(order.createdAt);
  const oType = ORDER_TYPE_LABELS[order.orderType] || ORDER_TYPE_LABELS.dine_in;

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm border ${age.alert && !isReady ? "border-red-300 dark:border-red-900" : "border-gray-200 dark:border-gray-800"} p-3`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-bold text-gray-900 dark:text-gray-100">#{order.number || order.id.slice(-6).toUpperCase()}</p>
          <p className="text-xs text-gray-500">{formatTimeAgo(order.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={`text-[10px] ${oType.color}`}>{oType.icon} {oType.label}</Badge>
          {order.orderType === "dine_in" && order.tableNumber > 0 && (
            <span className="text-xs text-gray-500">Table {order.tableNumber}</span>
          )}
        </div>
      </div>

      {/* Customer info */}
      {order.customerName && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          👤 {order.customerName}{order.customerPhone && ` • ${order.customerPhone}`}
        </p>
      )}

      {/* Items list */}
      <ul className="space-y-1 mb-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="font-bold text-orange-600 dark:text-orange-400 min-w-[28px]">{it.quantity}×</span>
            <div className="flex-1">
              <span className="text-gray-900 dark:text-gray-100">{it.name}</span>
              {it.notes && <p className="text-xs text-gray-500 italic">→ {it.notes}</p>}
            </div>
          </li>
        ))}
      </ul>

      {/* Order notes */}
      {order.notes && (
        <div className="rounded bg-amber-50 dark:bg-amber-900/20 p-2 mb-2">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            <span className="font-semibold">Note:</span> {order.notes}
          </p>
        </div>
      )}

      {/* Alert if old */}
      {age.alert && !isReady && (
        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 mb-2">
          <Clock className="w-3 h-3" /> En attente depuis {age.min} min
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          onClick={() => onAction(order.id)}
          className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs h-8"
        >
          <ActionIcon className="w-3.5 h-3.5 mr-1" /> {actionLabel}
        </Button>
        {secondaryAction && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => secondaryAction.onClick(order.id)}
            className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 h-8"
          >
            <secondaryAction.icon className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
