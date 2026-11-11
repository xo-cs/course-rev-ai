import Link from "next/link";
import { courseHref, formatCredits, formatYears } from "@/lib/courseUtils";
import { avg } from "@/lib/stats";
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

export function CourseRow({ course, totals }: { course: CourseListItem; totals?: StatTotals }) {
  const n = totals?.n ?? 0;
  const profs = course.professors.length ? course.professors.join(", ") : "Professor TBA";
  return (
    <li>
      <Link
        href={courseHref(course.id)}
        className="group flex items-center gap-4 rounded-2xl px-4 py-5 transition-colors hover:bg-neutral-50 sm:gap-6 sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-snug tracking-tight group-hover:underline group-hover:underline-offset-4 sm:text-xl">
            {course.name}
          </h3>
          <p className="mt-0.5 truncate text-[15px] text-neutral-600">{profs}</p>
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
        <div className="hidden flex-col gap-2 sm:flex">
          <MiniStat label="Difficulty" value={totals ? avg(totals.d, n) : null} />
          <MiniStat label="Workload" value={totals ? avg(totals.w, n) : null} />
        </div>
        <QualityBox value={totals ? avg(totals.q, n) : null} count={n} />
      </Link>
    </li>
  );
}
