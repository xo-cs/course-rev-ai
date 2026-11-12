"use client";

import type { ModerateFn } from "./ReviewForm";

/** AI moderation via /api/moderate. If the check can't run, the review is posted as "pending". */
export const moderateViaApi: ModerateFn = async (input) => {
  try {
    const res = await fetch("/api/moderate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: input.text, tags: input.tags }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { status: "pending" };
    const v = (await res.json()) as { allowed: boolean; pending?: boolean; reason: string; suggestion: string };
    if (v.allowed) return { status: v.pending ? "pending" : "ok" };
    return { status: "blocked", reason: v.reason || "This review breaks the community rules.", suggestion: v.suggestion || "" };
  } catch {
    return { status: "pending" };
  }
};
