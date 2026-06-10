"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface AdminFormCardProps {
  /** Whether the form is visible */
  show: boolean;
  /** Whether we're editing (affects title and button label) */
  editing: boolean;
  /** Title when adding (e.g. "Ajouter un livreur") */
  addTitle: string;
  /** Title when editing (e.g. "Modifier le livreur") */
  editTitle: string;
  /** Called when Save is clicked */
  onSave: () => Promise<void>;
  /** Called when Cancel is clicked */
  onCancel: () => void;
  /** Loading state for the save button */
  saving?: boolean;
  /** Form fields content */
  children: React.ReactNode;
}

/**
 * Shared animated form card wrapper for admin CRUD tabs.
 * Eliminates the duplicated AnimatePresence + motion.div + Card shell
 * found in every admin tab (Staff, Drivers, Customers, Expenses, etc.)
 */
export function AdminFormCard({
  show,
  editing,
  addTitle,
  editTitle,
  onSave,
  onCancel,
  saving = false,
  children,
}: AdminFormCardProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <Card className="border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-900/10">
            <CardContent className="p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {editing ? editTitle : addTitle}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {children}
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={onSave}
                  disabled={saving}
                  className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl"
                >
                  <Save className="w-4 h-4 mr-1" />
                  {editing ? "Enregistrer" : "Ajouter"}
                </Button>
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="dark:border-gray-600"
                >
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
