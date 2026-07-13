"use client";

/**
 * useKeyboardShortcuts — global keyboard shortcuts for the admin dashboard.
 *
 * Shortcuts are ONLY active on /admin (not on /kitchen, /client, /driver,
 * or public pages) to avoid hijacking the user's typing in forms.
 *
 * Shortcuts:
 *   1-9         : jump to sidebar tab by index (1=overview, 2=reservations, ...)
 *   R / r       : refresh current tab data
 *   /           : focus the search field (if any) in the current tab
 *   N / n       : trigger the "new" action of the current tab
 *                   (e.g. new order, new menu item, new reservation)
 *   ?           : show the shortcuts help dialog
 *   Esc         : close any open dialog / help
 *
 * Modifiers are respected: Ctrl/Cmd+R (browser refresh), Ctrl+Key (browser
 * shortcuts) are NOT intercepted. We only fire on bare keypresses when the
 * focus is NOT in an input/textarea/select.
 */

import { useEffect, useCallback, useState } from "react";

export interface ShortcutDef {
  key: string;
  description: string;
  /** Display label for the key (e.g. "1-9", "R", "/", "?") */
  display: string;
}

export const SHORTCUTS_HELP: ShortcutDef[] = [
  { key: "1-9", display: "1-9", description: "Aller à l'onglet N (1=Vue d'ensemble, 2=Réservations, ...)" },
  { key: "r", display: "R", description: "Rafraîchir les données de l'onglet courant" },
  { key: "/", display: "/", description: "Focus le champ de recherche" },
  { key: "n", display: "N", description: "Nouvelle action (commande, plat, réservation...)" },
  { key: "?", display: "?", description: "Afficher cette aide" },
  { key: "Escape", display: "Esc", description: "Fermer les dialogues ouverts" },
];

interface UseKeyboardShortcutsOptions {
  /** Called when a number key 1-9 is pressed */
  onTabSelect?: (index: number) => void;
  /** Called when R is pressed */
  onRefresh?: () => void;
  /** Called when / is pressed — should focus the search input */
  onSearchFocus?: () => void;
  /** Called when N is pressed — should trigger the "new" action */
  onNew?: () => void;
  /** Whether shortcuts are enabled (default: true). Disable when a
   *  modal is open and we don't want to intercept keys. */
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onTabSelect,
  onRefresh,
  onSearchFocus,
  onNew,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const [helpOpen, setHelpOpen] = useState(false);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't intercept if the user is typing in a form field
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          target.isContentEditable
        ) {
          // Special case: Escape always works (even in inputs) to blur/close
          if (e.key === "Escape") {
            (target as HTMLElement).blur();
          }
          return;
        }
      }

      // Don't intercept if a modifier key is pressed (Ctrl+R, Cmd+R, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Number keys 1-9 → tab selection
      if (e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key, 10) - 1;
        if (onTabSelect) {
          e.preventDefault();
          onTabSelect(idx);
        }
        return;
      }

      // Single-letter shortcuts (case-insensitive)
      const key = e.key.toLowerCase();
      if (key === "r") {
        e.preventDefault();
        onRefresh?.();
      } else if (key === "/") {
        e.preventDefault();
        onSearchFocus?.();
      } else if (key === "n") {
        e.preventDefault();
        onNew?.();
      } else if (key === "?") {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        if (helpOpen) {
          setHelpOpen(false);
        }
      }
    },
    [enabled, onTabSelect, onRefresh, onSearchFocus, onNew, helpOpen]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, handler]);

  return { helpOpen, setHelpOpen };
}
