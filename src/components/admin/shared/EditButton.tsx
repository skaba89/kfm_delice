"use client";

import { Edit3 } from "lucide-react";

interface EditButtonProps {
  /** Called when the edit button is clicked */
  onClick: () => void;
  /** Tooltip text (default: "Modifier") */
  title?: string;
}

/**
 * Standardized edit icon button for admin CRUD items.
 */
export function EditButton({ onClick, title = "Modifier" }: EditButtonProps) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-orange-900/30 dark:hover:text-orange-400"
      title={title}
    >
      <Edit3 className="w-4 h-4" />
    </button>
  );
}
