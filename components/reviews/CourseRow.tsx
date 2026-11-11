import Link from "next/link";
import { memo } from "react";
import { courseHref, formatCredits, formatYears } from "@/lib/courseUtils";
import { avg, fmtAvg } from "@/lib/stats";
import type { CourseListItem, StatTotals } from "@/lib/types";
import { MiniStat, QualityBox } from "./QualityBox";

export function Badge({ children, solid = false }: { children: React.ReactNode; solid?: boolean }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-semibold uppercase tracking-wide ${
        solid ? "bg-black text-white" : "border border-neutral-300 text-neutral-700"
      }`}
    >
      {children}
    </span>
  );
}

/** Memoized: rows only re-render when their own course or totals change. */
export const CourseRow = memo(function CourseRow({ course, totals }: { course: CourseListItem; totals?: StatTotals }) {
  const n = totals?.n ?? 0;
  const q = totals ? avg(totals.q, n) : null;
  const d = totals ? avg(totals.d, n) : null;
  const w = totals ? avg(totals.w, n) : null;
  const profs = course.professors.length ? course.professors.join(", ") : "Professor TBA";

  return (
    <li>
      <Link
        href={courseHref(course.id)}
        className="group flex flex-col gap-3 rounded-2xl px-4 py-5 transition-colors hover:bg-neutral-50 active:bg-neutral-100 sm:flex-row sm:items-center sm:gap-6 sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-snug tracking-tight [overflow-wrap:anywhere] group-hover:underline group-hover:underline-offset-4 sm:text-xl">
            {course.name}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[15px] text-neutral-600 sm:truncate">{profs}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-neutral-500">
            <span>{course.program}</span>
            <span aria-hidden>·</span>
            <span>{formatYears(course.years)}</span>
            <span aria-hidden>·</span>
            <span>{formatCredits(course.credits)}</span>
            {!(course.track && course.typeGroup === "Track") && (
              <>
                <span aria-hidden>·</span>
                <span>{course.type || "Other"}</span>
              </>
            )}
            {course.track && <Badge solid>Track</Badge>}
            {course.korean && <Badge>Korean</Badge>}
          </div>
        </div>

        {/* Phones: stats in one row under the name */}
        <div className="flex items-center gap-5 sm:hidden">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex size-12 items-center justify-center rounded-xl text-lg font-bold tabular-nums ${
                q == null ? "border border-dashed border-neutral-400 text-sm text-neutral-400" : "bg-black text-white"
              }`}
            >
              {fmtAvg(q)}
            </span>
            <span className="leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Quality</span>
              <span className="block text-xs text-neutral-500 tabular-nums">
                {n} review{n === 1 ? "" : "s"}
              </span>
            </span>
          </div>
          <MobileStat label="Difficulty" value={fmtAvg(d)} />
          <MobileStat label="Workload" value={fmtAvg(w)} />
        </div>

        {/* Tablet / desktop: stats on the right */}
        <div className="hidden flex-col gap-2 sm:flex">
          <MiniStat label="Difficulty" value={d} />
          <MiniStat label="Workload" value={w} />
        </div>
        <div className="hidden sm:block">
          <QualityBox value={q} count={n} />
        </div>
      </Link>
    </li>
  );
});

function MobileStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="leading-tight">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{label}</span>
      <span className="block text-base font-semibold tabular-nums">{value}</span>
    </span>
  );
}
