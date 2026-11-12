"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { courseHref } from "@/lib/courseUtils";
import { reviewsStore } from "@/lib/reviewsStore";
import type { Review } from "@/lib/types";
import type { AdminCourse } from "./AdminDashboard";

type Sort = "newest" | "reported" | "lowest";
const PAGE = 50;

/** Admin moderation table. Admin always sees the real reviewer name. */
export function ReviewsTable({
  reviews,
  courseById,
  hidden,
  reports,
}: {
  reviews: Review[];
  courseById: Map<string, AdminCourse>;
  hidden: Record<string, true>;
  reports: Record<string, { count: number; reasons: string[] }>;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [status, setStatus] = useState<"" | "hidden" | "pending" | "reported">("");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const statusOf = (r: Review) => (hidden[r.id] || r.moderation === "hidden" ? "hidden" : r.moderation === "pending" ? "pending" : "ok");
    const list = reviews.filter((r) => {
      if (status === "hidden" && statusOf(r) !== "hidden") return false;
      if (status === "pending" && statusOf(r) !== "pending") return false;
      if (status === "reported" && !reports[r.id]) return false;
      if (!needle) return true;
      const c = courseById.get(r.courseId);
      return `${r.reviewer.name ?? ""} ${c?.name ?? ""} ${r.text}`.toLowerCase().includes(needle);
    });
    const cmp: Record<Sort, (a: Review, b: Review) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      reported: (a, b) => (reports[b.id]?.count ?? 0) - (reports[a.id]?.count ?? 0) || b.createdAt.localeCompare(a.createdAt),
      lowest: (a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt),
    };
    return list.sort(cmp[sort]).map((r) => ({ r, status: statusOf(r) }));
  }, [reviews, q, sort, status, hidden, reports, courseById]);

  return (
    <div className="mt-5">
      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Search reviewer, course or text"
          aria-label="Search reviews"
          className="h-11 rounded-full border border-neutral-300 px-4 text-base sm:w-80 sm:text-sm"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status" className="h-11 rounded-full border border-neutral-300 px-3 text-base sm:text-sm">
            <option value="">All statuses</option>
            <option value="reported">Reported</option>
            <option value="pending">Pending check</option>
            <option value="hidden">Hidden</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="h-11 rounded-full border border-neutral-300 px-3 text-base sm:text-sm">
            <option value="newest">Newest</option>
            <option value="reported">Most reported</option>
            <option value="lowest">Lowest quality</option>
          </select>
        </div>
        <span className="text-sm text-neutral-500 sm:ml-auto">{rows.length} reviews</span>
      </div>

      <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
        {rows.slice(0, limit).map(({ r, status: st }) => {
          const c = courseById.get(r.courseId);
          const rep = reports[r.id];
          const isHidden = st === "hidden";
          return (
            <li key={r.id} className={`grid gap-3 py-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_64px_120px_auto] sm:items-center ${isHidden ? "opacity-60" : ""}`}>
              <div className="min-w-0">
                <p className="font-semibold">{r.reviewer.name ?? "Unknown"}</p>
                <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
                  {r.anonymous && <span className="rounded-md border border-black px-1.5 py-0.5 font-medium">Posted anonymously</span>}
                  {r.isSample && <span className="rounded-md border border-dashed border-neutral-400 px-1.5 py-0.5 text-neutral-600">Sample</span>}
                  <span className="py-0.5 text-neutral-500">{r.createdAt}</span>
                </p>
              </div>
              <div className="min-w-0">
                <Link href={courseHref(r.courseId)} className="font-medium hover:underline">
                  {c?.name ?? r.courseId}
                </Link>
                <p className="mt-0.5 line-clamp-2 text-sm text-neutral-600">{r.text}</p>
              </div>
              <span className="inline-flex h-8 w-11 items-center justify-center rounded-lg bg-black font-bold tabular-nums text-white" aria-label={`Quality ${r.rating}`}>
                {r.rating}
              </span>
              <div className="text-sm">
                <p className="font-semibold">{st === "hidden" ? "Hidden" : st === "pending" ? "Pending check" : "Approved"}</p>
                <p className="text-neutral-500" title={rep?.reasons.join(", ")}>
                  {rep ? `${rep.count} report${rep.count === 1 ? "" : "s"}` : "No reports"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => reviewsStore.setHidden(r.id, !isHidden)}
                className={`h-11 justify-self-start rounded-full px-4 text-sm font-semibold sm:justify-self-end ${isHidden ? "bg-black text-white" : "border border-black hover:bg-neutral-100"}`}
              >
                {isHidden ? "Unhide" : "Hide"}
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length > limit && (
        <button type="button" onClick={() => setLimit(limit + PAGE)} className="mt-4 h-11 rounded-full border border-black px-5 text-sm font-semibold">
          Show more
        </button>
      )}
      <p className="mt-4 text-xs text-neutral-500">
        Hidden reviews disappear for students (in this browser, for the demo). Reports come from the Report button on review cards.
      </p>
    </div>
  );
}
