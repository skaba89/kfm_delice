"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Use callback ref pattern to avoid setState-in-effect lint error
  const refCallback = () => {
    setMounted(true);
  };

  if (!mounted) {
    return (
      <button ref={refCallback} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
        <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
      title={theme === "light" ? "Clair" : theme === "dark" ? "Sombre" : "Système"}
    >
      {theme === "dark" ? (
        <Moon className="w-4 h-4 sm:w-5 sm:h-5" />
      ) : theme === "system" ? (
        <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
      ) : (
        <Sun className="w-4 h-4 sm:w-5 sm:h-5" />
      )}
    </button>
  );
}
