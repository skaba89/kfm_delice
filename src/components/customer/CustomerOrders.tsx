"use client";

import { ShoppingBag, Navigation, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { OrderTypeIcon } from "@/components/OrderTypeIcon";
import type { OrderDB } from "@/lib/types";
import { statusColors, statusLabels, orderTypeLabels, formatPrice } from "@/lib/constants";
import { ORDER_STEPS, ORDER_STEP_LABELS } from "@/lib/hooks/use-loyalty";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";

interface CustomerOrdersProps {
  orders: OrderDB[];
  orderFilter: "all" | "active" | "completed" | "cancelled";
  setOrderFilter: (f: "all" | "active" | "completed" | "cancelled") => void;
  orderSearch: string;
  setOrderSearch: (s: string) => void;
  onTrackOrder: (order: OrderDB) => void;
  onReorder: (order: OrderDB) => void;
}

export function CustomerOrders({
  orders,
  orderFilter,
  setOrderFilter,
  orderSearch,
  setOrderSearch,
  onTrackOrder,
  onReorder,
}: CustomerOrdersProps) {
  const filteredOrders = orders.filter(o => {
    if (orderFilter === "active") return !["delivered", "cancelled"].includes(o.status);
    if (orderFilter === "completed") return o.status === "delivered";
    if (orderFilter === "cancelled") return o.status === "cancelled";
    return true;
  }).filter(o => {
    if (!orderSearch) return true;
    try {
      const items: { name: string }[] = JSON.parse(o.items);
      return items.some(i => i.name.toLowerCase().includes(orderSearch.toLowerCase()));
    } catch {
      return o.customerName.toLowerCase().includes(orderSearch.toLowerCase());
    }
  });

  const ordersPagination = usePagination(filteredOrders, 6);

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        {(["all", "active", "completed", "cancelled"] as const).map(f => (
          <Button key={f} size="sm" variant={orderFilter === f ? "default" : "outline"} onClick={() => setOrderFilter(f)} className={`text-xs rounded-lg ${orderFilter === f ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white" : "dark:border-gray-600"}`}>
            {f === "all" ? "Toutes" : f === "active" ? "En cours" : f === "completed" ? "Terminées" : "Annulées"}
          </Button>
        ))}
        <div className="flex-1" />
        <Input placeholder="Rechercher..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="max-w-[200px] h-8 text-xs dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
      </div>

      {filteredOrders.length === 0 ? (
        <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-8 text-center"><ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400">Aucune commande trouvée</p></CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {ordersPagination.paginatedItems.map((o) => {
            let items: { name: string; price: number; qty: number }[] = [];
            try { items = JSON.parse(o.items); } catch { /* */ }
            const stepIdx = ORDER_STEPS.indexOf(o.status);
            const isCancelled = o.status === "cancelled";
            const isDelivered = o.status === "delivered";

            return (
              <Card key={o.id} className="dark:bg-gray-800 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <OrderTypeIcon type={o.orderType} />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{orderTypeLabels[o.orderType] || o.orderType}</span>
                    </div>
                    <Badge className={`${statusColors[o.status] || ""} text-xs`}>{statusLabels[o.status] || o.status}</Badge>
                  </div>

                  {/* Visual step indicator */}
                  {!isCancelled && !isDelivered && o.status !== "pending" && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between">
                        {ORDER_STEP_LABELS.map((label, idx) => {
                          const stepId = ORDER_STEPS[idx];
                          const isStepDone = idx <= stepIdx;
                          const isStepCurrent = idx === stepIdx;
                          return (
                            <div key={stepId} className="flex flex-col items-center flex-1">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${isStepDone ? "bg-emerald-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-400"} ${isStepCurrent ? "ring-2 ring-emerald-300 dark:ring-emerald-600" : ""}`}>
                                {isStepDone ? "✓" : idx + 1}
                              </div>
                              <span className={`text-[7px] mt-0.5 ${isStepDone ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-gray-400 dark:text-gray-500"} hidden sm:block`}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 mb-3">
                    {items.map((it, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{it.name} x{it.qty}</span>
                        <span className="text-gray-900 dark:text-gray-200 font-medium">{formatPrice(it.price * it.qty)}</span>
                      </div>
                    ))}
                  </div>
                  {o.deliveryAddress && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">📍 {o.deliveryAddress}</p>}
                  <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</span>
                    <div className="flex items-center gap-2">
                      {isDelivered && (
                        <Button size="sm" variant="outline" onClick={() => onReorder(o)} className="text-xs rounded-lg h-7 dark:border-gray-600"><Zap className="w-3 h-3 mr-1" /> Recommander</Button>
                      )}
                      {o.orderType === "delivery" && !["delivered", "cancelled"].includes(o.status) && (
                        <Button size="sm" onClick={() => onTrackOrder(o)} className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs rounded-lg h-7">
                          <Navigation className="w-3 h-3 mr-1" /> Suivre
                        </Button>
                      )}
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatPrice(o.total + o.deliveryFee)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Pagination currentPage={ordersPagination.currentPage} totalPages={ordersPagination.totalPages} totalItems={ordersPagination.totalItems} itemsPerPage={ordersPagination.itemsPerPage} onPageChange={ordersPagination.setCurrentPage} label="commandes" />
    </div>
  );
}
