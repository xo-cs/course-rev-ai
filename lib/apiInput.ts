// Small input sanitizers for API routes (no external validation library needed).
import type { Profile, Review } from "./types";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null;

export function cleanProfile(v: unknown): Profile & { remainingCredits: number | null } {
  const p = (v ?? {}) as Record<string, unknown>;
  return {
    name: str(p.name, 60) || null,
    program: str(p.program, 80) || null,
    year: num(p.year, 1, 6),
    remainingCredits: num(p.remainingCredits, 0, 300),
  };
}

/** User-written reviews from localStorage (untrusted). */
export function cleanReviews(v: unknown, limit = 40): Review[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, limit).map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const reviewer = (r.reviewer ?? {}) as Record<string, unknown>;
    return {
      id: str(r.id, 60) || `user_${i}`,
      courseId: str(r.courseId, 200),
      reviewer: { name: str(reviewer.name, 60) || null, year: num(reviewer.year, 1, 6), program: str(reviewer.program, 80) || null },
      anonymous: Boolean(r.anonymous),
      professor: str(r.professor, 80) || "Not sure",
      section: str(r.section, 10) || undefined,
      semester: str(r.semester, 20),
      rating: num(r.rating, 1, 5) ?? 3,
      difficulty: num(r.difficulty, 1, 5) ?? 3,
      workload: num(r.workload, 1, 5) ?? 3,
      wouldRecommend: Boolean(r.wouldRecommend),
      tags: Array.isArray(r.tags) ? r.tags.slice(0, 8).map((t) => str(t, 30)).filter(Boolean) : [],
      text: str(r.text, 1500),
      createdAt: str(r.createdAt, 10),
      moderation: r.moderation === "hidden" ? "hidden" : r.moderation === "pending" ? "pending" : "ok",
    } satisfies Review;
  });
}

export { str, num };
