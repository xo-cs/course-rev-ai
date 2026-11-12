"use client";

import { useState } from "react";
import { myCoursesStore, toMyCourse } from "@/lib/myCoursesStore";
import { clashesWith, describeClash, type Clash } from "@/lib/schedule";
import { previewStore } from "@/lib/previewStore";
import { showToast } from "@/lib/toast";
import type { Course, Section } from "@/lib/types";

export function SectionsTable({ course }: { course: Course }) {
  const mine = myCoursesStore.useAll();
  const current = mine.find((m) => m.courseId === course.id);

  return (
    <div>
      <div className="hidden grid-cols-[72px_minmax(0,1fr)_96px_minmax(0,1.3fr)_200px] gap-4 border-b border-neutral-200 px-4 pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-neutral-500 md:grid">
        <span>Section</span>
        <span>Professor</span>
        <span>Room</span>
        <span>Schedule</span>
        <span className="text-right">My Courses</span>
      </div>
      <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 md:rounded-none md:border-0">
        {course.sections.map((s) => (
          <SectionRow key={s.section} course={course} section={s} currentSection={current?.section} />
        ))}
      </ul>
    </div>
  );
}

function SectionRow({ course, section: s, currentSection }: { course: Course; section: Section; currentSection?: string }) {
  const mine = myCoursesStore.useAll();
  const [pending, setPending] = useState<Clash[] | null>(null);
  const added = currentSection === s.section;
  const otherAdded = currentSection != null && !added;

  // Clash check only needs id/name/section/slots (no timestamp: keeps prerendering deterministic).
  const clashes = clashesWith({ courseId: course.id, name: course.name, section: s.section, slots: s.slots }, mine);

  function add(force = false) {
    if (clashes.length && !force) {
      setPending(clashes);
      return;
    }
    myCoursesStore.add(toMyCourse(course, s));
    setPending(null);
    showToast(`${otherAdded ? "Switched to" : "Added"} ${course.name} · ${s.section}`, { href: "/courses", text: "My Courses" });
  }

  return (
    <li className="px-4 py-4 md:py-3.5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 md:grid-cols-[72px_minmax(0,1fr)_96px_minmax(0,1.3fr)_200px] md:items-center">
        <span className="row-span-3 flex h-8 min-w-12 items-center justify-center rounded-lg border border-black px-2 text-sm font-semibold tabular-nums md:row-span-1 md:w-fit">
          {s.section}
        </span>
        <span className="truncate text-[15px] font-medium md:font-normal">{s.professor || "TBA"}</span>
        <span className="text-sm text-neutral-600 md:text-[15px] md:text-black">
          <span className="md:hidden">Room </span>
          {s.room || "TBA"}
        </span>
        <span className="text-sm text-neutral-600 md:text-[15px] md:text-black">
          {s.slots.length ? s.schedule_text : <span className="italic text-neutral-500">Schedule TBA</span>}
        </span>

        <div className="col-span-2 mt-3 flex flex-col items-stretch gap-1 md:col-span-1 md:mt-0 md:items-end">
          {added ? (
            <div className="flex items-center gap-1 md:justify-end">
              <span className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-black px-4 text-sm font-semibold md:flex-none">
                <Check /> Added
              </span>
              <button
                type="button"
                onClick={() => {
                  myCoursesStore.remove(course.id);
                  showToast(`Removed ${course.name}`);
                }}
                className="h-11 rounded-full px-3 text-sm text-neutral-600 underline underline-offset-4 hover:text-black"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => add()}
              onMouseEnter={() =>
                previewStore.set({ courseId: course.id, name: course.name, section: s.section, room: s.room, slots: s.slots, professor: s.professor, credits: course.credits, scheduleText: s.schedule_text })
              }
              onMouseLeave={() => previewStore.set(null)}
              onFocus={() =>
                previewStore.set({ courseId: course.id, name: course.name, section: s.section, room: s.room, slots: s.slots, professor: s.professor, credits: course.credits, scheduleText: s.schedule_text })
              }
              onBlur={() => previewStore.set(null)}
              className="inline-flex h-11 items-center justify-center rounded-full bg-black px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 active:scale-[0.98]"
            >
              {otherAdded ? "Switch to this section" : "Add to My Courses"}
            </button>
          )}
          {clashes.length > 0 && !pending && (
            <span className="text-xs text-neutral-600 md:text-right">
              <strong className="font-semibold text-black">Clash:</strong> {describeClash(clashes[0])}
              {clashes.length > 1 ? ` +${clashes.length - 1}` : ""}
            </span>
          )}
        </div>
      </div>

      {s.remark && (
        <p className="mt-2 text-sm md:ml-[88px]">
          <span className="font-semibold">Note:</span> {s.remark}
        </p>
      )}

      {pending && (
        <div role="alert" className="mt-3 rounded-xl border-2 border-black [background-image:var(--hatch)] p-[3px]">
          <div className="rounded-lg bg-white p-3">
            <p className="text-sm font-semibold">This section clashes with your timetable</p>
            <ul className="mt-1 space-y-0.5 text-sm text-neutral-700">
              {pending.map((c, i) => (
                <li key={i}>{describeClash(c)}</li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => add(true)} className="h-11 rounded-full bg-black px-4 text-sm font-semibold text-white">
                Add anyway
              </button>
              <button type="button" onClick={() => setPending(null)} className="h-11 rounded-full px-4 text-sm font-medium hover:bg-neutral-100">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.5 6.2l2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
