"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { XCircle, MapPin, Bike, ShoppingBag } from "lucide-react";
import { OrderTypeIcon } from "@/components/OrderTypeIcon";
import type { OrderDB } from "@/lib/types";
import { formatPrice, statusColors, statusLabels, orderTypeLabels, paymentLabels } from "@/lib/constants";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";
import { ExportButton } from "@/components/admin/ExportButton";
import { ExportJournalButton } from "@/components/admin/ExportJournalButton";

export interface OrdersTabProps {
  orders: OrderDB[];
  apiPatch: (url: string, body: object) => Promise<void>;
}

export function OrdersTab({ orders, apiPatch }: OrdersTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(orders, 12);

  const handleStatusChange = async (orderId: string, status: string) => {
    await apiPatch("/api/orders", { id: orderId, status });
    notify.orderStatusChanged(statusLabels[status] || status);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{orders.filter(o => o.status === "pending").length} En attente</Badge>
        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">{orders.filter(o => o.status === "preparing").length} En préparation</Badge>
        <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">{orders.filter(o => o.status === "ready").length} Prêts</Badge>
        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{orders.filter(o => o.status === "delivering").length} En livraison</Badge>
        <div className="ml-auto flex gap-2">
          <ExportJournalButton label="Journal PDF" />
          <ExportButton type="orders" label="Exporter CSV" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 text-center py-12">
            <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Aucune commande</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Les nouvelles commandes apparaîtront ici</p>
          </div>
        )}
        {paginatedItems.map((o) => {
          let items: { name: string; price: number; qty: number }[] = [];
          try { items = JSON.parse(o.items); } catch { /* */ }
          return (
            <Card key={o.id} className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge className={`${statusColors[o.status] || ""} text-xs`}>{statusLabels[o.status] || o.status}</Badge>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs flex items-center gap-1 dark:border-gray-600 dark:text-gray-300"><OrderTypeIcon type={o.orderType} /> {orderTypeLabels[o.orderType] || o.orderType}</Badge>
                  </div>
                </div>
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-0.5">{o.customerName || "Client sur place"}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{o.phone || "-"}</p>
                {o.orderType === "delivery" && o.deliveryAddress && (
                  <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 mb-2"><MapPin className="w-3 h-3" /><span className="truncate">{o.deliveryAddress}</span></div>
                )}
                <div className="space-y-1 mb-2">
                  {items.map((item, j) => (
                    <div key={j} className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{item.qty}x {item.name}</span>
                      <span className="text-gray-900 dark:text-gray-200 font-medium">{formatPrice(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Total</span>
                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{formatPrice(o.total)}</span>
                </div>
                {o.deliveryFee > 0 && <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">+ {formatPrice(o.deliveryFee)} frais de livraison</p>}
                {o.driver && <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2 bg-gray-50 dark:bg-gray-700/50 p-1.5 rounded-lg"><Bike className="w-3 h-3" /> {o.driver.name}</div>}
                <div className="flex gap-2 flex-wrap">
                  {o.status === "pending" && <Button size="sm" onClick={() => handleStatusChange(o.id, "preparing")} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg">Préparer</Button>}
                  {o.status === "preparing" && <Button size="sm" onClick={() => handleStatusChange(o.id, "ready")} className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white text-xs rounded-lg">Prêt</Button>}
                  {o.status === "ready" && o.orderType === "delivery" && (
                    <Button size="sm" onClick={() => handleStatusChange(o.id, "delivering")} className="flex-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg">Livrer</Button>
                  )}
                  {o.status === "ready" && o.orderType !== "delivery" && (
                    <Button size="sm" onClick={() => handleStatusChange(o.id, "delivered")} className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Servi</Button>
                  )}
                  {o.status === "delivering" && (
                    <Button size="sm" onClick={() => handleStatusChange(o.id, "delivered")} className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg">Livré</Button>
                  )}
                  {o.status !== "cancelled" && o.status !== "delivered" && (
                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(o.id, "cancelled")} className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 text-xs rounded-lg"><XCircle className="w-3 h-3" /></Button>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1"><Badge variant="outline" className="text-[10px] dark:border-gray-600 dark:text-gray-400">{paymentLabels[o.paymentMethod] || o.paymentMethod}</Badge></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="commandes" />
    </div>
  );
}
