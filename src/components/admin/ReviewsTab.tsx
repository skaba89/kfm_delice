"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2 } from "lucide-react";
import type { ReviewDB, Stats } from "@/lib/types";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";
import { notify } from "@/lib/notifications";

export interface ReviewsTabProps {
  reviews: ReviewDB[];
  stats: Stats;
  apiDelete: (url: string, body: object) => Promise<void>;
  deleteConfirm: string | null;
  setDeleteConfirm: (v: string | null) => void;
}

export function ReviewsTab({ reviews, stats, apiDelete, deleteConfirm, setDeleteConfirm }: ReviewsTabProps) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems, itemsPerPage } = usePagination(reviews, 10);

  const handleDelete = async (r: ReviewDB) => {
    await apiDelete("/api/reviews", { id: r.id });
    setDeleteConfirm(null);
    notify.warning(`Avis de ${r.customerName} supprimé`);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="text-center">
            <p className="text-5xl font-extrabold">{stats.avgRating}</p>
            <div className="flex gap-0.5 mt-1 justify-center">
              {[1,2,3,4,5].map(i => <Star key={i} className={`w-5 h-5 ${i <= Math.round(stats.avgRating) ? "fill-white text-white" : "fill-white/30 text-white/30"}`} />)}
            </div>
            <p className="text-sm text-white/80 mt-1">{stats.totalReviews} avis</p>
          </div>
          <div className="flex-1 w-full space-y-1.5">
            {[5,4,3,2,1].map(star => {
              const count = reviews.filter(r => r.rating === star).length;
              const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-sm w-3">{star}</span><Star className="w-3 h-3 fill-white" />
                  <div className="flex-1 bg-white/20 rounded-full h-2"><div className="bg-white rounded-full h-2" style={{ width: `${pct}%` }} /></div>
                  <span className="text-xs w-6">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {paginatedItems.map((r) => (
          <Card key={r.id} className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-sm font-bold text-orange-600 dark:text-orange-400">{r.customerName[0]}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.customerName}</p>
                    <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200 dark:fill-gray-600 dark:text-gray-600"}`} />)}</div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{r.comment}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{r.date}</p>
                </div>
                <div>
                  {deleteConfirm === r.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(r)} className="text-[10px] px-1.5 py-0.5 bg-red-500 text-white rounded">Oui</button>
                      <button onClick={() => setDeleteConfirm(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">Non</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(r.id)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {reviews.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Aucun avis pour le moment</p>}
      </div>
      <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} label="avis" />
    </div>
  );
}
