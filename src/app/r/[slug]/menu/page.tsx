"use client";

import { useParams } from "next/navigation";
import { RestaurantProvider } from "@/lib/restaurant-context";
import { DynamicTheme } from "@/components/DynamicTheme";
import { MenuOrderingPageDynamic } from "@/components/MenuOrderingPageDynamic";

export default function RestaurantMenuPage() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <RestaurantProvider slug={slug}>
      <DynamicTheme>
        <MenuOrderingPageDynamic />
      </DynamicTheme>
    </RestaurantProvider>
  );
}
