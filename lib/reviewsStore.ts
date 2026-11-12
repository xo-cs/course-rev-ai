"use client";

// User-written reviews, helpful votes and reports, stored in localStorage for the MVP.
// Keep the exported API small so it can be swapped for Supabase later.
import { useMemo } from "react";
import { createLocalStore } from "./localStore";
import { getUserId } from "./profileStore";
import { addReview, emptyTotals } from "./stats";
import type { ModerationStatus, Review, StatTotals } from "./types";

const userReviews = createLocalStore<Review[]>("crai.reviews.v2", []);
const helpful = createLocalStore<Record<string, number>>("crai.helpful.v1", {});
const helpfulMine = createLocalStore<Record<string, true>>("crai.helpful.mine.v1", {});
const reports = createLocalStore<Record<string, { count: number; reasons: string[] }>>("crai.reports.v1", {});
const reportedMine = createLocalStore<Record<string, string>>("crai.reports.mine.v1", {});
/** Admin hide/unhide (demo: per browser). */
const hiddenIds = createLocalStore<Record<string, true>>("crai.hidden.v1", {});

export type ReviewInput = Omit<Review, "id" | "createdAt" | "updatedAt" | "isSample" | "authorId">;

export const reviewsStore = {
  /** All reviews written in this browser (all courses). */
  useUserReviews: () => userReviews.useValue(),
  getUserReviews: () => userReviews.get(),

  /** The current user's review for a course (one per student per course). */
  mine(courseId: string, list = userReviews.get()) {
    const me = getUserId();
    return list.find((r) => r.courseId === courseId && r.authorId === me);
  },

  /** Create or update the current user's review for this course. */
  save(input: ReviewInput, moderation: ModerationStatus): Review {
    const me = getUserId();
    const today = new Date().toISOString().slice(0, 10);
    const existing = reviewsStore.mine(input.courseId);
    const review: Review = existing
      ? { ...existing, ...input, moderation, updatedAt: today }
      : {
          ...input,
          moderation,
          id: `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          authorId: me,
          createdAt: today,
          isSample: false,
        };
    userReviews.set((prev) => [review, ...prev.filter((r) => r.id !== review.id)]);
    return review;
  },

  remove(id: string) {
    userReviews.set((prev) => prev.filter((r) => r.id !== id));
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

  useReports: () => reports.useValue(),
  useReportedByMe: () => reportedMine.useValue(),
  report(reviewId: string, reason: string) {
    if (reportedMine.get()[reviewId]) return;
    reportedMine.set((m) => ({ ...m, [reviewId]: reason }));
    reports.set((r) => ({
      ...r,
      [reviewId]: { count: (r[reviewId]?.count ?? 0) + 1, reasons: [...(r[reviewId]?.reasons ?? []), reason] },
    }));
  },

  useHidden: () => hiddenIds.useValue(),
  setHidden(reviewId: string, hidden: boolean) {
    hiddenIds.set((h) => {
      const next = { ...h };
      if (hidden) next[reviewId] = true;
      else delete next[reviewId];
      return next;
    });
  },
};

/** Seed totals (computed on the server) merged with the user's local reviews. */
export function useMergedTotals(seed: Record<string, StatTotals>) {
  const mine = reviewsStore.useUserReviews();
  const hidden = reviewsStore.useHidden();
  return useMemo(() => {
    const visible = mine.filter((r) => !hidden[r.id]);
    if (!visible.length) return seed;
    const out = { ...seed };
    for (const r of visible) out[r.courseId] = addReview(out[r.courseId] ?? emptyTotals(), r);
    return out;
  }, [seed, mine, hidden]);
}
