"use client";

// User-written reviews + "helpful" counts, stored in localStorage for the MVP.
// Keep the exported API small so it can be swapped for Supabase later.
import { useMemo } from "react";
import { createLocalStore } from "./localStore";
import { addReview, emptyTotals } from "./stats";
import type { Review, StatTotals } from "./types";

const userReviews = createLocalStore<Review[]>("crai.reviews.v1", []);
const helpful = createLocalStore<Record<string, number>>("crai.helpful.v1", {});
const helpfulMine = createLocalStore<Record<string, true>>("crai.helpful.mine.v1", {});

export const reviewsStore = {
  /** All reviews the user has written (all courses). */
  useUserReviews: () => userReviews.useValue(),
  getUserReviews: () => userReviews.get(),

  add(input: Omit<Review, "id" | "createdAt" | "isSample">): Review {
    const review: Review = {
      ...input,
      id: `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString().slice(0, 10),
      isSample: false,
    };
    userReviews.set((prev) => [review, ...prev]);
    return review;
  },

  useHelpfulCounts: () => helpful.useValue(),
  useMarkedHelpful: () => helpfulMine.useValue(),
  toggleHelpful(reviewId: string) {
    const marked = Boolean(helpfulMine.get()[reviewId]);
    helpfulMine.set((m) => {
      const next = { ...m };
      if (marked) delete next[reviewId];
      else next[reviewId] = true;
      return next;
    });
    helpful.set((c) => ({ ...c, [reviewId]: Math.max(0, (c[reviewId] ?? 0) + (marked ? -1 : 1)) }));
  },
};

/** Seed totals (computed on the server) merged with the user's local reviews. */
export function useMergedTotals(seed: Record<string, StatTotals>) {
  const mine = reviewsStore.useUserReviews();
  return useMemo(() => {
    if (!mine.length) return seed;
    const out = { ...seed };
    for (const r of mine) out[r.courseId] = addReview(out[r.courseId] ?? emptyTotals(), r);
    return out;
  }, [seed, mine]);
}
