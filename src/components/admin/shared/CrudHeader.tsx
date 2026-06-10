"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { StatusBadgeBar, type StatusBadge } from "./StatusBadgeBar";
import { ReactNode } from "react";

interface CrudHeaderProps {
  /** Status badges to display on the left */
  badges?: StatusBadge[];
  /** Custom left content (overrides badges if provided) */
  leftContent?: ReactNode;
  /** Label for the add button (e.g. "Ajouter un livreur") */
  addLabel?: string;
  /** Called when add button is clicked */
  onAdd?: () => void;
}

/**
 * Standard header for CRUD tabs with badge bar + add button.
 * Eliminates the duplicated header pattern found across all admin tabs.
 */
export function CrudHeader({ badges, leftContent, addLabel, onAdd }: CrudHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      {leftContent || (badges && <StatusBadgeBar badges={badges} />)}
      {addLabel && onAdd && (
        <Button onClick={onAdd} className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm">
          <Plus className="w-4 h-4 mr-1" /> {addLabel}
        </Button>
      )}
    </div>
  );
}
