"use client";

import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";
import { courseHref } from "@/lib/courseUtils";
import { myCoursesStore, type MyCourse } from "@/lib/myCoursesStore";
import { previewStore } from "@/lib/previewStore";
import { clashesWith, describeClash } from "@/lib/schedule";
import { showToast } from "@/lib/toast";
import type { RefCourse, RefSection } from "@/lib/tokens";

interface Refs {
  refs: Record<string, RefCourse>;
  secs: Record<string, RefSection>;
}

/** Minimal markdown (paragraphs, - / 1. lists, **bold**) plus [[course]] and [[add:course:section]] tokens. */
export function MessageContent({ text, refs, secs }: { text: string } & Refs) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const bullet = /^\s*[-*•]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? numbered : bullet).test(lines[i])) {
        items.push(lines[i].replace(ordered ? numbered : bullet, ""));
        i++;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={key++} className={`space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"} marker:text-neutral-500`}>
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, { refs, secs })}</li>
          ))}
        </ListTag>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !bullet.test(lines[i]) && !numbered.test(lines[i])) {
      para.push(lines[i].replace(/^#{1,6}\s+/, ""));
      i++;
    }
    blocks.push(
      <p key={key++}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(p, { refs, secs })}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="space-y-2">{blocks}</div>;
}

const INLINE = /(\[\[add:[^\]\s]+\]\]|\[\[[^\]\s]+\]\]|\*\*[^*]+\*\*)/g;

function renderInline(text: string, r: Refs): ReactNode[] {
  const parts = text.split(INLINE);
  // The model sometimes writes "Computer Vision [[ai-computer-vision]]": drop the duplicated name before a chip.
  for (let k = 1; k < parts.length; k++) {
    const m = /^\[\[([^\]:\s]+)\]\]$/.exec(parts[k]);
    const name = m && r.refs[m[1]]?.name;
    if (name && parts[k - 1]) {
      const re = new RegExp(`(\\*\\*)?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\*\\*)?\\s*$`, "i");
      parts[k - 1] = parts[k - 1].replace(re, "");
      // "**Computer Vision** [[id]]": the bold name is two parts back.
      if (!parts[k - 1].trim() && k >= 2 && parts[k - 2].toLowerCase() === `**${name.toLowerCase()}**`) parts[k - 2] = "";
    }
  }
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith("[[add:")) {
      const [, id, section] = part.slice(2, -2).split(":");
      const sec = r.secs[`${id}:${section}`];
      const course = r.refs[id];
      return sec && course ? <AddChip key={i} course={course} sec={sec} /> : null;
    }
    if (part.startsWith("[[")) {
      const course = r.refs[part.slice(2, -2)];
      return course ? <CourseChip key={i} course={course} /> : null;
    }
    if (part.startsWith("**")) return <strong key={i}>{renderInline(part.slice(2, -2), r)}</strong>;
    return <Fragment key={i}>{part.replace(/`/g, "")}</Fragment>;
  });
}

function VerifiedMark() {
  return (
    <span
      title="Verified: this course is in the Spring 2025 catalog"
      aria-label="Verified course"
      className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full bg-black text-white"
    >
      <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M2.5 6.2l2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function CourseChip({ course }: { course: RefCourse }) {
  return (
    <Link
      href={courseHref(course.id)}
      className="mx-0.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-neutral-300 bg-white py-0.5 pl-2.5 pr-2 align-middle text-[13px] leading-5 text-black no-underline transition-colors hover:border-black"
    >
      <span className="truncate font-semibold">{course.name}</span>
      <span className="shrink-0 text-neutral-500 tabular-nums">
        {course.credits != null ? `${course.credits}cr` : ""}
        {course.quality != null ? ` · Q ${course.quality.toFixed(1)}` : ""}
      </span>
      <VerifiedMark />
    </Link>
  );
}

function AddChip({ course, sec }: { course: RefCourse; sec: RefSection }) {
  const mine = myCoursesStore.useAll();
  const [confirm, setConfirm] = useState(false);
  const added = mine.some((m) => m.courseId === course.id && m.section === sec.section);
  const otherSection = mine.find((m) => m.courseId === course.id && m.section !== sec.section);
  const clashes = clashesWith({ courseId: course.id, name: course.name, section: sec.section, slots: sec.slots }, mine);
  const preview = () => previewStore.set({ courseId: course.id, name: course.name, section: sec.section, room: sec.room, slots: sec.slots });
  const clear = () => previewStore.set(null);

  function add() {
    const entry: MyCourse = {
      courseId: course.id,
      name: course.name,
      section: sec.section,
      slots: sec.slots,
      professor: sec.professor,
      room: sec.room,
      scheduleText: sec.scheduleText,
      credits: course.credits,
      addedAt: new Date().toISOString(),
    };
    myCoursesStore.add(entry);
    setConfirm(false);
    clear();
    showToast(`Added ${course.name} · ${sec.section}`, { href: "/calendar", text: "Calendar" });
  }

  return (
    <span className="my-1 block rounded-2xl border border-neutral-300 bg-white p-2.5 text-[13px] leading-snug">
      <span className="flex items-center gap-1.5 font-semibold">
        <span className="truncate">
          {course.name} · {sec.section}
        </span>
        <VerifiedMark />
      </span>
      <span className="mt-0.5 block text-neutral-600">
        {sec.scheduleText || "Schedule TBA"}
        {sec.room ? ` · ${sec.room}` : ""}
      </span>
      {clashes.length > 0 && !added && (
        <span className="mt-1 block">
          <strong>Clash:</strong> {describeClash(clashes[0])}
        </span>
      )}
      {added ? (
        <span className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full border border-black px-3 font-semibold">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2.5 6.2l2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Added
        </span>
      ) : confirm ? (
        <span className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={add} className="h-10 rounded-full bg-black px-3 font-semibold text-white">
            Add anyway
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="h-10 rounded-full px-3 font-medium hover:bg-neutral-100">
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onMouseEnter={preview}
          onMouseLeave={clear}
          onFocus={preview}
          onBlur={clear}
          onClick={() => (clashes.length ? setConfirm(true) : add())}
          className="mt-2 inline-flex h-10 items-center rounded-full bg-black px-3.5 font-semibold text-white transition-colors hover:bg-neutral-800"
        >
          {otherSection ? `Switch to section ${sec.section}` : "Add to My Courses"}
        </button>
      )}
    </span>
  );
}
