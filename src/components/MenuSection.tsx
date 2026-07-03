"use client";

import { useState, useEffect } from "react";
import { Star, RefreshCw, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedSection } from "@/components/AnimatedSection";
import type { MenuItemDB } from "@/lib/types";
import { MENU_CATS, formatPrice } from "@/lib/constants";

// ─── WhatsApp number resolution ──────────────────────────────────
// For a SaaS multi-restaurant platform, the WhatsApp number MUST NOT be
// hardcoded in the component. Resolution order:
//   1. Per-tenant number from /api/restaurant (whatsapp field)
//   2. NEXT_PUBLIC_WHATSAPP_NUMBER env var (build-time fallback)
//   3. The historical KFM Delice number (last-resort fallback, never breaks
//      the existing button)
const FALLBACK_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "224622345678";

export function MenuSection() {
  const [menuItems, setMenuItems] = useState<MenuItemDB[]>([]);
  const [activeCat, setActiveCat] = useState("entrees");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState<string>(FALLBACK_WHATSAPP);

  useEffect(() => {
    // Fetch menu items + restaurant config (for the per-tenant WhatsApp
    // number) in parallel. Failures are non-fatal — we fall back to the
    // env var / hardcoded number so the Commander button always works.
    Promise.all([
      fetch("/api/menu?limit=1000")
        .then(r => r.ok ? r.json() : Promise.reject(new Error("menu " + r.status)))
        .then(d => Array.isArray(d) ? d : (d.data || []))
        .catch(() => { setLoadError(true); return []; }),
      fetch("/api/restaurant")
        .then(r => r.ok ? r.json() : null)
        .then(d => d?.whatsapp ? String(d.whatsapp).replace(/[^0-9]/g, "") : null)
        .catch(() => null),
    ]).then(([items, wa]) => {
      setMenuItems(items);
      if (wa) setWhatsappNumber(wa);
      setLoading(false);
    });
  }, []);

  const items = menuItems.filter(i => i.category === activeCat && i.available);
  return (
    <section id="menu" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-orange-100 text-orange-700 mb-4">Notre Carte</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Le Menu <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">KFM Delice</span></h2>
          <p className="text-gray-500 max-w-2xl mx-auto">Des plats préparés avec passion, des ingrédients frais et un savoir-faire guinéen authentique</p>
        </AnimatedSection>
        <div className="flex justify-center gap-2 sm:gap-4 mb-10 flex-wrap">
          {MENU_CATS.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)} className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${activeCat === c.id ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              <c.icon className="w-4 h-4" /> {c.name}
            </button>
          ))}
        </div>
        {loading ? <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 text-orange-500 animate-spin" /></div> : loadError && items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium mb-2">Le menu est temporairement indisponible.</p>
            <p className="text-sm">Veuillez réessayer dans quelques instants.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">Aucun plat disponible dans cette catégorie pour le moment.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <AnimatedSection key={item.id}>
                <Card className="overflow-hidden hover:shadow-xl transition-all group">
                  <div className="h-48 overflow-hidden relative bg-gradient-to-br from-orange-100 to-amber-100 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <span className="text-6xl opacity-30">🍽️</span>
                    )}
                    {item.badge && <Badge className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs">{item.badge}</Badge>}
                    {item.popular && <Badge className="absolute top-3 left-3 bg-amber-500 text-white text-xs"><Star className="w-3 h-3 mr-1 fill-white" /> Populaire</Badge>}
                  </div>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2"><h3 className="text-lg font-bold text-gray-900">{item.name}</h3><span className="text-lg font-extrabold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">{formatPrice(item.price)}</span></div>
                    <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>
                    <a href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Bonjour, je souhaite commander: ${item.name} - ${formatPrice(item.price)}`)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"><MessageCircle className="w-3.5 h-3.5" /> Commander</a>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
