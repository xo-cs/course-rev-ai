// "Plan my semester": plans are built here, in code (never by the model).
// Pure functions; runs on the server with the full catalog.
import { courses, seedReviews } from "./catalog";
import { typeGroup } from "./courseUtils";
import { categoryFor, remainingOf, type CreditCategory } from "./credits";
import { clashesWith, type Scheduled } from "./schedule";
import { totalsByCourse } from "./stats";
import type { Course, Day, Section } from "./types";

export type PlanStyle = "light" | "balanced" | "challenging";
export interface PlanPrefs {
  credits: number;
  dayOff: "none" | "Mon" | "Fri";
  style: PlanStyle;
}
export interface PlannerInput {
  program: string | null;
  year: number | null;
  prefs: PlanPrefs;
  exclude: string[]; // course ids already planned or taken
  credits?: CreditCategory[] | null;
}
export interface PlanItem {
  courseId: string;
  name: string;
  section: string;
  professor: string;
  room: string;
  scheduleText: string;
  slots: Section["slots"];
  credits: number;
  quality: number | null;
  workload: number | null;
}
export interface Plan {
  id: string;
  items: PlanItem[];
  credits: number;
  quality: number | null;
  workload: number | null;
  days: Day[];
  tradeoff: string;
}
export type PlanResult = { ok: true; plans: Plan[] } | { ok: false; message: string };

const totals = totalsByCourse(seedReviews);
const DAY_ORDER: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function sectionAllowed(s: Section, year: number | null, dayOff: PlanPrefs["dayOff"]) {
  if (!s.slots.length) return false; // TBA can't be checked for clashes
  if (dayOff !== "none" && s.slots.some((x) => x.day === dayOff)) return false;
  const r = s.remark.toLowerCase();
  if (/freshman/.test(r) && year !== 1) return false;
  if (/korean (only|section|level|2025)|korean student only/.test(r)) return false; // assume international student
  if (/sica only|track|only the students who registered|application/.test(r)) return false;
  return true;
}

interface Cand {
  course: Course;
  section: Section;
  credits: number;
  q: number | null;
  w: number | null;
  score: number;
}

