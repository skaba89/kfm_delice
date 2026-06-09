"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Phone, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPrice, statusColors, statusLabels } from "@/lib/constants";
import type { OrderDB } from "@/lib/types";

interface OrderCardProps {
  order: OrderDB;
  isMyOrder?: boolean;
  onAction?: { label: string; status: string; icon: React.ComponentType<{ className?: string }> };
  onActionClick: (orderId: string, status: string) => void;
}

export function DriverOrderCard({ order, isMyOrder, onAction, onActionClick }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const items = (() => {
    try { return JSON.parse(order.items || "[]"); } catch { return []; }
  })();
  const statusSteps = ["ready", "picking_up", "delivering", "delivered"];
  const currentIdx = statusSteps.indexOf(order.status);

  return (
    <Card className={`dark:bg-gray-800 dark:border-gray-700 ${isMyOrder ? "border-blue-200 dark:border-blue-800" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`${statusColors[order.status] || "bg-gray-100 text-gray-600"} text-[10px]`}>
                {statusLabels[order.status] || order.status}
              </Badge>
              {isMyOrder && (
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px]">
                  Ma livraison
                </Badge>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{order.customerName || "Client"}</p>
            {order.deliveryAddress && (
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" /> {order.deliveryAddress}
              </p>
            )}
            {order.phone && (
              <a href={`tel:${order.phone}`} className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" /> {order.phone}
              </a>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatPrice(order.total)}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {new Date(order.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        {/* Progress indicator for active orders */}
        {isMyOrder && (
          <div className="mt-3 flex items-center gap-0.5">
            {statusSteps.map((step, i) => (
              <div key={step} className="flex items-center flex-1">
                <div className={`w-2 h-2 rounded-full ${currentIdx >= i ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                {i < statusSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 ${currentIdx > i ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        <button onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
          <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
          {expanded ? "Masquer" : "Détails"}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-2 space-y-1">
                {items.map((item: { name: string; price: number; qty: number }, i: number) => (
                  <div key={i} className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>{item.name} x{item.qty}</span>
                    <span>{formatPrice(item.price * item.qty)}</span>
                  </div>
                ))}
                <Separator className="my-1" />
                {order.deliveryFee > 0 && (
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Livraison</span>
                    <span>{formatPrice(order.deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold text-gray-900 dark:text-gray-100">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
                {order.note && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Note : </span>{order.note}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {onAction && (
          <Button
            onClick={() => onActionClick(order.id, onAction.status)}
            className={`w-full mt-3 rounded-xl py-5 text-sm font-bold ${
              isMyOrder
                ? "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/30"
                : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-500/30"
            }`}
          >
            <onAction.icon className="w-4 h-4 mr-2" /> {onAction.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
