// Builds Broddy's system prompt from the catalog, reviews and the student's state.
// Server only. The model never computes clashes: they are precomputed with lib/schedule.ts.
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { courses, getCourse, getSeedReviews, seedReviews } from "./catalog";
import { formatYears } from "./courseUtils";
import { publicReview, reviewerMeta, takenLine } from "./reviewDisplay";
import { clashesWith, describeClash, findAllClashes, type Scheduled } from "./schedule";
import { addReview, emptyTotals, totalsByCourse } from "./stats";
import type { Course, Profile, Review, StatTotals } from "./types";

let notesCache: string | null = null;
function registrationNotes() {
  if (notesCache == null) {
    try {
      notesCache = readFileSync(path.join(process.cwd(), "data", "registration_notes.md"), "utf8");
    } catch {
      notesCache = "(registration notes unavailable)";
    }
  }
  return notesCache;
}

export interface ChatContextInput {
  profile: Profile & { remainingCredits?: number | null };
  page: "reviews" | "course" | "courses" | "calendar" | "other";
  courseId?: string | null;
  myCourses: { courseId: string; section: string }[];
  /** Reviews written in this browser (relevant courses only). */
  userReviews: Review[];
  latestMessage: string;
}

const seedTotals = totalsByCourse(seedReviews);

function totalsWith(userReviews: Review[]) {
  const out: Record<string, StatTotals> = { ...seedTotals };
  for (const r of userReviews) out[r.courseId] = addReview(out[r.courseId] ?? emptyTotals(), r);
  return out;
}

const f1 = (sum: number, n: number) => (n ? (sum / n).toFixed(1) : "-");

function sectionLine(c: Course) {
  return c.sections
    .map((s) => `${s.section} ${s.slots.length ? s.slots.map((x) => `${x.day} ${x.start}-${x.end}`).join("+") : "TBA"}${s.remark ? ` [${s.remark}]` : ""}`)
    .join("; ");
}

function catalogLine(c: Course, t?: StatTotals) {
  const stats = t?.n ? `Q${f1(t.q, t.n)} D${f1(t.d, t.n)} W${f1(t.w, t.n)} n${t.n}` : "no reviews";
  return [
    c.id,
    c.name,
    c.program,
    c.track ? `TRACK:${c.track}` : null,
    formatYears(c.target_years),
    c.credits == null ? "credits ?" : `${c.credits}cr`,
    c.type || "type ?",
    c.taught_in_korean ? "taught in Korean" : null,
    stats,
    `sections: ${sectionLine(c)}`,
  ]
    .filter(Boolean)
    .join(" | ");
}

/** Courses whose names appear in the student's latest message (for precomputed clash checks). */
function mentionedCourses(text: string) {
  const t = text.toLowerCase();
  return courses.filter((c) => c.name.length >= 4 && t.includes(c.name.toLowerCase())).slice(0, 6);
}

