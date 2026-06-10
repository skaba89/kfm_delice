"use client";

import { Trash2 } from "lucide-react";

interface DeleteConfirmButtonProps {
  /** Whether this item is in the "confirm delete" state */
  confirming: boolean;
  /** Called when user clicks "Oui" to confirm deletion */
  onConfirm: () => void;
  /** Called when user clicks the trash icon to request confirmation */
  onRequestConfirm: () => void;
  /** Called when user clicks "Non" to cancel */
  onCancel: () => void;
}

/**
 * Inline delete confirmation button.
 * Shows a trash icon by default, then toggles to Oui/Non buttons
 * when the user clicks it — standard pattern across all admin tabs.
 */
export function DeleteConfirmButton({
  confirming,
  onConfirm,
  onRequestConfirm,
  onCancel,
}: DeleteConfirmButtonProps) {
  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={onConfirm}
          className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded"
        >
          Oui
        </button>
        <button
          onClick={onCancel}
          className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded"
        >
          Non
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onRequestConfirm}
      className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
      title="Supprimer"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
