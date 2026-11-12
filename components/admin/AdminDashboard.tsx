"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { IconChevronDown } from "@/components/ui/Icons";
import { courseHref, TYPE_GROUPS } from "@/lib/courseUtils";
import { cleanProfessor } from "@/lib/reviewDisplay";
import { reviewsStore } from "@/lib/reviewsStore";
import { NEGATIVE_TAGS, POSITIVE_TAGS } from "@/lib/tags";
import type { Review, TypeGroup } from "@/lib/types";
import { AiInsights } from "./AiInsights";
import { ReviewsTable } from "./ReviewsTable";

export interface AdminCourse {
  id: string;
  name: string;
  program: string;
  years: number[];
  typeGroup: TypeGroup;
  professors: string[];
}

interface Filters {
  program: string;
  year: string;
  type: string;
  semester: string;
  includeSample: boolean;
}

export interface CourseStat {
  id: string;
  name: string;
  program: string;
  n: number;
  q: number;
  d: number;
  w: number;
  again: number;
  negTags: [string, number][];
  trend: number | null; // latest semester avg minus earlier avg
}

const INK = "#000000";
const GRAY = "#8a8a8a";
const LIGHT = "#d4d4d4";
const AXIS = { fontSize: 12, fill: "#404040" };
const TOOLTIP = { contentStyle: { border: "1px solid #000", borderRadius: 10, fontSize: 13 }, cursor: { fill: "rgba(0,0,0,0.05)" } };

const semKey = (s: string) => {
  const [y, t] = s.split(" ");
  return Number(y) * 10 + (t === "Fall" ? 2 : 1);
};
const r1 = (v: number) => Math.round(v * 10) / 10;