export function buildSystemPrompt(input: ChatContextInput) {
  const totals = totalsWith(input.userReviews);
  const p = input.profile;

  // Catalog, the student's program and GE first.
  const isGE = (c: Course) => /general education/i.test(c.program);
  const ordered = [...courses].sort((a, b) => {
    const rank = (c: Course) => (p.program && c.program === p.program ? 0 : isGE(c) ? 1 : 2);
    return rank(a) - rank(b);
  });

  // My Courses + clash report.
  const mine: (Scheduled & { credits: number | null })[] = [];
  for (const m of input.myCourses) {
    const c = getCourse(m.courseId);
    const s = c?.sections.find((x) => x.section === m.section);
    if (c && s) mine.push({ courseId: c.id, name: c.name, section: s.section, slots: s.slots, credits: c.credits });
  }
  const clashes = findAllClashes(mine);
  const totalCredits = mine.reduce((s, c) => s + (c.credits ?? 0), 0);

  // Precomputed clash checks for the attached course and courses named in the message.
  const toCheck = new Map<string, Course>();
  if (input.courseId) {
    const c = getCourse(input.courseId);
    if (c) toCheck.set(c.id, c);
  }
  for (const c of mentionedCourses(input.latestMessage)) toCheck.set(c.id, c);
  const checks = [...toCheck.values()].map((c) => {
    const lines = c.sections.map((s) => {
      const cl = clashesWith({ courseId: c.id, name: c.name, section: s.section, slots: s.slots }, mine);
      const inPlan = mine.some((m) => m.courseId === c.id && m.section === s.section);
      return `  - ${c.id} section ${s.section} (${s.schedule_text || "TBA"}): ${
        inPlan ? "ALREADY IN MY COURSES" : cl.length ? `CLASHES with ${cl.map((x) => describeClash(x)).join("; ")}` : "no clash"
      }${s.remark ? ` | remark: ${s.remark}` : ""}`;
    });
    return `${c.name} [${c.id}]:\n${lines.join("\n")}`;
  });

  // Attached course: full details + all reviews.
  let attached = "None.";
  if (input.courseId) {
    const c = getCourse(input.courseId);
    if (c) {
      const reviews = [
        ...input.userReviews.filter((r) => r.courseId === c.id && r.moderation !== "hidden").map(publicReview),
        ...getSeedReviews(c.id),
      ];
      const t = totals[c.id];
      attached = [
        `id: ${c.id}`,
        `name: ${c.name}${c.name_original && c.name_original !== c.name ? ` (${c.name_original})` : ""}`,
        `program: ${c.program}; department: ${c.department}; type: ${c.type}; mode: ${c.mode}; credits: ${c.credits ?? "unknown"}; target: ${formatYears(c.target_years)}`,
        c.track ? `track offering: only for students registered in ${c.track}` : null,
        c.taught_in_korean ? "taught in Korean" : null,
        `professors: ${c.professors.join(", ") || "TBA"}`,
        `sections:\n${c.sections.map((s) => `  - ${s.section}: ${s.professor || "TBA"}, room ${s.room || "TBA"}, ${s.schedule_text || "Schedule TBA"}${s.remark ? `, REMARK: ${s.remark}` : ""}`).join("\n")}`,
        t?.n
          ? `review stats: quality ${f1(t.q, t.n)}/5, difficulty ${f1(t.d, t.n)}/5, workload ${f1(t.w, t.n)}/5, ${t.n} reviews, would take again ${Math.round(
              (100 * reviews.filter((r) => r.wouldRecommend).length) / Math.max(1, reviews.length),
            )}%`
          : "review stats: no reviews yet",
        `reviews (some are sample reviews written for the demo):\n${reviews
          .map(
            (r) =>
              `  - Q${r.rating} D${r.difficulty} W${r.workload} take again: ${r.wouldRecommend ? "yes" : "no"} | ${reviewerMeta(r) || "student"} | ${takenLine(r)} | tags: ${r.tags.join(", ") || "-"} | "${r.text}"`,
          )
          .join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  const profileText = [
    `name: ${p.name || "not given"}`,
    `program/major: ${p.program || "not set"}`,
    `year: ${p.year ?? "not set"}`,
    p.remainingCredits != null ? `remaining credits to graduate: ${p.remainingCredits}` : "graduation progress: not uploaded",
  ].join("; ");

  const page = { reviews: "the course reviews list", course: "a course page", courses: "their My Courses plan", calendar: "their weekly calendar", other: "the app" }[input.page];

  return `You are Broddy, a friendly and concise AI course buddy for Woosong University students, inside the CourseRevAI app.

STYLE
- Write like a text conversation: short. 2 to 5 short paragraphs or a short list. Casual but accurate. Use **bold** sparingly and "- " bullet lists when listing.
- Reply in the student's language if they don't write in English.

GROUNDING (very important)
- Answer ONLY from the data below (catalog, reviews, registration notes, the student's plan). If something is not in the data (for example a graduation rule you were not given, or a course that is not in the catalog), say so plainly instead of guessing.
- Many reviews are sample reviews written for this demo. Base opinions on them anyway, but cite numbers ("4.2/5 from 6 reviews").
- Respect section remarks (e.g. "2025 Freshman ONLY", "International only", "Korean Section", track-only). If the student does not meet one, say so clearly.
- Never compute timetable clashes yourself. Use only the CLASH REPORT and PRECOMPUTED CLASH CHECKS below. If a section clashes, say which course and when, and suggest a non-clashing section of the same course if one exists.

COURSE MENTIONS AND ACTIONS (the app renders these)
- Whenever you mention a catalog course, write ONLY its token [[course-id]] instead of the name (the app shows it as a chip with the name). Example: "I'd look at [[ai-computer-vision]]", not "Computer Vision [[ai-computer-vision]]". Use the exact id from the catalog.
- To offer adding a section to My Courses, write [[add:course-id:section]], e.g. [[add:ai-operating-system:002]]. It shows an "Add to My Courses" button; nothing is added until the student clicks. Only offer real sections. Offer at most 3 add buttons per reply.
- Never invent ids. Never wrap tokens in code formatting.

"IS THIS COURSE GOOD FOR ME?" ANSWERS
1. What reviewers say: quality, difficulty, workload, teaching style, pros and cons (cite numbers).
2. Fit for this student: year, major, remaining credits, timetable (from the clash checks), and remarks.
3. A one-line verdict in bold.
If the profile is missing major or year, ask for it briefly (one line) and still give what you can.

THE STUDENT
- ${profileText}
- Currently viewing: ${page}

MY COURSES (current plan, ${mine.length} courses, ${totalCredits} credits)
${mine.length ? mine.map((m) => `- ${m.name} [${m.courseId}] section ${m.section}: ${m.slots.map((s) => `${s.day} ${s.start}-${s.end}`).join(", ") || "TBA"} (${m.credits ?? "?"} cr)`).join("\n") : "- (empty)"}

CLASH REPORT (computed by the app)
${clashes.length ? clashes.map((c) => `- ${c.a.name} (${c.a.section}) and ${c.b.name} (${c.b.section}) overlap on ${c.day} ${c.start}-${c.end}`).join("\n") : "- No clashes."}

PRECOMPUTED CLASH CHECKS (each section vs My Courses)
${checks.length ? checks.join("\n") : "- None requested."}

ATTACHED COURSE (the student is asking about this one)
${attached}

REGISTRATION NOTES (from the Spring 2025 'READ THIS' sheet; dates may have changed, say so when citing dates)
${registrationNotes()}

CATALOG (Spring 2025 timetable; one course per line: id | name | program | [track] | years | credits | type | [language] | review stats Q=quality D=difficulty W=workload n=count | sections with day/time and [remarks])
${ordered.map((c) => catalogLine(c, totals[c.id])).join("\n")}
`;
}
