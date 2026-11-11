// Shared schedule / clash logic. Used by Add buttons, My Courses, Calendar and Broddy.
// Pure functions only (safe on server and client).
import type { Day, Slot } from "./types";

export interface Scheduled {
  courseId: string;
  name: string;
  section: string;
  slots: Slot[];
}

export interface Clash {
  a: { courseId: string; name: string; section: string };
  b: { courseId: string; name: string; section: string };
  day: Day;
  start: string; // overlap start
  end: string; // overlap end
}

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function fromMinutes(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Overlap of two slots, or null. Touching end/start (12:00 & 12:00) is not a clash. */
export function slotOverlap(x: Slot, y: Slot): { start: string; end: string } | null {
  if (x.day !== y.day) return null;
  const start = Math.max(toMinutes(x.start), toMinutes(y.start));
  const end = Math.min(toMinutes(x.end), toMinutes(y.end));
  return start < end ? { start: fromMinutes(start), end: fromMinutes(end) } : null;
}

const ref = (s: Scheduled) => ({ courseId: s.courseId, name: s.name, section: s.section });

/** Clashes between one candidate section and a list (entries of the same course are ignored). */
export function clashesWith(candidate: Scheduled, others: Scheduled[]): Clash[] {
  const out: Clash[] = [];
  for (const o of others) {
    if (o.courseId === candidate.courseId) continue;
    for (const x of candidate.slots)
      for (const y of o.slots) {
        const ov = slotOverlap(x, y);
        if (ov) out.push({ a: ref(candidate), b: ref(o), day: x.day, ...ov });
      }
  }
  return out;
}

/** Every clash inside a list (each pair reported once). */
export function findAllClashes(list: Scheduled[]): Clash[] {
  const out: Clash[] = [];
  for (let i = 0; i < list.length; i++) out.push(...clashesWith(list[i], list.slice(i + 1)));
  return out;
}

export function describeClash(c: Clash, from: "a" | "b" = "b") {
  const other = from === "b" ? c.b : c.a;
  return `${other.name} (${other.section}) on ${c.day} ${c.start}–${c.end}`;
}
