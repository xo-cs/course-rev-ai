import type { Review, StatTotals } from "./types";

export const emptyTotals = (): StatTotals => ({ n: 0, q: 0, d: 0, w: 0 });

export function addReview(t: StatTotals, r: Pick<Review, "rating" | "difficulty" | "workload">): StatTotals {
  return { n: t.n + 1, q: t.q + r.rating, d: t.d + r.difficulty, w: t.w + r.workload };
}

export function totalsByCourse(reviews: Review[]): Record<string, StatTotals> {
  const out: Record<string, StatTotals> = {};
  for (const r of reviews) out[r.courseId] = addReview(out[r.courseId] ?? emptyTotals(), r);
  return out;
}

export function avg(sum: number, n: number) {
  return n ? sum / n : null;
}

/** 4.2 / "N/A" */
export function fmtAvg(v: number | null) {
  return v == null ? "N/A" : v.toFixed(1);
}
