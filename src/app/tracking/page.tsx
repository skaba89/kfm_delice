"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DeliveryTrackingPage } from "@/components/DeliveryTrackingPage";
import type { OrderDB } from "@/lib/types";

function PageContent() {
  const { customer, apiFetch } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<OrderDB | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/tracking?orderId=${orderId}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
        }
      } catch {
        // Order not found
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  const handleBack = () => {
    if (customer) {
      router.push("/client");
    } else {
      router.push("/");
    }
  };

  if (!orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Aucune commande spécifiée pour le suivi</p>
          <button onClick={handleBack} className="text-orange-500 hover:text-orange-600 font-medium">
            Retour
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Commande introuvable</p>
          <button onClick={handleBack} className="text-orange-500 hover:text-orange-600 font-medium">
            Retour
          </button>
        </div>
      </div>
    );
  }

  return <DeliveryTrackingPage trackingOrder={order} onBack={handleBack} />;
}

export default function TrackingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PageContent />
    </Suspense>
  );
}
