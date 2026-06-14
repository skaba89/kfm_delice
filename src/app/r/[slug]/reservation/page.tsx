"use client";

import { useParams } from "next/navigation";
import { RestaurantProvider } from "@/lib/restaurant-context";
import { DynamicTheme } from "@/components/DynamicTheme";
import { ReservationPageDynamic } from "@/components/ReservationPageDynamic";

export default function RestaurantReservationPage() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <RestaurantProvider slug={slug}>
      <DynamicTheme>
        <ReservationPageDynamic />
      </DynamicTheme>
    </RestaurantProvider>
  );
}
