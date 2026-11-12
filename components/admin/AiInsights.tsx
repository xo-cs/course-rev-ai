"use client";

import { useState } from "react";
import { BroddyAvatar } from "@/components/ui/Icons";

interface Insights {
  findings: string[];
  weakCourses: { course: string; complaints: string[] }[];
  actions: string[];
}

/** "Generate report": stats for the current filter + reviews of the 5 weakest courses -> lib/llm.ts. Cached per filter. */
export function AiInsights({ filterKey, stats, weak }: { filterKey: string; stats: unknown; weak: unknown[] }) {
  const storageKey = `crai.insights.v1:${filterKey}`;
  const [state, setState] = useState<{ key: string; data?: Insights; error?: string; loading?: boolean }>({ key: "" });

  const cached = (() => {
    if (state.key === filterKey) return null;
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(storageKey) : null;
      return raw ? (JSON.parse(raw) as Insights) : null;
    } catch {
      return null;
    }
  })();
  const current = state.key === filterKey ? state : { key: filterKey, data: cached ?? undefined };

  async function run() {
    setState({ key: filterKey, loading: true });
    try {
      const res = await fetch("/api/admin/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: filterKey, stats, weak }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setState({ key: filterKey, data: json.insights });
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(json.insights));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setState({ key: filterKey, error: (e as Error).message });
    }
  }

  const d = current.data;
  return (
    <section className="rounded-2xl border-2 border-black p-4 sm:p-5" aria-labelledby="insights-h" aria-busy={current.loading}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="insights-h" className="flex items-center gap-2.5 text-base font-bold tracking-tight">
          <BroddyAvatar size={28} />
          AI insights
        </h2>
        <button
          type="button"
          onClick={run}
          disabled={current.loading}
          className="h-11 rounded-full bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {current.loading ? "Analysing…" : d ? "Regenerate" : "Generate report"}
        </button>
      </div>
      {!d && !current.loading && !current.error && (
        <p className="mt-2 text-sm text-neutral-600">Key findings, main complaints for the 5 weakest courses, and suggested actions for the current filter.</p>
      )}
      {current.loading && (
        <div className="mt-4 space-y-2" aria-hidden>
          {[85, 70, 78, 60, 66].map((w, i) => (
            <div key={i} className="h-3.5 animate-pulse rounded bg-neutral-100" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
      {current.error && !current.loading && (
        <p className="mt-3 text-sm font-medium" role="alert">
          {current.error}
        </p>
      )}
      {d && !current.loading && (
        <div className="mt-4 grid gap-6 text-[15px] lg:grid-cols-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-neutral-500">Key findings</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {d.findings.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-neutral-500">Main complaints, weakest courses</h3>
            <ul className="mt-2 space-y-2">
              {d.weakCourses.map((w, i) => (
                <li key={i}>
                  <p className="font-semibold">{w.course}</p>
                  <p className="text-sm text-neutral-700">{w.complaints.join(" · ")}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-neutral-500">Suggested actions</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {d.actions.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
