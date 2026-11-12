"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useShell } from "@/components/shell/ShellContext";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { chatStore } from "@/lib/chatStore";
import { courseHref } from "@/lib/courseUtils";
import { myCoursesStore, type MyCourse } from "@/lib/myCoursesStore";
import { dismissedContextStore, pageCourseStore } from "@/lib/pageContext";
import { planPreviewStore, previewStore, type PreviewSection } from "@/lib/previewStore";
import { findAllClashes, toMinutes } from "@/lib/schedule";
import { showToast } from "@/lib/toast";
import type { Day, Slot } from "@/lib/types";
import { ClashBanner } from "./ClashBanner";

const START_H = 8;
const END_H = 21;
const HOUR_PX = 54;
const ALL_DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const JS_DAY: Day[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Item {
  key: string;
  courseId: string;
  name: string;
  section: string;
  room: string;
  day: Day;
  start: number;
  end: number;
  slot: Slot;
  ghost: boolean;
  hovered: boolean;
  clash: boolean;
  course?: MyCourse;
  ghost_?: PreviewSection;
}

interface Placed extends Item {
  col: number;
  cols: number;
}

/** Side-by-side layout for overlapping blocks in one day (interval clusters + greedy columns). */
function layoutDay(items: Item[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  let colEnds: number[] = [];
  const close = () => {
    for (const p of cluster) p.cols = colEnds.length;
    out.push(...cluster);
    cluster = [];
    colEnds = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.start >= clusterEnd) close();
    let col = colEnds.findIndex((end) => end <= it.start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(it.end);
    } else colEnds[col] = it.end;
    cluster.push({ ...it, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  close();
  return out;
}

const noop = () => () => {};
const fmt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function WeekCalendar() {
  const mine = myCoursesStore.useAll();
  const hovered = previewStore.useValue();
  const planPreview = planPreviewStore.useValue();
  const messages = chatStore.useMessages();
  const { openBroddy } = useShell();
  const todayIdx = useSyncExternalStore(noop, () => new Date().getDay(), () => -1);
  const today = todayIdx >= 0 ? JS_DAY[todayIdx] : null;
  const [picked, setPicked] = useState<Day | null>(null);
  const [selected, setSelected] = useState<{ item: Item; rect: DOMRect; sheet: boolean } | null>(null);

  // Ghosts: the hovered section + sections Broddy suggested in its latest reply (not yet added).
  const ghosts = useMemo(() => {
    const list: (PreviewSection & { hovered: boolean })[] = [];
    const lastBot = [...messages].reverse().find((m) => m.role === "assistant");
    for (const s of Object.values(lastBot?.secs ?? {})) {
      if (!lastBot!.text.includes(`[[add:${s.courseId}:${s.section}]]`)) continue;
      const ref = lastBot!.refs?.[s.courseId];
      list.push({
        courseId: s.courseId,
        name: ref?.name ?? s.courseId,
        section: s.section,
        room: s.room,
        slots: s.slots,
        professor: s.professor,
        credits: ref?.credits ?? null,
        scheduleText: s.scheduleText,
        hovered: false,
      });
    }
    // A hovered/tapped plan card replaces the other previews.
    if (planPreview.length) return planPreview.map((g) => ({ ...g, hovered: true })).filter((g) => !mine.some((m) => m.courseId === g.courseId && m.section === g.section));
    if (hovered) {
      const existing = list.find((g) => g.courseId === hovered.courseId && g.section === hovered.section);
      if (existing) existing.hovered = true;
      else list.push({ ...hovered, hovered: true });
    }
    return list.filter((g) => !mine.some((m) => m.courseId === g.courseId && m.section === g.section));
  }, [messages, hovered, mine, planPreview]);

  const clashes = useMemo(() => findAllClashes(mine), [mine]);

  const items = useMemo(() => {
    const out: Item[] = [];
    for (const c of mine)
      c.slots.forEach((slot, i) =>
        out.push({
          key: `${c.courseId}:${c.section}:${i}`,
          courseId: c.courseId,
          name: c.name,
          section: c.section,
          room: c.room,
          day: slot.day,
          start: toMinutes(slot.start),
          end: toMinutes(slot.end),
          slot,
          ghost: false,
          hovered: false,
          clash: false,
          course: c,
        }),
      );
    // Mark real courses that overlap another real course.
    for (const a of out)
      a.clash = out.some((b) => b !== a && b.courseId !== a.courseId && b.day === a.day && a.start < b.end && b.start < a.end);
    for (const g of ghosts)
      g.slots.forEach((slot, i) =>
        out.push({
          key: `ghost:${g.courseId}:${g.section}:${i}`,
          courseId: g.courseId,
          name: g.name,
          section: g.section,
          room: g.room,
          day: slot.day,
          start: toMinutes(slot.start),
          end: toMinutes(slot.end),
          slot,
          ghost: true,
          hovered: g.hovered,
          clash: false,
          ghost_: g,
        }),
      );
    return out;
  }, [mine, ghosts]);

  const days = ALL_DAYS.filter((d, i) => i < 5 || items.some((it) => it.day === d));
  const activeDay = picked && days.includes(picked) ? picked : today && days.includes(today) ? today : days[0];
  const tba = mine.filter((c) => c.slots.length === 0);
  const byDay = useMemo(() => Object.fromEntries(days.map((d) => [d, layoutDay(items.filter((it) => it.day === d))])), [days, items]) as Record<
    Day,
    Placed[]
  >;

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  function open(item: Item, el: HTMLElement) {
    setSelected({ item, rect: el.getBoundingClientRect(), sheet: window.matchMedia("(max-width: 639.98px)").matches });
  }

  function askBroddy(item: Item) {
    pageCourseStore.set({ courseId: item.courseId, label: item.name });
    dismissedContextStore.set(null);
    setSelected(null);
    openBroddy();
  }

  return (
    <div>
      <ClashBanner clashes={clashes} className="mb-4" />

      {/* Phones: one day at a time */}
      <div className="mb-3 grid gap-1 sm:hidden" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Day">
        {days.map((d) => {
          const on = d === activeDay;
          const count = items.filter((it) => it.day === d && !it.ghost).length;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setPicked(d)}
              className={`flex h-12 flex-col items-center justify-center rounded-xl text-sm font-semibold ${on ? "bg-black text-white" : d === today ? "bg-neutral-100" : ""}`}
            >
              {d}
              <span className={`mt-0.5 size-1.5 rounded-full ${count ? (on ? "bg-white" : "bg-black") : "bg-transparent"}`} aria-hidden />
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200">
        {/* Day headers (tablet / desktop) */}
        <div className="hidden border-b border-neutral-200 sm:flex">
          <div className="w-14 shrink-0" />
          {days.map((d) => (
            <div
              key={d}
              className={`flex-1 border-l border-neutral-200 py-2.5 text-center text-sm font-semibold ${d === today ? "bg-neutral-100" : ""}`}
            >
              {d}
              {d === today && <span className="ml-1.5 text-[11px] font-medium text-neutral-500">Today</span>}
            </div>
          ))}
        </div>

        <div className="relative flex" style={{ height: (END_H - START_H) * HOUR_PX }}>
          {/* Hour labels */}
          <div className="relative w-14 shrink-0" aria-hidden>
            {Array.from({ length: END_H - START_H }, (_, i) => (
              <span key={i} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-neutral-500" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : `${String(START_H + i).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>

          {days.map((d) => (
            <div
              key={d}
              className={`relative flex-1 border-l border-neutral-200 ${d === activeDay ? "" : "hidden sm:block"} ${d === today ? "bg-neutral-50" : ""}`}
              style={{
                backgroundImage: "linear-gradient(to bottom, var(--color-neutral-200) 1px, transparent 1px)",
                backgroundSize: `100% ${HOUR_PX}px`,
              }}
              aria-label={`${d} schedule`}
            >
              {byDay[d]?.map((it) => (
                <Block key={it.key} it={it} onOpen={open} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {mine.length === 0 && (
        <p className="mt-4 text-center text-[15px] text-neutral-600">
          No courses on your calendar yet.{" "}
          <Link href="/reviews" className="font-semibold text-black underline underline-offset-4">
            Browse reviews
          </Link>{" "}
          or ask Broddy to suggest some.
        </p>
      )}

      {tba.length > 0 && (
        <section className="mt-6" aria-labelledby="tba-h">
          <h2 id="tba-h" className="text-sm font-semibold uppercase tracking-[0.06em] text-neutral-500">
            Schedule TBA
          </h2>
          <ul className="mt-2 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
            {tba.map((c) => (
              <li key={c.courseId} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link href={courseHref(c.courseId)} className="font-medium hover:underline">
                  {c.name}
                </Link>
                <span className="text-sm text-neutral-500">Section {c.section}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Details: popover on desktop, bottom sheet on phones */}
      {selected && !selected.sheet && (
        <>
          <button type="button" aria-label="Close details" className="fixed inset-0 z-40 cursor-default" onClick={() => setSelected(null)} />
          <div
            role="dialog"
            aria-label={`${selected.item.name} details`}
            className="fixed z-50 w-72 animate-fade-up rounded-2xl border border-black bg-white p-4 shadow-2xl"
            style={popoverPos(selected.rect)}
          >
            <Details item={selected.item} clashes={clashes} onAsk={askBroddy} onDone={() => setSelected(null)} />
          </div>
        </>
      )}
      <BottomSheet open={Boolean(selected?.sheet)} onClose={() => setSelected(null)} title={selected?.item.name ?? ""}>
        {selected && <Details item={selected.item} clashes={clashes} onAsk={askBroddy} onDone={() => setSelected(null)} hideTitle />}
      </BottomSheet>
    </div>
  );
}

function popoverPos(r: DOMRect): React.CSSProperties {
  const W = 288;
  const left = r.right + 8 + W < window.innerWidth ? r.right + 8 : Math.max(8, r.left - 8 - W);
  const top = Math.min(Math.max(8, r.top), window.innerHeight - 320);
  return { left, top };
}

function Block({ it, onOpen }: { it: Placed; onOpen: (it: Item, el: HTMLElement) => void }) {
  const top = ((it.start - START_H * 60) / 60) * HOUR_PX;
  const height = Math.max(22, ((it.end - it.start) / 60) * HOUR_PX - 2);
  const width = 100 / it.cols;
  const base =
    "absolute overflow-hidden rounded-lg px-2 py-1 text-left text-[12px] leading-tight transition-[transform,opacity] duration-150 hover:z-10 focus-visible:z-10";
  const style = it.ghost
    ? `border-2 border-dashed ${it.hovered ? "border-black bg-white" : "border-neutral-500 bg-white/80"} text-neutral-800`
    : it.clash
      ? "border-[3px] border-black text-black [background-image:var(--hatch)] bg-white"
      : "bg-black text-white hover:bg-neutral-800";
  return (
    <button
      type="button"
      onClick={(e) => onOpen(it, e.currentTarget)}
      className={`${base} ${style}`}
      style={{ top, height, left: `calc(${it.col * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
      aria-label={`${it.ghost ? "Preview: " : ""}${it.name}, section ${it.section}, ${it.day} ${fmt(it.start)} to ${fmt(it.end)}${it.room ? `, room ${it.room}` : ""}${it.clash ? ", clashes with another course" : ""}`}
    >
      <span className={it.clash ? "block rounded bg-white/95 px-1 py-0.5" : "block"}>
        {(it.clash || it.ghost) && (
          <span className={`mb-0.5 mr-1 inline-block rounded px-1 text-[9px] font-bold uppercase tracking-wider ${it.ghost ? "border border-current" : "bg-black text-white"}`}>
            {it.ghost ? "Preview" : "Clash"}
          </span>
        )}
        <span className={`block font-semibold [overflow-wrap:break-word] [hyphens:auto] ${it.cols > 1 ? "text-[11px]" : ""}`} lang="en">
          {it.name}
        </span>
        <span className="block opacity-80">
          {it.section}
          {it.room && it.cols === 1 ? ` · ${it.room}` : ""}
        </span>
        {height > 64 && it.cols === 1 && (
          <span className="block tabular-nums opacity-70">
            {fmt(it.start)}–{fmt(it.end)}
          </span>
        )}
      </span>
    </button>
  );
}

function Details({
  item,
  clashes,
  onAsk,
  onDone,
  hideTitle = false,
}: {
  item: Item;
  clashes: ReturnType<typeof findAllClashes>;
  onAsk: (it: Item) => void;
  onDone: () => void;
  hideTitle?: boolean;
}) {
  const c = item.course;
  const mine = clashes.filter((x) => x.a.courseId === item.courseId || x.b.courseId === item.courseId);
  return (
    <div className="space-y-3 text-[15px]">
      {!hideTitle && (
        <div>
          {item.ghost && <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Preview</p>}
          <p className="text-lg font-semibold leading-snug">{item.name}</p>
        </div>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-neutral-500">Section</dt>
        <dd>{item.section}</dd>
        <dt className="text-neutral-500">When</dt>
        <dd>{c?.scheduleText || `${item.day} ${fmt(item.start)}–${fmt(item.end)}`}</dd>
        <dt className="text-neutral-500">Room</dt>
        <dd>{item.room || "TBA"}</dd>
        {c && (
          <>
            <dt className="text-neutral-500">Professor</dt>
            <dd>{c.professor || "TBA"}</dd>
            <dt className="text-neutral-500">Credits</dt>
            <dd>{c.credits ?? "TBA"}</dd>
          </>
        )}
      </dl>
      {mine.length > 0 && (
        <p className="rounded-lg border-2 border-black px-3 py-2 text-sm">
          <strong>Clash:</strong>{" "}
          {mine.map((x) => (x.a.courseId === item.courseId ? x.b.name : x.a.name) + ` (${x.day} ${x.start}–${x.end})`).join("; ")}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Link href={courseHref(item.courseId)} className="inline-flex h-11 items-center rounded-full bg-black px-4 text-sm font-semibold text-white">
          Course page
        </Link>
        <button type="button" onClick={() => onAsk(item)} className="h-11 rounded-full border border-black px-4 text-sm font-semibold hover:bg-neutral-100">
          Ask Broddy
        </button>
        {c ? (
          <button
            type="button"
            onClick={() => {
              myCoursesStore.remove(item.courseId);
              showToast(`Removed ${item.name}`);
              onDone();
            }}
            className="h-11 rounded-full px-3 text-sm text-neutral-600 underline underline-offset-4 hover:text-black"
          >
            Remove
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              const g = item.ghost_;
              const slots = g?.slots ?? [item.slot];
              myCoursesStore.add({
                courseId: item.courseId,
                name: item.name,
                section: item.section,
                slots,
                professor: g?.professor ?? "",
                room: item.room,
                scheduleText: g?.scheduleText || slots.map((s) => `${s.day}. ${s.start}~${s.end}`).join(", "),
                credits: g?.credits ?? null,
                addedAt: new Date().toISOString(),
              });
              showToast(`Added ${item.name} · ${item.section}`);
              onDone();
            }}
            className="h-11 rounded-full border border-black px-4 text-sm font-semibold hover:bg-neutral-100"
          >
            Add to My Courses
          </button>
        )}
      </div>
    </div>
  );
}