export function AdminDashboard({ courses, seedReviews, programs }: { courses: AdminCourse[]; seedReviews: Review[]; programs: string[] }) {
  const userReviews = reviewsStore.useUserReviews();
  const hidden = reviewsStore.useHidden();
  const reports = reviewsStore.useReports();
  const [tab, setTab] = useState<"overview" | "reviews">("overview");
  const [f, setF] = useState<Filters>({ program: "", year: "", type: "", semester: "", includeSample: true });
  const set = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }));

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const allReviews = useMemo(() => [...userReviews, ...seedReviews], [userReviews, seedReviews]);
  const semesters = useMemo(() => [...new Set(allReviews.map((r) => r.semester))].sort((a, b) => semKey(a) - semKey(b)), [allReviews]);

  // Courses matching the course filters.
  const courseSet = useMemo(
    () =>
      courses.filter(
        (c) =>
          (!f.program || c.program === f.program) &&
          (!f.year || c.years.length === 0 || c.years.includes(Number(f.year))) &&
          (!f.type || c.typeGroup === f.type),
      ),
    [courses, f.program, f.year, f.type],
  );
  const inSet = useMemo(() => new Set(courseSet.map((c) => c.id)), [courseSet]);

  // Reviews in scope (all filters). Hidden reviews are excluded from statistics.
  const scoped = useMemo(
    () =>
      allReviews.filter(
        (r) => inSet.has(r.courseId) && (!f.semester || r.semester === f.semester) && (f.includeSample || !r.isSample),
      ),
    [allReviews, inSet, f.semester, f.includeSample],
  );
  const reviews = useMemo(() => scoped.filter((r) => !hidden[r.id] && r.moderation !== "hidden"), [scoped, hidden]);

  const stats = useMemo(() => {
    const byCourse = new Map<string, Review[]>();
    for (const r of reviews) byCourse.set(r.courseId, [...(byCourse.get(r.courseId) ?? []), r]);
    const perCourse: CourseStat[] = [];
    for (const [id, list] of byCourse) {
      const c = courseById.get(id);
      if (!c) continue;
      const n = list.length;
      const avgOf = (rs: Review[]) => rs.reduce((s, r) => s + r.rating, 0) / rs.length;
      const sems = [...new Set(list.map((r) => r.semester))].sort((a, b) => semKey(a) - semKey(b));
      const latest = sems[sems.length - 1];
      const recent = list.filter((r) => r.semester === latest);
      const earlier = list.filter((r) => r.semester !== latest);
      const neg = new Map<string, number>();
      for (const r of list) for (const t of r.tags) if (NEGATIVE_TAGS.includes(t)) neg.set(t, (neg.get(t) ?? 0) + 1);
      perCourse.push({
        id,
        name: c.name,
        program: c.program,
        n,
        q: avgOf(list),
        d: list.reduce((s, r) => s + r.difficulty, 0) / n,
        w: list.reduce((s, r) => s + r.workload, 0) / n,
        again: (100 * list.filter((r) => r.wouldRecommend).length) / n,
        negTags: [...neg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
        trend: recent.length && earlier.length ? avgOf(recent) - avgOf(earlier) : null,
      });
    }
    const n = reviews.length;
    const kpi = {
      total: n,
      quality: n ? reviews.reduce((s, r) => s + r.rating, 0) / n : null,
      difficulty: n ? reviews.reduce((s, r) => s + r.difficulty, 0) / n : null,
      again: n ? (100 * reviews.filter((r) => r.wouldRecommend).length) / n : null,
      noReviews: courseSet.filter((c) => !byCourse.has(c.id)).length,
      courses: courseSet.length,
    };

    // Histogram: courses per 0.5-wide quality range.
    const buckets = Array.from({ length: 8 }, (_, i) => ({ range: `${(1 + i * 0.5).toFixed(1)}–${(1.5 + i * 0.5 - (i === 7 ? 0 : 0.1)).toFixed(1)}`, courses: 0 }));
    for (const c of perCourse) buckets[Math.min(7, Math.floor((c.q - 1) / 0.5))].courses++;

    // Per program.
    const prog = new Map<string, { sum: number; n: number }>();
    for (const r of reviews) {
      const p = courseById.get(r.courseId)!.program;
      const v = prog.get(p) ?? { sum: 0, n: 0 };
      prog.set(p, { sum: v.sum + r.rating, n: v.n + 1 });
    }
    const byProgram = [...prog.entries()]
      .map(([program, v]) => ({ program, quality: r1(v.sum / v.n), reviews: v.n }))
      .sort((a, b) => b.quality - a.quality);

    // Per semester.
    const semCount = new Map<string, number>();
    for (const r of reviews) semCount.set(r.semester, (semCount.get(r.semester) ?? 0) + 1);
    const bySemester = [...semCount.entries()].sort((a, b) => semKey(a[0]) - semKey(b[0])).map(([semester, count]) => ({ semester, count }));

    // Tags.
    const tagCount = new Map<string, number>();
    for (const r of reviews) for (const t of r.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    const top = (list: string[], kind: "Positive" | "Negative") =>
      list
        .map((t) => ({ tag: t, count: tagCount.get(t) ?? 0, kind }))
        .filter((x) => x.count)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    const tags = [...top(POSITIVE_TAGS, "Positive"), ...top(NEGATIVE_TAGS, "Negative")];

    // Professors.
    const profs = new Map<string, { courses: Set<string>; sum: number; n: number }>();
    for (const r of reviews) {
      const name = cleanProfessor(r.professor);
      if (!name) continue;
      const v = profs.get(name) ?? { courses: new Set<string>(), sum: 0, n: 0 };
      v.courses.add(r.courseId);
      v.sum += r.rating;
      v.n++;
      profs.set(name, v);
    }
    const professors = [...profs.entries()]
      .map(([name, v]) => ({ name, courses: v.courses.size, quality: v.sum / v.n, reviews: v.n }))
      .sort((a, b) => b.reviews - a.reviews || b.quality - a.quality);

    const rated = perCourse.filter((c) => c.n >= 2);
    const lowest = [...rated].sort((a, b) => a.q - b.q).slice(0, 6);
    const dropping = rated.filter((c) => c.trend != null && c.trend <= -0.7);
    const attention = [...new Map([...lowest, ...dropping].map((c) => [c.id, c])).values()].sort((a, b) => a.q - b.q).slice(0, 8);
    const mean = kpi.quality ?? 3;
    const topRated = perCourse
      .filter((c) => c.n >= 3)
      .sort((a, b) => (b.q * b.n + 3 * mean) / (b.n + 3) - (a.q * a.n + 3 * mean) / (a.n + 3))
      .slice(0, 8);

    return { perCourse, kpi, buckets, byProgram, bySemester, tags, professors, attention, topRated };
  }, [reviews, courseById, courseSet]);

  const weakest = useMemo(
    () =>
      [...stats.perCourse]
        .filter((c) => c.n >= 2)
        .sort((a, b) => a.q - b.q)
        .slice(0, 5)
        .map((c) => ({
          course: c.name,
          program: c.program,
          quality: r1(c.q),
          reviews: reviews
            .filter((r) => r.courseId === c.id)
            .map((r) => ({ q: r.rating, d: r.difficulty, w: r.workload, takeAgain: r.wouldRecommend, tags: r.tags, text: r.text })),
        })),
    [stats.perCourse, reviews],
  );

  function exportCsv() {
    const rows = [["course_id", "course", "program", "reviews", "avg_quality", "avg_difficulty", "avg_workload", "would_take_again_pct"]];
    const byId = new Map(stats.perCourse.map((c) => [c.id, c]));
    for (const c of courseSet) {
      const s = byId.get(c.id);
      rows.push([c.id, c.name, c.program, String(s?.n ?? 0), s ? s.q.toFixed(2) : "", s ? s.d.toFixed(2) : "", s ? s.w.toFixed(2) : "", s ? s.again.toFixed(0) : ""]);
    }
    const csv = "﻿" + rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `courserevai-stats${f.program ? "-" + f.program.replace(/\W+/g, "-") : ""}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  const filterKey = JSON.stringify({ ...f, n: reviews.length });

  return (
    <main className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">How courses are doing</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Reviews written by users are stored per browser for this demo, so the dashboard shows sample reviews plus reviews from this browser.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportCsv} className="h-11 rounded-full border border-black px-4 text-sm font-semibold hover:bg-neutral-100">
            Export CSV
          </button>
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="h-11 rounded-full px-4 text-sm text-neutral-600 underline underline-offset-4 hover:text-black">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Filters (apply to every chart and table) */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Filters">
        <Select label="Program" value={f.program} onChange={(v) => set({ program: v })} className="col-span-2 sm:w-64">
          <option value="">All programs</option>
          {programs.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Select label="Target year" value={f.year} onChange={(v) => set({ year: v })} className="sm:w-36">
          <option value="">All years</option>
          {[1, 2, 3, 4].map((y) => (
            <option key={y} value={y}>
              Year {y}
            </option>
          ))}
        </Select>
        <Select label="Course type" value={f.type} onChange={(v) => set({ type: v })} className="sm:w-36">
          <option value="">All types</option>
          {TYPE_GROUPS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
        <Select label="Semester" value={f.semester} onChange={(v) => set({ semester: v })} className="sm:w-40">
          <option value="">All semesters</option>
          {semesters.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <button
          type="button"
          aria-pressed={f.includeSample}
          onClick={() => set({ includeSample: !f.includeSample })}
          className={`h-11 rounded-full border px-4 text-sm font-medium ${f.includeSample ? "border-black bg-black text-white" : "border-neutral-300"}`}
        >
          {f.includeSample ? "✓ " : ""}Include sample reviews
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-neutral-200" role="tablist">
        {(["overview", "reviews"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px h-11 border-b-2 px-4 text-[15px] font-semibold capitalize ${tab === t ? "border-black" : "border-transparent text-neutral-500 hover:text-black"}`}
          >
            {t === "reviews" ? `Reviews (${scoped.length})` : "Overview"}
          </button>
        ))}
      </div>

      {tab === "reviews" ? (
        <ReviewsTable reviews={scoped} courseById={courseById} hidden={hidden} reports={reports} />
      ) : (
        <div className="mt-6 space-y-6">
          {/* 1. KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Total reviews" value={String(stats.kpi.total)} />
            <Kpi label="Average quality" value={stats.kpi.quality == null ? "–" : stats.kpi.quality.toFixed(2)} sub="out of 5" solid />
            <Kpi label="Average difficulty" value={stats.kpi.difficulty == null ? "–" : stats.kpi.difficulty.toFixed(2)} sub="out of 5" />
            <Kpi label="Would take again" value={stats.kpi.again == null ? "–" : `${Math.round(stats.kpi.again)}%`} />
            <Kpi label="Courses with no reviews" value={String(stats.kpi.noReviews)} sub={`of ${stats.kpi.courses}`} />
          </div>

          <AiInsights filterKey={filterKey} stats={{ kpi: stats.kpi, byProgram: stats.byProgram, histogram: stats.buckets, tags: stats.tags, bySemester: stats.bySemester }} weak={weakest} />

          <div className="grid gap-6 lg:grid-cols-2">
            {/* 2. Histogram */}
            <Card title="Courses by average quality" note="Number of courses in each quality range">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.buckets} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid vertical={false} stroke="#eee" />
                  <XAxis dataKey="range" tick={AXIS} interval={0} angle={-30} textAnchor="end" height={48} />
                  <YAxis allowDecimals={false} tick={AXIS} />
                  <Tooltip {...TOOLTIP} />
                  <Bar dataKey="courses" fill={INK} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* 5. Reviews per semester */}
            <Card title="Reviews per semester">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats.bySemester} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
                  <CartesianGrid vertical={false} stroke="#eee" />
                  <XAxis dataKey="semester" tick={AXIS} />
                  <YAxis allowDecimals={false} tick={AXIS} />
                  <Tooltip {...TOOLTIP} />
                  <Line type="monotone" dataKey="count" name="Reviews" stroke={INK} strokeWidth={3} dot={{ r: 5, fill: INK }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* 3. Per program */}
          <Card title="Average quality per program" note="Sorted by quality; bar label shows review count">
            <ResponsiveContainer width="100%" height={Math.max(220, stats.byProgram.length * 34 + 30)}>
              <BarChart data={stats.byProgram} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }}>
                <CartesianGrid horizontal={false} stroke="#eee" />
                <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={AXIS} />
                <YAxis type="category" dataKey="program" tick={{ ...AXIS, width: 180 }} width={190} interval={0} />
                <Tooltip {...TOOLTIP} formatter={(v, _n, item) => [`${v} (${(item.payload as { reviews: number }).reviews} reviews)`, "Quality"]} />
                <Bar
                  dataKey="quality"
                  fill={INK}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                  label={{ position: "right", fontSize: 12, fill: "#404040", formatter: (v: unknown) => String(v) }}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* 4. Scatter */}
            <Card title="Difficulty vs quality" note="One dot per course; bigger dot = more reviews">
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: -8 }}>
                  <CartesianGrid stroke="#eee" />
                  <XAxis type="number" dataKey="d" name="Difficulty" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={AXIS} label={{ value: "Difficulty", position: "insideBottom", offset: -8, fontSize: 12 }} />
                  <YAxis type="number" dataKey="q" name="Quality" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={AXIS} label={{ value: "Quality", angle: -90, position: "insideLeft", offset: 20, fontSize: 12 }} />
                  <ZAxis type="number" dataKey="n" range={[40, 360]} name="Reviews" />
                  <Tooltip
                    {...TOOLTIP}
                    content={({ payload }) => {
                      const p = payload?.[0]?.payload as CourseStat | undefined;
                      return p ? (
                        <div className="rounded-lg border border-black bg-white px-3 py-2 text-[13px] shadow">
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-neutral-600">
                            Quality {p.q.toFixed(1)} · Difficulty {p.d.toFixed(1)} · {p.n} reviews
                          </p>
                        </div>
                      ) : null;
                    }}
                  />
                  <Scatter data={stats.perCourse} fill={INK} fillOpacity={0.55} stroke={INK} isAnimationActive={false} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>

            {/* 6. Tags */}
            <Card title="Most common review tags" note="Black = positive, gray = negative">
              <ResponsiveContainer width="100%" height={Math.max(260, stats.tags.length * 26 + 30)}>
                <BarChart data={stats.tags} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 8 }}>
                  <CartesianGrid horizontal={false} stroke="#eee" />
                  <XAxis type="number" allowDecimals={false} tick={AXIS} />
                  <YAxis type="category" dataKey="tag" tick={AXIS} width={150} interval={0} />
                  <Tooltip {...TOOLTIP} formatter={(v, _n, item) => [v, (item.payload as { kind: string }).kind]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {stats.tags.map((t) => (
                      <Cell key={t.tag} fill={t.kind === "Positive" ? INK : GRAY} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* 7. Needs attention */}
          <Card title="Needs attention" note="Lowest quality (2+ reviews) or quality dropping 0.7+ in the latest semester">
            <Table
              head={["Course", "Quality", "Reviews", "Trend", "Top complaints", ""]}
              hideOnPhone={[2, 3, 4]}
              rows={stats.attention.map((c) => [
                <span key="n" className="font-medium">
                  {c.name}
                  <span className="block text-xs text-neutral-500">{c.program}</span>
                </span>,
                <Score key="q" v={c.q} />,
                c.n,
                c.trend == null ? "–" : <span className={c.trend <= -0.7 ? "font-bold" : ""}>{c.trend > 0 ? "+" : ""}{c.trend.toFixed(1)}{c.trend <= -0.7 ? " ↓" : ""}</span>,
                c.negTags.length ? c.negTags.map(([t, n]) => `${t} (${n})`).join(", ") : "–",
                <Link key="l" href={courseHref(c.id)} className="inline-flex h-11 items-center text-sm font-semibold underline underline-offset-4">
                  Open
                </Link>,
              ])}
              empty="No courses need attention for this filter."
            />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* 8. Top rated */}
            <Card title="Top rated courses" note="3+ reviews, ranked by review-count-weighted quality">
              <Table
                head={["Course", "Quality", "Reviews", "Take again"]}
                hideOnPhone={[3]}
                rows={stats.topRated.map((c) => [
                  <Link key="n" href={courseHref(c.id)} className="font-medium hover:underline">
                    {c.name}
                  </Link>,
                  <Score key="q" v={c.q} />,
                  c.n,
                  `${Math.round(c.again)}%`,
                ])}
                empty="Not enough reviews yet."
              />
            </Card>

            {/* 9. Professors */}
            <ProfessorTable professors={stats.professors} />
          </div>
        </div>
      )}
    </main>
  );
}

