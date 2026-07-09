"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useLocale, type Locale } from "@/lib/i18n";

const LOCALES: { value: Locale; label: string; flag: string }[] = [
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "en", label: "English", flag: "🇬🇧" },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, changeLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = LOCALES.find((l) => l.value === locale) || LOCALES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
        aria-label="Change language"
      >
        <Globe className="w-4 h-4" />
        {!compact && <span className="uppercase">{current.value}</span>}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
          {LOCALES.map((l) => (
            <button
              key={l.value}
              onClick={() => {
                changeLocale(l.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-white/5 transition-colors ${
                l.value === locale ? "text-orange-600 dark:text-orange-400 font-medium" : "text-gray-700 dark:text-gray-300"
              }`}
            >
              <span className="text-base">{l.flag}</span>
              <span className="flex-1 text-left">{l.label}</span>
              {l.value === locale && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
