"use client";

import { Bike, Car } from "lucide-react";

export function VehicleIcon({ vehicle }: { vehicle: string }) {
  if (vehicle === "voiture") return <Car className="w-4 h-4" />;
  return <Bike className="w-4 h-4" />;
}
