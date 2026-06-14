"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, ShoppingCart, ShoppingBag, ChevronRight, RefreshCw, Star, Search, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useRestaurant } from "@/lib/restaurant-context";
import { formatPrice } from "@/lib/constants";
import type { RestaurantDB, MenuItemDB } from "@/lib/types";

interface Props {
  restaurant: RestaurantDB;
  slug: string | null;
}

export function MenuSectionDynamic({ restaurant, slug }: Props) {
  const [menuItems, setMenuItems] = useState<MenuItemDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const url = slug ? `/api/menu?slug=${encodeURIComponent(slug)}&limit=1000` : "/api/menu?limit=1000";
    fetch(url)
      .then(r => r.json())
      .then(d => {
        const items = Array.isArray(d) ? d : (d.data || []);
        setMenuItems(items);
        if (items.length > 0 && !activeCat) {
          setActiveCat(items[0].category);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  // Extract unique categories from menu items
  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map(i => i.category))];
    return cats.map(c => ({ id: c, name: c.charAt(0).toUpperCase() + c.slice(1) }));
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    return menuItems.filter(i => i.category === activeCat && i.available)
      .filter(i => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q);
      });
  }, [menuItems, activeCat, searchQuery]);

  const rPath = slug ? `/r/${slug}` : "";
  const primaryColor = restaurant.primaryColor || "#ea580c";
  const currency = restaurant.currency || "GNF";

  const formatPriceLocal = (p: number) => p.toLocaleString("fr-FR") + " " + currency;

  return (
    <section className="py-16 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Notre Menu</h2>
          <p className="text-gray-500 dark:text-gray-400">Découvrez nos saveurs authentiques</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Category sidebar */}
            <aside className="hidden lg:block w-48 shrink-0">
              <div className="sticky top-24 space-y-1">
                {categories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                      activeCat === c.id
                        ? "text-white shadow-lg"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    style={activeCat === c.id ? { backgroundColor: primaryColor } : undefined}
                  >
                    {c.name}
                    <span className={`ml-auto text-xs ${activeCat === c.id ? "text-white/70" : "text-gray-400"}`}>
                      {menuItems.filter(i => i.category === c.id && i.available).length}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            {/* Mobile category scroll */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 mb-4">
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all shrink-0 ${
                    activeCat === c.id
                      ? "text-white shadow-lg"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                  }`}
                  style={activeCat === c.id ? { backgroundColor: primaryColor } : undefined}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Items grid */}
            <div className="flex-1 min-w-0">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher un plat..." className="pl-9 bg-white dark:bg-gray-800" />
              </div>

              {filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Aucun article dans cette catégorie</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredItems.map((item, idx) => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}>
                      <Card className="overflow-hidden hover:shadow-lg transition-all group dark:bg-gray-800 dark:border-gray-700">
                        <div className="h-40 overflow-hidden relative">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}22, ${primaryColor}11)` }}>
                              <UtensilsCrossed className="w-8 h-8" style={{ color: `${primaryColor}66` }} />
                            </div>
                          )}
                          {item.badge && (
                            <Badge className="absolute top-2 right-2 text-white text-[10px]" style={{ background: `linear-gradient(to right, ${primaryColor}, ${restaurant.secondaryColor || primaryColor})` }}>
                              {item.badge}
                            </Badge>
                          )}
                          {item.popular && (
                            <Badge className="absolute top-2 left-2 bg-amber-500 text-white text-[10px]">
                              <Star className="w-3 h-3 mr-0.5 fill-white" /> Populaire
                            </Badge>
                          )}
                        </div>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight flex-1 min-w-0 mr-2">{item.name}</h3>
                            <span className="text-sm font-extrabold whitespace-nowrap" style={{ color: primaryColor }}>
                              {formatPriceLocal(item.price)}
                            </span>
                          </div>
                          {item.description && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{item.description}</p>}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-center mt-8">
          <Button asChild size="lg" className="rounded-xl px-8 shadow-lg text-white" style={{ backgroundColor: primaryColor }}>
            <a href={`${rPath}/menu`}>
              <ShoppingCart className="w-5 h-5 mr-2" /> Voir le menu complet & Commander
              <ChevronRight className="w-4 h-4 ml-1" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
