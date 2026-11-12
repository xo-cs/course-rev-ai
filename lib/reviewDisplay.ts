import type { Review } from "./types";

/**
 * What students may see. Anonymous reviews lose the reviewer's name here, on the server,
 * so it never reaches the browser. Admin views use the full review instead.
 */
export function publicReview(r: Review): Review {
  return r.anonymous ? { ...r, reviewer: { ...r.reviewer, name: null } } : r;
}

export function isVisibleToStudents(r: Review) {
  return r.moderation !== "hidden";
}

export function reviewerLabel(r: Review) {
  return r.anonymous || !r.reviewer.name ? "Anonymous student" : r.reviewer.name;
}

/** "Year 3 · AI & Big Data" */
export function reviewerMeta(r: Pick<Review, "reviewer">) {
  return [r.reviewer.year ? `Year ${r.reviewer.year}` : null, r.reviewer.program].filter(Boolean).join(" · ");
}

/** "Saurabh Singh" from "조일형(TBD)" style values; null when unknown. */
export function cleanProfessor(p: string) {
  const name = p.replace(/\(.*?\)/g, "").trim();
  return !name || /^(tba|tbd|not sure)$/i.test(name) ? null : name;
}

/** "Took it with Prof. Saurabh Singh · Section 002 · 2024 Fall" */
export function takenLine(r: Review) {
  const prof = cleanProfessor(r.professor);
  return [prof ? `Took it with Prof. ${prof}` : "Took it", r.section ? `Section ${r.section}` : null, r.semester]
    .filter(Boolean)
    .join(" · ");
}

export function initials(name: string) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
