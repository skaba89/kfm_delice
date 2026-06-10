"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  /** Icon component to display */
  icon: LucideIcon;
  /** Message text (e.g. "Aucun livreur enregistré") */
  message: string;
}

/**
 * Empty state placeholder for admin tabs.
 * Eliminates the duplicated empty Card pattern found across all tabs.
 */
export function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardContent className="p-8 text-center">
        <Icon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">{message}</p>
      </CardContent>
    </Card>
  );
}