export function buildPlans(input: PlannerInput): PlanResult {
  const { prefs, program, year } = input;
  const exclude = new Set(input.exclude);
  const cats = input.credits ?? [];
  const eligibleCourse = (c: Course) =>
    !exclude.has(c.id) &&
    !c.track &&
    c.credits != null &&
    c.credits > 0 &&
    ((program && c.program === program && (!year || !c.target_years.length || c.target_years.includes(year))) || /general education/i.test(c.program));

  const cands: Cand[] = [];
  for (const c of courses.filter(eligibleCourse)) {
    const t = totals[c.id];
    const q = t?.n ? t.q / t.n : null;
    const w = t?.n ? t.w / t.n : null;
    const d = t?.n ? t.d / t.n : null;
    let score = (q ?? 3) * 1.0;
    const wl = w ?? 3;
    if (prefs.style === "light") score -= (wl - 2) * 0.6;
    else if (prefs.style === "balanced") score -= Math.abs(wl - 3) * 0.4;
    else score += ((d ?? 3) - 3) * 0.4;
    if (cats.length) {
      const idx = categoryFor(typeGroup(c.type), cats);
      if (idx >= 0 && remainingOf(cats[idx]) > 0) score += 0.8;
    }
    if (program && c.program === program) score += 0.3; // major courses first
    for (const s of c.sections.filter((s) => sectionAllowed(s, year, prefs.dayOff))) cands.push({ course: c, section: s, credits: c.credits!, q, w, score });
  }
  cands.sort((a, b) => b.score - a.score);

  // Greedy fill to the target, skipping clashes. Different seeds give distinct plans.
  const fill = (banned: Set<string>) => {
    const chosen: Cand[] = [];
    let total = 0;
    for (const c of cands) {
      if (total >= prefs.credits) break;
      if (banned.has(c.course.id) || chosen.some((x) => x.course.id === c.course.id)) continue;
      if (total + c.credits > prefs.credits) continue;
      const sched: Scheduled[] = chosen.map((x) => ({ courseId: x.course.id, name: x.course.name, section: x.section.section, slots: x.section.slots }));
      if (clashesWith({ courseId: c.course.id, name: c.course.name, section: c.section.section, slots: c.section.slots }, sched).length) continue;
      chosen.push(c);
      total += c.credits;
    }
    return { chosen, total };
  };

  const plans: Plan[] = [];
  const seen = new Set<string>();
  const first = fill(new Set());
  const tries: Set<string>[] = [new Set()];
  // Alternatives: ban one or two of plan A's courses at a time.
  first.chosen.forEach((c, i) => {
    tries.push(new Set([c.course.id]));
    if (i > 0) tries.push(new Set([c.course.id, first.chosen[0].course.id]));
  });
  for (const banned of tries) {
    if (plans.length >= 3) break;
    const { chosen, total } = banned.size ? fill(banned) : first;
    if (total < prefs.credits) continue;
    const key = chosen.map((c) => c.course.id).sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    plans.push(toPlan(chosen, total, plans.length));
  }

  if (!plans.length) {
    const best = first.total;
    const tip =
      prefs.dayOff !== "none"
        ? `try without the free ${prefs.dayOff === "Mon" ? "Monday" : "Friday"}`
        : prefs.credits >= 18
          ? `try ${prefs.credits - 3} credits`
          : prefs.style !== "balanced"
            ? `try the balanced style`
            : `set your major and year in your profile, or try fewer credits`;
    return {
      ok: false,
      message: `I couldn't build a clash-free plan with exactly ${prefs.credits} credits (the best I found had ${best}). To get a plan, ${tip}.`,
    };
  }
  addTradeoffs(plans);
  return { ok: true, plans };
}

function toPlan(chosen: Cand[], total: number, i: number): Plan {
  const items: PlanItem[] = chosen.map((c) => ({
    courseId: c.course.id,
    name: c.course.name,
    section: c.section.section,
    professor: c.section.professor,
    room: c.section.room,
    scheduleText: c.section.schedule_text,
    slots: c.section.slots,
    credits: c.credits,
    quality: c.q,
    workload: c.w,
  }));
  const avg = (k: "quality" | "workload") => {
    const v = items.map((x) => x[k]).filter((x): x is number => x != null);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  };
  const days = DAY_ORDER.filter((d) => items.some((x) => x.slots.some((s) => s.day === d)));
  return { id: "ABC"[i], items, credits: total, quality: avg("quality"), workload: avg("workload"), days, tradeoff: "" };
}

/** One-line tradeoff per plan, computed from the numbers (no model involved). */
function addTradeoffs(plans: Plan[]) {
  const best = (k: "quality" | "workload", dir: 1 | -1) =>
    plans.reduce((a, b) => (((b[k] ?? 0) - (a[k] ?? 0)) * dir > 0 ? b : a), plans[0]).id;
  const topQ = best("quality", 1);
  const lightest = best("workload", -1);
  const fewestDays = plans.reduce((a, b) => (b.days.length < a.days.length ? b : a), plans[0]).id;
  for (const p of plans) {
    const parts: string[] = [];
    if (p.id === topQ) parts.push("highest rated courses");
    if (p.id === lightest) parts.push("lightest workload");
    if (p.id === fewestDays) parts.push(`only ${p.days.length} days on campus`);
    if (!parts.length) parts.push("a mix of the others");
    const cost =
      p.id !== lightest && (p.workload ?? 0) >= 3.5 ? ", but heavier weekly work" : p.id !== topQ && plans.length > 1 ? ", slightly lower ratings" : "";
    p.tradeoff = `${parts.join(", ").replace(/^./, (c) => c.toUpperCase())}${cost}.`;
  }
}
