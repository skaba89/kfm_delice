"use client";

import { Clock, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPrice, statusColors, statusLabels } from "@/lib/constants";
import type { OrderDB } from "@/lib/types";

interface DriverHistoryProps {
  completedOrders: OrderDB[];
}

export function DriverHistory({ completedOrders }: DriverHistoryProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <Clock className="w-4 h-4 text-gray-400" /> Historique des livraisons
      </h3>
      {completedOrders.length === 0 ? (
        <div className="text-center py-16">
          <TrendingUp className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Aucune livraison terminée</p>
        </div>
      ) : (
        completedOrders.map(order => (
          <Card key={order.id} className="dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{order.customerName || "Client"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{order.deliveryAddress}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(order.createdAt).toLocaleString("fr-FR")}</p>
                </div>
                <div className="text-right">
                  <Badge className={`${statusColors[order.status] || "bg-gray-100 text-gray-600"} text-[10px]`}>
                    {statusLabels[order.status] || order.status}
                  </Badge>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-1">{formatPrice(order.total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