function Kpi({ label, value, sub, solid = false }: { label: string; value: string; sub?: string; solid?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${solid ? "bg-black text-white" : "border border-neutral-200"}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.06em] ${solid ? "text-neutral-300" : "text-neutral-500"}`}>{label}</p>
      <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">{value}</p>
      {sub && <p className={`text-sm ${solid ? "text-neutral-300" : "text-neutral-500"}`}>{sub}</p>}
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-neutral-200 p-4 sm:p-5">
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-neutral-500">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Score({ v }: { v: number }) {
  return (
    <span className={`inline-flex h-8 min-w-11 items-center justify-center rounded-lg px-2 font-bold tabular-nums ${v < 3 ? "border-2 border-black" : "bg-black text-white"}`}>
      {v.toFixed(1)}
    </span>
  );
}

export function Table({ head, rows, empty, hideOnPhone = [] }: { head: string[]; rows: ReactNode[][]; empty: string; hideOnPhone?: number[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-neutral-500">{empty}</p>;
  const hide = (i: number) => (hideOnPhone.includes(i) ? "hidden sm:table-cell" : "");
  return (
    <table className="w-full table-fixed text-left text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-xs uppercase tracking-[0.06em] text-neutral-500">
          {head.map((h, i) => (
            <th key={i} className={`py-2 pr-3 font-semibold ${i === 0 ? "w-[40%]" : ""} ${hide(i)}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j} className={`py-2 pr-3 align-middle [overflow-wrap:anywhere] ${hide(j)}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProfessorTable({ professors }: { professors: { name: string; courses: number; quality: number; reviews: number }[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? professors : professors.slice(0, 10);
  return (
    <Card title="Professors" note="From the professor named in each review">
      <Table
        head={["Professor", "Courses", "Quality", "Reviews"]}
        hideOnPhone={[1]}
        rows={shown.map((p) => [<span key="n" className="font-medium">{p.name}</span>, p.courses, <Score key="q" v={p.quality} />, p.reviews])}
        empty="No professor data for this filter."
      />
      {professors.length > 10 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 h-11 text-sm font-semibold underline underline-offset-4">
          {all ? "Show fewer" : `Show all ${professors.length}`}
        </button>
      )}
    </Card>
  );
}

function Select({ label, value, onChange, children, className = "" }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode; className?: string }) {
  return (
    <span className={`relative block ${className}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-11 w-full cursor-pointer appearance-none truncate rounded-full border pl-4 pr-9 text-base font-medium sm:text-sm ${value ? "border-black bg-black text-white" : "border-neutral-300 bg-white hover:border-black"}`}
      >
        {children}
      </select>
      <IconChevronDown width={16} height={16} className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${value ? "text-white" : "text-neutral-500"}`} />
    </span>
  );
}

export { LIGHT };
