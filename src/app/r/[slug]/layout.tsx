"use client";

import { useParams } from "next/navigation";
import { RestaurantProvider } from "@/lib/restaurant-context";
import { DynamicTheme } from "@/components/DynamicTheme";

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <RestaurantProvider slug={slug}>
      <DynamicTheme>
        {children}
      </DynamicTheme>
    </RestaurantProvider>
  );
}
