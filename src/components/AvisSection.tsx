"use client";

import { useState, useEffect } from "react";
import { Star, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedSection } from "@/components/AnimatedSection";
import type { ReviewDB } from "@/lib/types";
import { publicApiFetch } from "@/lib/public-api";

export function AvisSection() {
  const [reviews, setReviews] = useState<ReviewDB[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { publicApiFetch("/api/reviews").then(r => r.json()).then(d => { const list = Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : []; setReviews(list); setLoading(false); }).catch(() => { setReviews([]); setLoading(false); }); }, []);
  return (
    <section id="avis" className="py-20 bg-gradient-to-br from-orange-50/50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <Badge className="bg-orange-100 text-orange-700 mb-4">Avis Clients</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">Ce Que Disent Nos <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">Clients</span></h2>
          <p className="text-gray-500 max-w-2xl mx-auto">Découvrez les témoignages de nos clients satisfaits</p>
        </AnimatedSection>
        {loading ? <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 text-orange-500 animate-spin" /></div> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.slice(0, 6).map((r) => (
              <AnimatedSection key={r.id}>
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-1 mb-3">
                      {[1,2,3,4,5].map(i => <Star key={i} className={`w-4 h-4 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} />)}
                    </div>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">&ldquo;{r.comment}&rdquo;</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center text-sm font-bold text-orange-600">{r.customerName[0]}</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{r.customerName}</p>
                        <p className="text-xs text-gray-500">{r.date}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
            {reviews.length === 0 && <p className="text-gray-500 text-center col-span-full py-8">Aucun avis pour le moment</p>}
          </div>
        )}
      </div>
    </section>
  );
}
