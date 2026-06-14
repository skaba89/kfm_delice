"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Star, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { RestaurantDB, ReviewDB } from "@/lib/types";

interface Props {
  restaurant: RestaurantDB;
}

export function AvisSectionDynamic({ restaurant }: Props) {
  const [reviews, setReviews] = useState<ReviewDB[]>([]);
  const [loading, setLoading] = useState(true);
  const primaryColor = restaurant.primaryColor || "#ea580c";

  useEffect(() => {
    const slug = restaurant.slug;
    const url = slug ? `/api/reviews?slug=${encodeURIComponent(slug)}&limit=6` : "/api/reviews?limit=6";
    fetch(url)
      .then(r => r.json())
      .then(d => setReviews(Array.isArray(d) ? d : (d.data || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurant.slug]);

  return (
    <section className="py-16 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Avis de nos clients</h2>
          <div className="flex items-center justify-center gap-2">
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            <span className="font-bold text-gray-900 dark:text-white">{restaurant.rating}/5</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><RefreshCw className="w-8 h-8 animate-spin" style={{ color: primaryColor }} /></div>
        ) : reviews.length === 0 ? (
          <p className="text-center text-gray-500">Aucun avis pour le moment</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.slice(0, 6).map((review, i) => (
              <motion.div key={review.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="dark:bg-gray-800 dark:border-gray-700 h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: primaryColor }}>
                        {review.customerName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{review.customerName}</p>
                        <div className="flex">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />)}</div>
                      </div>
                    </div>
                    {review.comment && <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">{review.comment}</p>}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
