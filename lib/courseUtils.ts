import type { Course, Day, TypeGroup } from "./types";

export const TYPE_GROUPS: TypeGroup[] = ["Basic", "Core", "Advanced", "Focus", "Track", "GE", "Major", "Other"];
export const WEEK_DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The raw `type` column has ~25 spellings ("Advance", "Focused", "Major(Core)"...). Group them. */
export function typeGroup(type: string): TypeGroup {
  const t = (type || "").toLowerCase();
  if (t.includes("focus")) return "Focus";
  if (/^ge|교필/.test(t)) return "GE";
  if (t.includes("basic")) return "Basic";
  if (t.includes("core")) return "Core";
  if (t.includes("advance")) return "Advanced";
  if (t.includes("track")) return "Track";
  if (t.includes("major")) return "Major";
  return "Other";
}

export function courseHref(id: string) {
  return `/reviews/${encodeURIComponent(id)}`;
}

export function decodeId(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function formatYears(years: number[]) {
  if (!years.length) return "All years";
  if (years.length === 1) return `Year ${years[0]}`;
  const sorted = [...years].sort();
  const contiguous = sorted.every((y, i) => i === 0 || y === sorted[i - 1] + 1);
  return contiguous ? `Years ${sorted[0]}–${sorted[sorted.length - 1]}` : `Years ${sorted.join(", ")}`;
}

export function formatCredits(credits: number | null) {
  return credits == null ? "Credits TBA" : `${credits} credit${credits === 1 ? "" : "s"}`;
}

export function courseDays(course: Course): Day[] {
  const set = new Set<Day>();
  for (const s of course.sections) for (const slot of s.slots) set.add(slot.day);
  return WEEK_DAYS.filter((d) => set.has(d));
}
