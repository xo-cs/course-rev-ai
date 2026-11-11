"use client";

import { useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { IconChevronDown, IconClose, IconSearch, IconSettings } from "@/components/ui/Icons";
import { TYPE_GROUPS, WEEK_DAYS } from "@/lib/courseUtils";
import { useMergedTotals } from "@/lib/reviewsStore";
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

interface Filters {
  program: string;
  year: string;
  type: string;
  credits: string;
  day: string;
  englishOnly: boolean;
  showTrack: boolean;
  sort: SortKey;
}

const DEFAULT_FILTERS: Filters = {
  program: "",
  year: "",
  type: "",
  credits: "",
  day: "",
  englishOnly: false,
  showTrack: true,
  sort: "quality",
};

function parse(params: URLSearchParams): { filters: Filters; q: string } {
  const sort = params.get("sort") ?? "";
  return {
    q: params.get("q") ?? "",
    filters: {
      program: params.get("program") ?? "",
      year: params.get("year") ?? "",
      type: params.get("type") ?? "",
      credits: params.get("credits") ?? "",
      day: params.get("day") ?? "",
      englishOnly: params.get("en") === "1",
      showTrack: params.get("track") !== "0",
      sort: sort in SORTS ? (sort as SortKey) : "quality",
    },
  };
}

function serialize(f: Filters, q: string) {
  const p = new URLSearchParams();
  if (q.trim()) p.set("q", q.trim());
  if (f.program) p.set("program", f.program);
  if (f.year) p.set("year", f.year);
  if (f.type) p.set("type", f.type);
  if (f.credits) p.set("credits", f.credits);
  if (f.day) p.set("day", f.day);
  if (f.englishOnly) p.set("en", "1");
  if (!f.showTrack) p.set("track", "0");
  if (f.sort !== "quality") p.set("sort", f.sort);
  return p.toString();
}

/** Number of active filters (search and sort not included). */
function countFilters(f: Filters) {
  return [f.program, f.year, f.type, f.credits, f.day].filter(Boolean).length + (f.englishOnly ? 1 : 0) + (f.showTrack ? 0 : 1);
}

export function ReviewsBrowser({
  courses,
  seedTotals,
  programs,
}: {
  courses: CourseListItem[];
  seedTotals: Record<string, StatTotals>;
  programs: string[];
}) {
  const params = useSearchParams();
  const totals = useMergedTotals(seedTotals);

  // Filters live in local state (instant). The URL is updated with history.replaceState,
  // which does NOT trigger a Next.js navigation / server round trip.
  const [initial] = useState(() => parse(params));
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [qInput, setQInput] = useState(initial.q); // what the user types (instant)
  const [q, setQ] = useState(initial.q); // debounced value used for filtering
  const [sheetOpen, setSheetOpen] = useState(false);

  // Debounce search typing.
  useEffect(() => {
    if (qInput === q) return;
    // Transition: the list re-render is interruptible, so the next keystroke is never blocked by it.
    const t = window.setTimeout(() => startTransition(() => setQ(qInput)), 150);
    return () => window.clearTimeout(t);
  }, [qInput, q]);

  // State -> URL (no navigation).
  const serialized = serialize(filters, q);
  useEffect(() => {
    if (`?${serialized}` === window.location.search || (!serialized && !window.location.search)) return;
    window.history.replaceState(null, "", serialized ? `?${serialized}` : window.location.pathname);
  }, [serialized]);

  // URL -> state, only when the URL changed from outside (e.g. clicking "Reviews" in the nav).
  // Our own replaceState writes always equal `serialized`, so they are ignored here.
  const paramString = params.toString();
  const [seenParams, setSeenParams] = useState(paramString);
  if (paramString !== seenParams) {
    setSeenParams(paramString);
    if (paramString !== serialized) {
      const next = parse(params);
      setFilters(next.filters);
      setQInput(next.q);
      setQ(next.q);
    }
  }

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const clearAll = () => {
    setFilters({ ...DEFAULT_FILTERS, sort: filters.sort });
    setQInput("");
    setQ("");
  };

  const creditOptions = useMemo(
    () => [...new Set(courses.map((c) => c.credits).filter((c): c is number => c != null))].sort((a, b) => a - b),
    [courses],
  );

  // Sort keys depend only on totals, so compute them once per totals change (not per keystroke).
  const sortKeys = useMemo(() => {
    let allQ = 0;
    let allN = 0;
    for (const t of Object.values(totals)) {
      allQ += t.q;
      allN += t.n;
    }
    const mean = allN ? allQ / allN : 3;
    const keys = new Map<string, { weighted: number | null; d: number | null; w: number | null; n: number }>();
    for (const c of courses) {
      const t = totals[c.id];
      keys.set(c.id, {
        // "Highest quality" uses a weighted score so 3 perfect reviews don't beat 6 great ones.
        weighted: t?.n ? (t.q + 3 * mean) / (t.n + 3) : null,
        d: t?.n ? t.d / t.n : null,
        w: t?.n ? t.w / t.n : null,
        n: t?.n ?? 0,
      });
    }
    return keys;
  }, [courses, totals]);

  // Lowercased search haystacks, computed once.
  const haystacks = useMemo(
    () => new Map(courses.map((c) => [c.id, `${c.name}\n${c.professors.join("\n")}`.toLowerCase()])),
    [courses],
  );

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const f = filters;
    const list = courses.filter((c) => {
      if (needle && !haystacks.get(c.id)!.includes(needle)) return false;
      if (f.program && c.program !== f.program) return false;
      if (f.year && c.years.length && !c.years.includes(Number(f.year))) return false;
      if (f.type && c.typeGroup !== f.type) return false;
      if (f.credits && String(c.credits) !== f.credits) return false;
      if (f.day && !c.days.includes(f.day as CourseListItem["days"][number])) return false;
      if (f.englishOnly && c.korean) return false;
      if (!f.showTrack && c.track) return false;
      return true;
    });

    const k = (c: CourseListItem) => sortKeys.get(c.id)!;
    // Courses without reviews always sink to the bottom for rating-based sorts.
    const byNum = (field: "weighted" | "d" | "w", dir: 1 | -1) => (a: CourseListItem, b: CourseListItem) => {
      const va = k(a)[field];
      const vb = k(b)[field];
      if (va == null || vb == null) return va == null && vb == null ? a.name.localeCompare(b.name) : va == null ? 1 : -1;
      return (va - vb) * dir || k(b).n - k(a).n;
    };
    const sorters: Record<SortKey, (a: CourseListItem, b: CourseListItem) => number> = {
      quality: byNum("weighted", -1),
      easiest: byNum("d", 1),
      workload: byNum("w", 1),
      reviews: (a, b) => k(b).n - k(a).n || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(sorters[filters.sort]);
  }, [courses, haystacks, sortKeys, q, filters]);

  const nFilters = countFilters(filters);
  const anything = nFilters > 0 || q.trim() !== "";
  const controlsProps = { filters, set, programs, creditOptions };

  return (
    <div>
      {/* Search */}
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Course or professor"
          aria-label="Search courses by name or professor"
          className="h-13 w-full rounded-2xl border border-neutral-300 bg-white pl-12 pr-12 text-base outline-none transition-colors placeholder:text-neutral-400 hover:border-neutral-500 focus:border-black focus:ring-1 focus:ring-black focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {qInput && (
          <button
            type="button"
            onClick={() => {
              setQInput("");
              setQ("");
            }}
            className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-black"
            aria-label="Clear search"
          >
            <IconClose width={18} height={18} />
          </button>
        )}
      </div>

      {/* Phones: Filters button + sort */}
      <div className="mt-3 flex items-center gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[15px] font-medium ${
            nFilters ? "border-black bg-black text-white" : "border-neutral-300"
          }`}
          aria-haspopup="dialog"
        >
          <IconSettings width={18} height={18} />
          Filters
          {nFilters > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-semibold text-black tabular-nums">
              {nFilters}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <SortSelect value={filters.sort} onChange={(sort) => set({ sort })} className="h-11 w-full text-[15px]" />
        </div>
      </div>

      {/* Tablet / desktop: inline filters (fixed widths so nothing shifts when values change) */}
      <div className="mt-4 hidden flex-wrap items-center gap-2 sm:flex" role="group" aria-label="Filters">
        <FilterControls {...controlsProps} variant="inline" />
      </div>

      {/* Result bar */}
      <div className="mt-5 flex min-h-11 items-center justify-between gap-4 border-b border-neutral-200 pb-2">
        <p className="text-sm text-neutral-600" aria-live="polite">
          <span className="inline-block min-w-[2ch] font-semibold text-black tabular-nums">{results.length}</span> course
          {results.length === 1 ? "" : "s"}
          <button
            type="button"
            onClick={clearAll}
            className={`ml-2 h-11 px-2 font-medium text-black underline underline-offset-4 hover:no-underline ${anything ? "" : "invisible"}`}
            tabIndex={anything ? 0 : -1}
          >
            Clear all
          </button>
        </p>
        <label className="hidden items-center gap-2 text-sm sm:flex">
          <span className="text-neutral-500">Sort</span>
          <SortSelect value={filters.sort} onChange={(sort) => set({ sort })} className="h-9 w-48 text-sm" />
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

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}
              className="h-12 rounded-full px-5 text-[15px] font-medium hover:bg-neutral-100"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="h-12 flex-1 rounded-full bg-black text-[15px] font-medium text-white"
            >
              Show {results.length} course{results.length === 1 ? "" : "s"}
            </button>
          </div>
        }
      >
        <div className="space-y-4 pt-1">
          <FilterControls {...controlsProps} variant="sheet" />
        </div>
      </BottomSheet>
    </div>
  );
}

function FilterControls({
  filters: f,
  set,
  programs,
  creditOptions,
  variant,
}: {
  filters: Filters;
  set: (p: Partial<Filters>) => void;
  programs: string[];
  creditOptions: number[];
  variant: "inline" | "sheet";
}) {
  const sheet = variant === "sheet";
  return (
    <>
      <Select label="Program" value={f.program} onChange={(v) => set({ program: v })} variant={variant} width="w-60">
        <option value="">All programs</option>
        {programs.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      <div className={sheet ? "grid grid-cols-2 gap-3" : "contents"}>
        <Select label="Year" value={f.year} onChange={(v) => set({ year: v })} variant={variant} width="w-32">
          <option value="">Any year</option>
          {[1, 2, 3, 4].map((y) => (
            <option key={y} value={y}>
              Year {y}
            </option>
          ))}
        </Select>
        <Select label="Type" value={f.type} onChange={(v) => set({ type: v })} variant={variant} width="w-32">
          <option value="">Any type</option>
          {TYPE_GROUPS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select label="Credits" value={f.credits} onChange={(v) => set({ credits: v })} variant={variant} width="w-36">
          <option value="">Any credits</option>
          {creditOptions.map((c) => (
            <option key={c} value={c}>
              {c} credit{c === 1 ? "" : "s"}
            </option>
          ))}
        </Select>
        <Select label="Day" value={f.day} onChange={(v) => set({ day: v })} variant={variant} width="w-32">
          <option value="">Any day</option>
          {WEEK_DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>
      <div className={sheet ? "space-y-2 pt-1" : "contents"}>
        <Toggle on={f.englishOnly} onClick={() => set({ englishOnly: !f.englishOnly })} variant={variant}>
          English only
        </Toggle>
        <Toggle on={f.showTrack} onClick={() => set({ showTrack: !f.showTrack })} variant={variant}>
          Track courses
        </Toggle>
      </div>
    </>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
  variant,
  width,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  variant: "inline" | "sheet";
  width: string;
}) {
  const active = value !== "";
  if (variant === "sheet") {
    return (
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{label}</span>
        <span className="relative block">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`h-12 w-full appearance-none truncate rounded-xl border pl-3.5 pr-9 text-base ${
              active ? "border-black ring-1 ring-black" : "border-neutral-300"
            }`}
          >
            {children}
          </select>
          <IconChevronDown width={18} height={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        </span>
      </label>
    );
  }
  return (
    <span className={`relative inline-flex ${width}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full cursor-pointer appearance-none truncate rounded-full border pl-3.5 pr-8 text-sm font-medium transition-colors ${
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

function SortSelect({ value, onChange, className }: { value: SortKey; onChange: (v: SortKey) => void; className: string }) {
  return (
    <span className="relative block">
      <select
        aria-label="Sort by"
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className={`cursor-pointer appearance-none truncate rounded-full border border-neutral-300 bg-white pl-3.5 pr-8 font-medium hover:border-black ${className}`}
      >
        {Object.entries(SORTS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <IconChevronDown width={16} height={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
    </span>
  );
}

function Toggle({
  on,
  onClick,
  children,
  variant,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  variant: "inline" | "sheet";
}) {
  const box = (
    <span
      aria-hidden
      className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${
        on ? (variant === "sheet" ? "border-black bg-black" : "border-white bg-white") : "border-neutral-400"
      }`}
    >
      {on && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.2l2.2 2.2 4.8-5"
            stroke={variant === "sheet" ? "white" : "black"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
  if (variant === "sheet") {
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={onClick}
        className="flex h-12 w-full items-center gap-3 rounded-xl border border-neutral-300 px-3.5 text-left text-base"
      >
        {box}
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors ${
        on ? "border-black bg-black text-white" : "border-neutral-300 bg-white hover:border-black"
      }`}
    >
      {box}
      {children}
    </button>
  );
}

export function ReviewsBrowserSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading courses">
      <div className="h-13 rounded-2xl border border-neutral-200 bg-neutral-50" />
      <div className="mt-3 flex gap-2 sm:hidden">
        <div className="h-11 w-28 rounded-full bg-neutral-100" />
        <div className="h-11 flex-1 rounded-full bg-neutral-100" />
      </div>
      <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
        {["w-60", "w-32", "w-32", "w-36", "w-32", "w-32", "w-36"].map((w, i) => (
          <div key={i} className={`h-10 ${w} rounded-full bg-neutral-100`} />
        ))}
      </div>
      <div className="mt-5 h-11 border-b border-neutral-200" />
      <ul className="divide-y divide-neutral-200">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex-1 space-y-2">
              <div className="h-5 w-1/2 rounded bg-neutral-100" />
              <div className="h-4 w-1/3 rounded bg-neutral-100" />
              <div className="h-3 w-2/3 rounded bg-neutral-100" />
            </div>
            <div className="size-12 rounded-xl bg-neutral-100 sm:size-[72px]" />
          </li>
        ))}
      </ul>
    </div>
  );
}
