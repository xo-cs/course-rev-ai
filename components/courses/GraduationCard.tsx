"use client";

import { useShell } from "@/components/shell/ShellContext";
import type { CourseSections } from "@/lib/catalog";
import { categoryFor, remainingOf, totals } from "@/lib/credits";
import type { MyCourse } from "@/lib/myCoursesStore";
import { uploadRequestStore } from "@/lib/pageContext";
import { profileStore } from "@/lib/profileStore";

/** Graduation progress from the confirmed credits screenshot + what this semester's plan adds. */
export function GraduationCard({ mine, index }: { mine: MyCourse[]; index: Record<string, CourseSections> }) {
  const profile = profileStore.useValue();
  const { openBroddy } = useShell();
  const cats = profile.credits?.categories ?? [];

  function upload() {
    openBroddy();
    uploadRequestStore.set((n) => n + 1);
  }

  if (!cats.length) {
    return (
      <section aria-labelledby="grad-h" className="mt-6 rounded-2xl border border-dashed border-neutral-400 p-5">
        <h2 id="grad-h" className="text-base font-bold tracking-tight">
          Graduation progress
        </h2>
        <p className="mt-1 text-[15px] text-neutral-600">
          Upload a screenshot of your credits page and Broddy will track what you still need, and how this semester&apos;s plan helps.
        </p>
        <button type="button" onClick={upload} className="mt-4 h-11 rounded-full bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800">
          Upload your credits screenshot
        </button>
      </section>
    );
  }

  // Planned credits per category from My Courses (matched by course type).
  const planned = cats.map(() => 0);
  const unmatched: string[] = [];
  for (const m of mine) {
    const idx = categoryFor(index[m.courseId]?.typeGroup, cats);
    if (idx >= 0) planned[idx] += m.credits ?? 0;
    else unmatched.push(m.name);
  }
  const t = totals(cats);
  const afterPlan = cats.reduce((s, c, i) => s + Math.max(0, remainingOf(c) - planned[i]), 0);

  return (
    <section aria-labelledby="grad-h" className="mt-6 rounded-2xl border border-neutral-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="grad-h" className="text-base font-bold tracking-tight">
            Graduation progress
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">From your confirmed credits screenshot</p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">Credits left</p>
            <p className="text-3xl font-bold tabular-nums">{t.remaining}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">After this plan</p>
            <p className="text-3xl font-bold tabular-nums text-neutral-500">{afterPlan}</p>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {cats.map((c, i) => {
          const pct = (v: number) => (c.required ? Math.min(100, (v / c.required) * 100) : 0);
          const earnedPct = pct(Math.min(c.earned, c.required));
          const plannedPct = Math.min(100 - earnedPct, pct(planned[i]));
          return (
            <li key={c.name + i}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{c.name}</span>
                <span className="shrink-0 tabular-nums text-neutral-600">
                  {c.earned}/{c.required}
                  {planned[i] > 0 && <span className="text-neutral-500"> +{planned[i]} planned</span>}
                  <strong className="ml-2 text-black">{remainingOf(c)} left</strong>
                </span>
              </div>
              <div
                className="mt-1 flex h-3 overflow-hidden rounded-full bg-neutral-100"
                role="img"
                aria-label={`${c.name}: ${c.earned} of ${c.required} earned, ${planned[i]} planned this semester`}
              >
                <span className="h-full bg-black" style={{ width: `${earnedPct}%` }} />
                <span className="h-full bg-neutral-400" style={{ width: `${plannedPct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-black" aria-hidden /> Earned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-neutral-400" aria-hidden /> This semester&apos;s plan
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-neutral-100 ring-1 ring-neutral-300" aria-hidden /> Still needed
          </span>
        </span>
        <span className="flex gap-1">
          <button type="button" onClick={upload} className="h-11 rounded-full px-3 font-semibold text-black underline underline-offset-4">
            Update
          </button>
          <button
            type="button"
            onClick={() => profileStore.set({ ...profileStore.get(), credits: null })}
            className="h-11 rounded-full px-3 underline underline-offset-4 hover:text-black"
          >
            Remove
          </button>
        </span>
      </div>
      {unmatched.length > 0 && <p className="mt-1 text-xs text-neutral-500">Not matched to a category: {unmatched.join(", ")}.</p>}
      <p className="mt-1 text-xs text-neutral-500">Planned credits are matched to categories by course type, so treat them as an estimate.</p>
    </section>
  );
}
