"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/reviews/CourseRow";
import { QualityBox } from "@/components/reviews/QualityBox";
import { useShell } from "@/components/shell/ShellContext";
import { BroddyAvatar, IconChevronDown, IconChevronLeft } from "@/components/ui/Icons";
import { broddyContextStore } from "@/lib/broddyStore";
import { formatCredits, formatYears } from "@/lib/courseUtils";
import { initials, reviewerLabel, reviewerMeta, takenLine } from "@/lib/reviewDisplay";
import { reviewsStore } from "@/lib/reviewsStore";
import { getUserId } from "@/lib/profileStore";
import { fmtAvg } from "@/lib/stats";
import { showToast } from "@/lib/toast";
import type { Course, Review } from "@/lib/types";
import { ReviewFormModal } from "./ReviewForm";
import { SectionsTable } from "./SectionsTable";

function getUserIdSafe() {
  return typeof window === "undefined" ? "" : getUserId();
}

/** Deterministic starting "helpful" count for sample reviews so the sort has something to show. */
function sampleHelpfulBase(r: Review) {
  if (!r.isSample) return 0;
  let h = 0;
  for (let i = 0; i < r.id.length; i++) h = (h * 31 + r.id.charCodeAt(i)) >>> 0;
  return h % 9;
}

export function CourseDetail({
  course,
  seedReviews,
  programs,
  summary,
}: {
  course: Course;
  seedReviews: Review[];
  programs: string[];
  summary?: React.ReactNode;
}) {
  const { openBroddy } = useShell();
  const userReviews = reviewsStore.useUserReviews();
  const hidden = reviewsStore.useHidden();
  const [formOpen, setFormOpen] = useState(false);

  const reviews = useMemo(
    () =>
      [...userReviews.filter((r) => r.courseId === course.id), ...seedReviews].filter(
        (r) => !hidden[r.id] && r.moderation !== "hidden",
      ),
    [userReviews, seedReviews, course.id, hidden],
  );
  const hasMine = userReviews.some((r) => r.courseId === course.id && r.authorId === getUserIdSafe());

  const stats = useMemo(() => {
    const n = reviews.length;
    const sum = (k: "rating" | "difficulty" | "workload") => reviews.reduce((s, r) => s + r[k], 0);
    const dist = [1, 2, 3, 4, 5].map((v) => reviews.filter((r) => r.rating === v).length);
    const tagCounts = new Map<string, number>();
    for (const r of reviews) for (const t of r.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return {
      n,
      q: n ? sum("rating") / n : null,
      d: n ? sum("difficulty") / n : null,
      w: n ? sum("workload") / n : null,
      again: n ? Math.round((100 * reviews.filter((r) => r.wouldRecommend).length) / n) : null,
      dist,
      topTags,
    };
  }, [reviews]);

  // Remarks grouped by text: "Sections 001, 002: 2025 Freshman ONLY"
  const remarks = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of course.sections) if (s.remark) m.set(s.remark, [...(m.get(s.remark) ?? []), s.section]);
    return [...m.entries()];
  }, [course.sections]);

  function askBroddy() {
    broddyContextStore.set({ kind: "course", courseId: course.id, label: course.name });
    openBroddy();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-4 sm:px-8 sm:pt-8">
      <Link href="/reviews" className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-sm text-neutral-600 hover:text-black">
        <IconChevronLeft width={16} height={16} /> All courses
      </Link>

      {/* Header */}
      <header className="mt-2 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-neutral-500">
            <span>{course.program}</span>
            <span aria-hidden>·</span>
            <span>{formatYears(course.target_years)}</span>
            <span aria-hidden>·</span>
            <span>{formatCredits(course.credits)}</span>
            {course.type && (
              <>
                <span aria-hidden>·</span>
                <span>{course.type}</span>
              </>
            )}
            {course.mode && (
              <>
                <span aria-hidden>·</span>
                <span>{course.mode}</span>
              </>
            )}
          </div>
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{course.name}</h1>
          {course.name_original && course.name_original !== course.name && (
            <p className="mt-1 text-sm text-neutral-500">{course.name_original}</p>
          )}
          <p className="mt-2 text-lg text-neutral-700">{course.professors.filter(Boolean).join(", ") || "Professor TBA"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {course.track && <Badge solid>Track</Badge>}
            {course.taught_in_korean && <Badge>Taught in Korean</Badge>}
          </div>
        </div>

        {/* Stats: one row on phones, column on the right on larger screens */}
        <div className="flex items-end gap-4 sm:shrink-0 sm:gap-6">
          <QualityBox value={stats.q} count={stats.n} />
          <dl className="grid grid-cols-3 gap-3 sm:grid-cols-1 sm:gap-2">
            <Stat label="Difficulty" value={fmtAvg(stats.d)} />
            <Stat label="Workload" value={fmtAvg(stats.w)} />
            <Stat label="Take again" value={stats.again == null ? "N/A" : `${stats.again}%`} />
          </dl>
        </div>
      </header>

      {/* Eligibility */}
      {(remarks.length > 0 || course.track) && (
        <section aria-label="Eligibility notes" className="mt-6 rounded-2xl border-2 border-black p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.06em]">
            <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-black text-xs text-white">
              !
            </span>
            Before you register
          </h2>
          <ul className="mt-2 space-y-1.5 text-[15px]">
            {course.track && (
              <li>
                Only for students registered in the <strong>{course.track}</strong>.
              </li>
            )}
            {remarks.map(([text, secs]) => (
              <li key={text}>
                <span className="text-neutral-500">
                  {course.sections.length > 1 ? `Section${secs.length > 1 ? "s" : ""} ${secs.join(", ")}: ` : ""}
                </span>
                <strong className="font-semibold">{text}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Actions */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex">
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="h-12 whitespace-nowrap rounded-full bg-black px-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 sm:px-6 sm:text-[15px]"
        >
          {hasMine ? "Edit your review" : "Rate this course"}
        </button>
        <button
          type="button"
          onClick={askBroddy}
          className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-black pl-2 pr-4 text-sm font-semibold transition-colors hover:bg-neutral-100 sm:pr-5 sm:text-[15px]"
        >
          <BroddyAvatar size={30} />
          Ask Broddy
        </button>
      </div>

      {/* Distribution + tags */}
      {stats.n > 0 && (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 p-5" aria-label="Quality rating distribution">
            <h2 className="text-sm font-semibold">Rating distribution</h2>
            <ul className="mt-3 space-y-2">
              {[5, 4, 3, 2, 1].map((v) => {
                const count = stats.dist[v - 1];
                const pct = stats.n ? (count / stats.n) * 100 : 0;
                return (
                  <li key={v} className="flex items-center gap-3 text-sm">
                    <span className="w-3 font-semibold tabular-nums">{v}</span>
                    <span className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <span className="block h-full origin-left rounded-full bg-black" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-6 text-right tabular-nums text-neutral-600">{count}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="rounded-2xl border border-neutral-200 p-5" aria-label="Most mentioned tags">
            <h2 className="text-sm font-semibold">What students mention</h2>
            {stats.topTags.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {stats.topTags.map(([t, c]) => (
                  <li key={t} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-300 px-3 text-sm">
                    {t}
                    <span className="text-xs font-semibold tabular-nums text-neutral-500">{c}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">No tags yet.</p>
            )}
          </section>
        </div>
      )}

      {summary}

      {/* Sections */}
      <section className="mt-10" aria-labelledby="sections-h">
        <h2 id="sections-h" className="mb-3 text-xl font-bold tracking-tight">
          Sections
        </h2>
        <SectionsTable course={course} />
      </section>

      {/* Comments */}
      <ReviewList reviews={reviews} onWrite={() => setFormOpen(true)} />

      <ReviewFormModal
        course={{ id: course.id, name: course.name, sections: course.sections }}
        programs={programs}
        open={formOpen}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:text-right">
      <dt className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.03em] text-neutral-500 sm:tracking-[0.08em]">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

type ReviewSort = "newest" | "highest" | "helpful";

function ReviewList({ reviews, onWrite }: { reviews: Review[]; onWrite: () => void }) {
  const helpful = reviewsStore.useHelpfulCounts();
  const marked = reviewsStore.useMarkedHelpful();
  const [prof, setProf] = useState("");
  const [sort, setSort] = useState<ReviewSort>("newest");

  const profs = useMemo(() => [...new Set(reviews.map((r) => r.professor))].sort(), [reviews]);
  const helpfulOf = (r: Review) => sampleHelpfulBase(r) + (helpful[r.id] ?? 0);

  const shown = useMemo(() => {
    const list = reviews.filter((r) => !prof || r.professor === prof);
    const cmp: Record<ReviewSort, (a: Review, b: Review) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      highest: (a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt),
      helpful: (a, b) => helpfulOf(b) - helpfulOf(a) || b.createdAt.localeCompare(a.createdAt),
    };
    return list.sort(cmp[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews, prof, sort, helpful]);

  return (
    <section className="mt-12" aria-labelledby="comments-h">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3">
        <h2 id="comments-h" className="text-xl font-bold tracking-tight">
          Comments <span className="font-normal text-neutral-500 tabular-nums">({reviews.length})</span>
        </h2>
        {reviews.length > 0 && (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <SmallSelect label="Filter by professor" value={prof} onChange={setProf}>
              <option value="">All professors</option>
              {profs.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </SmallSelect>
            <SmallSelect label="Sort comments" value={sort} onChange={(v) => setSort(v as ReviewSort)}>
              <option value="newest">Newest</option>
              <option value="highest">Highest rated</option>
              <option value="helpful">Most helpful</option>
            </SmallSelect>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-lg font-semibold">No reviews yet.</p>
          <p className="mt-1 text-sm text-neutral-500">Took this course? Help the next student out.</p>
          <button type="button" onClick={onWrite} className="mt-4 h-11 rounded-full bg-black px-5 text-sm font-semibold text-white">
            Write the first review
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200">
          {shown.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              helpfulCount={helpfulOf(r)}
              isMarked={Boolean(marked[r.id])}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewCard({ review: r, helpfulCount, isMarked }: { review: Review; helpfulCount: number; isMarked: boolean }) {
  const date = new Date(r.createdAt + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const mine = !r.isSample && r.authorId === getUserIdSafe();
  const label = reviewerLabel(r);
  const anon = label === "Anonymous student";
  const meta = reviewerMeta(r);
  return (
    <li className="flex flex-col gap-4 py-6 sm:flex-row sm:gap-6">
      <div className="flex shrink-0 gap-3 sm:flex-col">
        <MiniBox label="Quality" value={r.rating} solid />
        <MiniBox label="Difficulty" value={r.difficulty} />
      </div>
      <div className="min-w-0 flex-1">
        {/* Line 1: who wrote it */}
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              anon ? "border border-dashed border-neutral-400 text-neutral-500" : "bg-neutral-900 text-white"
            }`}
          >
            {anon ? "?" : initials(label)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-tight">
              <span className="font-semibold">{label}</span>
              {meta && <span className="text-neutral-500"> · {meta}</span>}
            </p>
            {/* Line 2: how they took it */}
            <p className="mt-1 text-[13px] text-neutral-500">{takenLine(r)}</p>
          </div>
          <span className="shrink-0 pt-0.5 text-xs text-neutral-500">{date}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {r.isSample && (
            <span className="inline-flex h-6 items-center rounded-md border border-dashed border-neutral-400 px-2 font-medium text-neutral-600">
              Sample review
            </span>
          )}
          {mine && <span className="inline-flex h-6 items-center rounded-md bg-black px-2 font-semibold text-white">Your review</span>}
          {mine && r.anonymous && (
            <span className="inline-flex h-6 items-center rounded-md border border-black px-2 font-medium">Posted anonymously</span>
          )}
          {r.moderation === "pending" && (
            <span className="inline-flex h-6 items-center rounded-md border border-black px-2 font-medium">Pending check</span>
          )}
          <span className="inline-flex h-6 items-center rounded-md bg-neutral-100 px-2 font-medium">
            Would take again: {r.wouldRecommend ? "Yes" : "No"}
          </span>
          <span className="inline-flex h-6 items-center rounded-md bg-neutral-100 px-2 font-medium tabular-nums">Workload {r.workload}/5</span>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-900">{r.text}</p>
        {r.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {r.tags.map((t) => (
              <li key={t} className="inline-flex h-7 items-center rounded-full border border-neutral-300 px-2.5 text-xs">
                {t}
              </li>
            ))}
          </ul>
        )}
        <div className="-ml-1 mt-3 flex flex-wrap items-center gap-1">
          <button
            type="button"
            aria-pressed={isMarked}
            onClick={() => reviewsStore.toggleHelpful(r.id)}
            className={`inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors ${
              isMarked ? "bg-black text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-black"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7 10v11H4V10zM7 10l4-7a2.5 2.5 0 012.5 2.5V9h5.2a2 2 0 012 2.3l-1.3 7.5a2 2 0 01-2 1.7H7" />
            </svg>
            Helpful <span className="tabular-nums">{helpfulCount}</span>
          </button>
          {!mine && <ReportButton reviewId={r.id} />}
        </div>
      </div>
    </li>
  );
}

const REPORT_REASONS = ["Insulting or a personal attack", "Hate or harassment", "Spam or off-topic", "Private information", "Other"];

function ReportButton({ reviewId }: { reviewId: string }) {
  const reported = reviewsStore.useReportedByMe()[reviewId];
  const [open, setOpen] = useState(false);
  if (reported) {
    return <span className="inline-flex h-11 items-center px-3 text-sm text-neutral-500">Reported. Thanks</span>;
  }
  return (
    <span className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-black"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 21V4h11l-1.5 4L16 12H5" />
        </svg>
        Report
      </button>
      {open && (
        <span
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-1 w-64 animate-fade-up rounded-xl border border-black bg-white p-1 shadow-xl"
        >
          <span className="block px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.06em] text-neutral-500">Why are you reporting?</span>
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              role="menuitem"
              onClick={() => {
                reviewsStore.report(reviewId, reason);
                setOpen(false);
                showToast("Thanks, the university team will review it.");
              }}
              className="flex h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-neutral-100"
            >
              {reason}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function MiniBox({ label, value, solid = false }: { label: string; value: number; solid?: boolean }) {
  return (
    <div className="flex items-center gap-2 sm:flex-col sm:items-center sm:gap-1">
      <span
        className={`flex size-12 items-center justify-center rounded-xl text-xl font-bold tabular-nums ${
          solid ? "bg-black text-white" : "border border-black"
        }`}
        aria-label={`${label} ${value} out of 5`}
      >
        {value}.0
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{label}</span>
    </div>
  );
}

function SmallSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <span className="relative block min-w-0">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full cursor-pointer appearance-none truncate rounded-full border border-neutral-300 bg-white pl-3.5 pr-8 text-base font-medium hover:border-black sm:h-10 sm:w-auto sm:text-sm"
      >
        {children}
      </select>
      <IconChevronDown width={16} height={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
    </span>
  );
}
