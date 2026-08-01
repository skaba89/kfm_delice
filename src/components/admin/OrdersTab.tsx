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
  apiFetch?: (url: string, options?: RequestInit) => Promise<Response>;
}

export function OrdersTab({ orders, apiPatch, apiFetch }: OrdersTabProps) {
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
                {/* 💰 Mission P2.5: tip display */}
                {o.tip > 0 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">💚 Pourboire</span>
                    <span className="text-xs text-green-600 dark:text-green-400 font-bold">+{formatPrice(o.tip)}</span>
                  </div>
                )}
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
                <div className="flex items-center justify-between mt-1">
                  <Badge variant="outline" className="text-[10px] dark:border-gray-600 dark:text-gray-400">{paymentLabels[o.paymentMethod] || o.paymentMethod}</Badge>
                  {o.phone && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await apiFetch?.("/api/notify/whatsapp", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ orderId: o.id }),
                          });
                          if (!res) { notify.error("Action non disponible"); return; }
                          const data = await res.json();
                          if (data.waLink) window.open(data.waLink, "_blank");
                          else notify.info(data.message || "Pas de numéro de téléphone");
                        } catch { notify.error("Erreur WhatsApp"); }
                      }}
                      className="text-green-600 hover:text-green-700 text-xs flex items-center gap-0.5"
                      title="Envoyer statut via WhatsApp"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.25 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.46-1.38-1.71-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/></svg>
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="commandes" />
    </div>
  );
}
