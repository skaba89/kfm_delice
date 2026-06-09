"use client";

import { MessageSquare, PenSquare, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewDB } from "@/lib/types";
import { usePagination } from "@/lib/use-pagination";
import { Pagination } from "@/components/Pagination";

interface CustomerReviewsProps {
  reviews: ReviewDB[];
  reviewForm: { rating: number; comment: string };
  setReviewForm: (form: { rating: number; comment: string }) => void;
  reviewSaving: boolean;
  reviewMsg: string;
  submitReview: () => void;
}

export function CustomerReviews({
  reviews,
  reviewForm,
  setReviewForm,
  reviewSaving,
  reviewMsg,
  submitReview,
}: CustomerReviewsProps) {
  const reviewsPagination = usePagination(reviews, 5);

  return (
    <div className="space-y-6">
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><PenSquare className="w-5 h-5 text-emerald-500" /> Écrire un avis</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Note</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={() => setReviewForm({ ...reviewForm, rating: i })} className="p-1">
                    <Star className={`w-6 h-6 ${i <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200 dark:fill-gray-600 dark:text-gray-600"} transition-colors`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Commentaire</label>
              <Textarea value={reviewForm.comment} onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })} placeholder="Partagez votre expérience..." rows={3} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            </div>
            <Button onClick={submitReview} disabled={reviewSaving || !reviewForm.comment} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white">
              {reviewSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />} Publier l&apos;avis
            </Button>
            {reviewMsg && <p className={`text-sm ${reviewMsg.includes("succès") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{reviewMsg}</p>}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <Card className="dark:bg-gray-800 dark:border-gray-700"><CardContent className="p-8 text-center"><MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" /><p className="text-gray-500 dark:text-gray-400">Aucun avis publié</p></CardContent></Card>
        ) : (
          reviewsPagination.paginatedItems.map((r) => (
            <Card key={r.id} className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-1 mb-2">{[1,2,3,4,5].map(i => <Star key={i} className={`w-4 h-4 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200 dark:fill-gray-600 dark:text-gray-600"}`} />)}</div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">&ldquo;{r.comment}&rdquo;</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{r.date}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <Pagination currentPage={reviewsPagination.currentPage} totalPages={reviewsPagination.totalPages} totalItems={reviewsPagination.totalItems} itemsPerPage={reviewsPagination.itemsPerPage} onPageChange={reviewsPagination.setCurrentPage} label="avis" />
    </div>
  );
}
