"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { moderateViaApi } from "@/components/course/moderate";
import { ReviewFormModal } from "@/components/course/ReviewForm";
import { useShell } from "@/components/shell/ShellContext";
import { BroddyAvatar, IconChevronDown } from "@/components/ui/Icons";
import type { CourseSections } from "@/lib/catalog";
import { courseHref } from "@/lib/courseUtils";
import { myCoursesStore, type MyCourse } from "@/lib/myCoursesStore";
import { dismissedContextStore, pageCourseStore } from "@/lib/pageContext";
import { previewStore } from "@/lib/previewStore";
import { reviewsStore } from "@/lib/reviewsStore";
import { clashesWith, findAllClashes } from "@/lib/schedule";
import { showToast } from "@/lib/toast";
import { ClashBanner } from "@/components/calendar/ClashBanner";

export function MyCourses({ index, programs }: { index: Record<string, CourseSections>; programs: string[] }) {
  const mine = myCoursesStore.useAll();
  const userReviews = reviewsStore.useUserReviews();
  const { openBroddy } = useShell();
  const [rating, setRating] = useState<MyCourse | null>(null);
  const total = myCoursesStore.totalCredits(mine);
  const clashes = useMemo(() => findAllClashes(mine), [mine]);
  const clashing = new Set(clashes.flatMap((c) => [c.a.courseId, c.b.courseId]));

  // Leaving the page: drop any course context set by "Ask Broddy" here.
  useEffect(() => () => pageCourseStore.set(null), []);

  function askBroddy(c: MyCourse) {
    pageCourseStore.set({ courseId: c.courseId, label: c.name });
    dismissedContextStore.set(null);
    openBroddy();
  }

  function changeSection(c: MyCourse, section: string) {
    const s = index[c.courseId]?.sections.find((x) => x.section === section);
    if (!s) return;
    myCoursesStore.add({
      ...c,
      section: s.section,
      slots: s.slots,
      professor: s.professor,
      room: s.room,
      scheduleText: s.schedule_text,
    });
    const cl = clashesWith({ courseId: c.courseId, name: c.name, section: s.section, slots: s.slots }, mine);
    showToast(cl.length ? `Switched to ${s.section}. Clashes with ${cl[0].b.name}` : `Switched ${c.name} to section ${s.section}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">My Courses</h1>
          <p className="mt-2 text-[15px] text-neutral-600">Your plan for the semester. Stored in this browser.</p>
        </div>
        {mine.length > 0 && (
          <Link href="/calendar" className="inline-flex h-11 items-center rounded-full border border-black px-5 text-sm font-semibold hover:bg-neutral-100">
            View calendar
          </Link>
        )}
      </header>

      {mine.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center">
          <p className="text-lg font-semibold">No courses yet.</p>
          <p className="mt-1 text-[15px] text-neutral-600">Browse reviews to find some.</p>
          <Link href="/reviews" className="mt-5 inline-flex h-11 items-center rounded-full bg-black px-5 text-sm font-semibold text-white">
            Browse reviews
          </Link>
        </div>
      ) : (
        <>
          {/* Credits counter */}
          <section aria-label="Credits" className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-neutral-200 p-5">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums tracking-tight">{total}</span>
              <span className="text-[15px] text-neutral-600">credits planned</span>
            </div>
            <div className="text-sm text-neutral-600">
              {mine.length} course{mine.length === 1 ? "" : "s"}
              {total > 21 && (
                <p className="mt-1 font-semibold text-black">Above 21 credits. That&apos;s more than most students can register for; check the rules.</p>
              )}
              {total > 0 && total < 9 && (
                <p className="mt-1 font-semibold text-black">Below 9 credits. Most students need at least 9 to be full time.</p>
              )}
            </div>
            <div className="ml-auto hidden h-3 w-48 overflow-hidden rounded-full bg-neutral-100 sm:block" aria-hidden>
              <div className="h-full rounded-full bg-black" style={{ width: `${Math.min(100, (total / 21) * 100)}%` }} />
            </div>
          </section>

          <ClashBanner clashes={clashes} className="mt-4" />

          <ul className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200">
            {mine.map((c) => {
              const info = index[c.courseId];
              const hasReview = Boolean(reviewsStore.mine(c.courseId, userReviews));
              return (
                <li key={c.courseId} className="py-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <Link href={courseHref(c.courseId)} className="text-lg font-semibold tracking-tight hover:underline hover:underline-offset-4 sm:text-xl">
                        {c.name}
                      </Link>
                      <p className="mt-1 text-[15px] text-neutral-700">
                        {c.slots.length ? c.scheduleText : <span className="italic text-neutral-500">Schedule TBA</span>}
                        {c.room ? ` · ${c.room}` : ""}
                      </p>
                      <p className="mt-0.5 text-sm text-neutral-500">
                        {c.professor || "Professor TBA"} · {c.credits != null ? `${c.credits} credits` : "Credits TBA"}
                      </p>
                      {clashing.has(c.courseId) && (
                        <p className="mt-2 inline-flex items-center gap-2 rounded-md border-2 border-black px-2 py-0.5 text-xs font-bold uppercase tracking-wide [background-image:var(--hatch)]">
                          <span className="bg-white px-1">Clash</span>
                        </p>
                      )}
                    </div>
                    <label className="block shrink-0">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-neutral-500">Section</span>
                      <span className="relative block">
                        <select
                          value={c.section}
                          onChange={(e) => changeSection(c, e.target.value)}
                          onMouseLeave={() => previewStore.set(null)}
                          className="h-11 w-full cursor-pointer appearance-none rounded-full border border-neutral-300 bg-white pl-4 pr-9 text-base font-medium hover:border-black sm:w-64 sm:text-sm"
                        >
                          {info?.sections.map((s) => (
                            <option key={s.section} value={s.section}>
                              {s.section} · {s.slots.length ? s.schedule_text : "TBA"}
                            </option>
                          )) ?? <option value={c.section}>{c.section}</option>}
                        </select>
                        <IconChevronDown width={16} height={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                      </span>
                    </label>
                  </div>
                  <div className="-ml-1 mt-3 flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setRating(c)}
                      className="h-11 rounded-full px-3 text-sm font-semibold hover:bg-neutral-100"
                    >
                      {hasReview ? "Edit your review" : "Rate this course"}
                    </button>
                    <button
                      type="button"
                      onClick={() => askBroddy(c)}
                      className="inline-flex h-11 items-center gap-2 rounded-full pl-1.5 pr-3 text-sm font-semibold hover:bg-neutral-100"
                    >
                      <BroddyAvatar size={26} />
                      Ask Broddy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        myCoursesStore.remove(c.courseId);
                        showToast(`Removed ${c.name}`);
                      }}
                      className="h-11 rounded-full px-3 text-sm text-neutral-600 underline underline-offset-4 hover:text-black"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {clashes.length > 0 && (
            <p className="mt-4 text-sm text-neutral-600">
              Tip: change a section above to fix a clash, or ask Broddy &quot;Do I have clashes?&quot;
            </p>
          )}
        </>
      )}

      {rating && (
        <ReviewFormModal
          course={{ id: rating.courseId, name: rating.name, sections: index[rating.courseId]?.sections ?? [] }}
          programs={programs}
          open
          onClose={() => setRating(null)}
          moderate={moderateViaApi}
        />
      )}
    </div>
  );
}
