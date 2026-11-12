"use client";

import { useEffect, useState } from "react";
import { BroddyAvatar } from "@/components/ui/Icons";
import type { Review } from "@/lib/types";

interface Summary {
  pros: string[];
  cons: string[];
  difficulty: string;
  workload: string;
  bestFor: string;
  watchOut: string;
}

const cacheKey = (courseId: string, userReviews: Review[]) =>
  `crai.summary.v1:${courseId}:${userReviews.map((r) => r.id + (r.updatedAt ?? "")).join(",")}`;

/** "Summarize reviews with AI". Cached on the server (memory) and here (sessionStorage). */
export function AiSummaryCard({ courseId, hasReviews, userReviews }: { courseId: string; hasReviews: boolean; userReviews: Review[] }) {
  const key = cacheKey(courseId, userReviews);
  const [state, setState] = useState<{ key: string; summary?: Summary; error?: string; loading?: boolean; via?: string }>({ key });

  // Restore from sessionStorage after hydration.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only cache after mount
      if (raw) setState({ key, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, [key]);

  const current = state.key === key ? state : { key };

  async function run() {
    setState({ key, loading: true });
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, userReviews }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      const value = { summary: json.summary as Summary, via: json.via as string };
      setState({ key, ...value });
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setState({ key, error: (e as Error).message });
    }
  }

  if (!hasReviews) return null;
  const s = current.summary;

  return (
    <section className="mt-8 rounded-2xl border border-black p-5" aria-labelledby="ai-summary-h" aria-busy={current.loading}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ai-summary-h" className="flex items-center gap-2.5 text-base font-bold tracking-tight">
          <BroddyAvatar size={28} />
          AI review summary
        </h2>
        {!s && (
          <button
            type="button"
            onClick={run}
            disabled={current.loading}
            className="h-11 rounded-full bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
          >
            {current.loading ? "Reading reviews…" : current.error ? "Try again" : "Summarize reviews with AI"}
          </button>
        )}
      </div>
      {current.loading && (
        <div className="mt-4 space-y-2" aria-hidden>
          {[80, 65, 72, 50].map((w, i) => (
            <div key={i} className="h-3.5 animate-pulse rounded bg-neutral-100" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
      {current.error && !current.loading && <p className="mt-3 text-sm" role="alert">{current.error}</p>}
      {s && (
        <div className="mt-4 grid gap-5 text-[15px] sm:grid-cols-2">
          <List title="Pros" items={s.pros} mark="+" />
          <List title="Cons" items={s.cons} mark="–" />
          <Line title="Difficulty" text={s.difficulty} />
          <Line title="Workload" text={s.workload} />
          <Line title="Best for" text={s.bestFor} />
          <Line title="Watch out" text={s.watchOut} />
          <p className="text-xs text-neutral-500 sm:col-span-2">
            Generated from the reviews on this page{process.env.NODE_ENV === "development" && current.via ? ` · via ${current.via}` : ""}. Many are sample reviews.
          </p>
        </div>
      )}
    </section>
  );
}

function List({ title, items, mark }: { title: string; items: string[]; mark: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-neutral-500">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="font-bold">
              {mark}
            </span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Line({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-neutral-500">{title}</h3>
      <p className="mt-1">{text}</p>
    </div>
  );
}
