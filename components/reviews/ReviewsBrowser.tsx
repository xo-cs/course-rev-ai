"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { IconChevronDown, IconClose, IconSearch } from "@/components/ui/Icons";
import { TYPE_GROUPS, WEEK_DAYS } from "@/lib/courseUtils";
import { useMergedTotals } from "@/lib/reviewsStore";
import { avg } from "@/lib/stats";
import type { CourseListItem, StatTotals } from "@/lib/types";
import { CourseRow } from "./CourseRow";

const SORTS = {
  quality: "Highest quality",
  reviews: "Most reviewed",
  easiest: "Easiest",
  workload: "Lightest workload",
  name: "Name (A–Z)",
} as const;
type SortKey = keyof typeof SORTS;

const FILTER_KEYS = ["q", "program", "year", "type", "credits", "day", "en", "track"] as const;

export function ReviewsBrowser({
  courses,
  seedTotals,
  programs,
}: {
  courses: CourseListItem[];
  seedTotals: Record<string, StatTotals>;
  programs: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const totals = useMergedTotals(seedTotals);

  const program = params.get("program") ?? "";
  const year = params.get("year") ?? "";
  const type = params.get("type") ?? "";
  const credits = params.get("credits") ?? "";
  const day = params.get("day") ?? "";
  const englishOnly = params.get("en") === "1";
  const showTrack = params.get("track") !== "0";
  const sort = (params.get("sort") as SortKey) in SORTS ? (params.get("sort") as SortKey) : "quality";

  // Search box: local state for instant typing, synced to the URL with a short debounce.
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  if (urlQ !== lastUrlQ) {
    // URL changed from outside (back button, clear filters): follow it.
    setLastUrlQ(urlQ);
    setQ(urlQ);
  }

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (q === urlQ) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const creditOptions = useMemo(
    () => [...new Set(courses.map((c) => c.credits).filter((c): c is number => c != null))].sort((a, b) => a - b),
    [courses],
  );

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = courses.filter((c) => {
      if (needle && !c.name.toLowerCase().includes(needle) && !c.professors.some((p) => p.toLowerCase().includes(needle)))
        return false;
      if (program && c.program !== program) return false;
      if (year && c.years.length && !c.years.includes(Number(year))) return false;
      if (type && c.typeGroup !== type) return false;
      if (credits && String(c.credits) !== credits) return false;
      if (day && !c.days.includes(day as CourseListItem["days"][number])) return false;
      if (englishOnly && c.korean) return false;
      if (!showTrack && c.track) return false;
      return true;
    });

    const stat = (c: CourseListItem, k: "q" | "d" | "w") => {
      const t = totals[c.id];
      return t ? avg(t[k], t.n) : null;
    };
    // Courses without reviews always sink to the bottom for rating-based sorts.
    const byNum = (k: "q" | "d" | "w", dir: 1 | -1) => (a: CourseListItem, b: CourseListItem) => {
      const va = stat(a, k);
      const vb = stat(b, k);
      if (va == null && vb == null) return a.name.localeCompare(b.name);
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va - vb) * dir || (totals[b.id]?.n ?? 0) - (totals[a.id]?.n ?? 0);
    };
    // "Highest quality" ranks by a weighted score so 3 perfect reviews don't beat 6 great ones.
    // (Displayed averages are unchanged.) Prior: 3 reviews at the overall mean.
    let allQ = 0;
    let allN = 0;
    for (const t of Object.values(totals)) {
      allQ += t.q;
      allN += t.n;
    }
    const mean = allN ? allQ / allN : 3;
    const weighted = (c: CourseListItem) => {
      const t = totals[c.id];
      return t?.n ? (t.q + 3 * mean) / (t.n + 3) : null;
    };
    const sorters: Record<SortKey, (a: CourseListItem, b: CourseListItem) => number> = {
      quality: (a, b) => {
        const va = weighted(a);
        const vb = weighted(b);
        if (va == null || vb == null) return va == null && vb == null ? a.name.localeCompare(b.name) : va == null ? 1 : -1;
        return vb - va;
      },
      easiest: byNum("d", 1),
      workload: byNum("w", 1),
      reviews: (a, b) => (totals[b.id]?.n ?? 0) - (totals[a.id]?.n ?? 0) || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(sorters[sort]);
  }, [courses, totals, q, program, year, type, credits, day, englishOnly, showTrack, sort]);

  const activeFilters = FILTER_KEYS.filter((k) => (k === "q" ? q.trim() : params.get(k))).length;

  return (
    <div>
      {/* Search */}
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by course name or professor"
          aria-label="Search courses by name or professor"
          className="h-13 w-full rounded-2xl border border-neutral-300 bg-white pl-12 pr-12 text-base outline-none transition-colors placeholder:text-neutral-400 hover:border-neutral-500 focus:border-black focus-visible:outline-none focus:ring-1 focus:ring-black [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-black"
            aria-label="Clear search"
          >
            <IconClose width={18} height={18} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <Select label="Program" value={program} onChange={(v) => update({ program: v })}>
          <option value="">All programs</option>
          {programs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Select label="Year" value={year} onChange={(v) => update({ year: v })}>
          <option value="">Any year</option>
          {[1, 2, 3, 4].map((y) => (
            <option key={y} value={y}>
              Year {y}
            </option>
          ))}
        </Select>
        <Select label="Type" value={type} onChange={(v) => update({ type: v })}>
          <option value="">Any type</option>
          {TYPE_GROUPS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select label="Credits" value={credits} onChange={(v) => update({ credits: v })}>
          <option value="">Any credits</option>
          {creditOptions.map((c) => (
            <option key={c} value={c}>
              {c} credit{c === 1 ? "" : "s"}
            </option>
          ))}
        </Select>
        <Select label="Day of week" value={day} onChange={(v) => update({ day: v })}>
          <option value="">Any day</option>
          {WEEK_DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Toggle on={englishOnly} onClick={() => update({ en: englishOnly ? null : "1" })}>
          English only
        </Toggle>
        <Toggle on={showTrack} onClick={() => update({ track: showTrack ? "0" : null })}>
          Track courses
        </Toggle>
      </div>

      {/* Result bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-neutral-200 pb-3">
        <p className="text-sm text-neutral-600" aria-live="polite">
          <span className="font-semibold text-black tabular-nums">{results.length}</span> course{results.length === 1 ? "" : "s"}
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                update(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])));
              }}
              className="ml-3 font-medium text-black underline underline-offset-4 hover:no-underline"
            >
              Clear filters
            </button>
          )}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500">Sort</span>
          <Select label="Sort by" value={sort} onChange={(v) => update({ sort: v === "quality" ? null : v })} bare>
            {Object.entries(SORTS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {results.length ? (
        <ul className="-mx-4 divide-y divide-neutral-200 sm:-mx-5">
          {results.map((c) => (
            <CourseRow key={c.id} course={c} totals={totals[c.id]} />
          ))}
        </ul>
      ) : (
        <div className="py-20 text-center">
          <p className="text-lg font-semibold">No courses match.</p>
          <p className="mt-1 text-sm text-neutral-500">Try a different search or clear some filters.</p>
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
  bare = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  bare?: boolean;
}) {
  const active = !bare && value !== "";
  return (
    <span className="relative inline-flex max-w-full">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 max-w-full cursor-pointer appearance-none truncate rounded-full border pl-3.5 pr-8 text-sm font-medium transition-colors ${
          active ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-black hover:border-black"
        }`}
      >
        {children}
      </select>
      <IconChevronDown
        width={16}
        height={16}
        className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${active ? "text-white" : "text-neutral-500"}`}
      />
    </span>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors ${
        on ? "border-black bg-black text-white" : "border-neutral-300 bg-white hover:border-black"
      }`}
    >
      <span
        aria-hidden
        className={`flex size-3.5 items-center justify-center rounded-[4px] border ${on ? "border-white bg-white" : "border-neutral-400"}`}
      >
        {on && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.2l2.2 2.2 4.8-5" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {children}
    </button>
  );
}

export function ReviewsBrowserSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading courses">
      <div className="h-13 rounded-2xl border border-neutral-200 bg-neutral-50" />
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-9 w-28 rounded-full bg-neutral-100" />
        ))}
      </div>
      <ul className="mt-6 divide-y divide-neutral-200 border-t border-neutral-200">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-6 py-6">
            <div className="flex-1 space-y-2">
              <div className="h-5 w-1/2 rounded bg-neutral-100" />
              <div className="h-4 w-1/3 rounded bg-neutral-100" />
              <div className="h-3 w-2/3 rounded bg-neutral-100" />
            </div>
            <div className="size-[72px] rounded-xl bg-neutral-100" />
          </li>
        ))}
      </ul>
    </div>
  );
}
