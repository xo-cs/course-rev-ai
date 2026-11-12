"use client";

import Link from "next/link";
import { useState } from "react";
import { chatStore, type ChatMessage } from "@/lib/chatStore";
import { remainingOf, totals, type CreditCategory } from "@/lib/credits";
import { profileStore } from "@/lib/profileStore";

/** Editable credits table inside Broddy's bubble. Nothing is saved until the student confirms. */
export function CreditsEditor({ message }: { message: ChatMessage }) {
  const data = message.credits!;
  const [rows, setRows] = useState<CreditCategory[]>(data.categories);
  const editable = data.status === "draft";
  const t = totals(rows);

  const update = (i: number, patch: Partial<CreditCategory>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const num = (v: string) => Math.max(0, Math.min(300, Math.round(Number(v) || 0)));

  function confirm() {
    const clean = rows.filter((r) => r.name.trim()).map((r) => ({ ...r, name: r.name.trim(), earned: Math.min(r.earned, 300) }));
    if (!clean.length) return;
    profileStore.set({ ...profileStore.get(), credits: { categories: clean, confirmedAt: new Date().toISOString() } });
    chatStore.updateMessage(message.id, { credits: { categories: clean, status: "saved" } });
    const left = totals(clean).remaining;
    const gaps = clean
      .filter((c) => remainingOf(c) > 0)
      .sort((a, b) => remainingOf(b) - remainingOf(a))
      .slice(0, 3)
      .map((c) => `**${remainingOf(c)} ${c.name}**`);
    chatStore.say(
      `Saved! You have **${left} credits** left to graduate${gaps.length ? `, mostly ${gaps.join(", ")}` : ""}. Ask me "What should I take next?" and I'll plan around it.`,
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-neutral-300 bg-white text-[13px]">
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-[11px] uppercase tracking-[0.05em] text-neutral-500">
            <th className="py-1.5 pl-2.5 font-semibold">Category</th>
            <th className="w-[3.4rem] py-1.5 text-center font-semibold">Req.</th>
            <th className="w-[3.4rem] py-1.5 text-center font-semibold">Earned</th>
            <th className="w-[2.6rem] py-1.5 pr-2 text-right font-semibold">Left</th>
            {editable && <th className="w-7" aria-label="Remove" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-1 pl-2.5 pr-1">
                {editable ? (
                  <input
                    value={r.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    aria-label={`Category ${i + 1} name`}
                    className="h-8 w-full min-w-0 rounded-md border border-transparent px-1 hover:border-neutral-300 focus:border-black"
                  />
                ) : (
                  <span className="block truncate px-1">{r.name}</span>
                )}
              </td>
              {(["required", "earned"] as const).map((k) => (
                <td key={k} className="px-0.5 py-1 text-center">
                  {editable ? (
                    <input
                      inputMode="numeric"
                      value={r[k]}
                      onChange={(e) => update(i, { [k]: num(e.target.value) })}
                      aria-label={`${r.name || "Category"} ${k}`}
                      className="h-8 w-full rounded-md border border-neutral-300 text-center tabular-nums focus:border-black"
                    />
                  ) : (
                    <span className="tabular-nums">{r[k]}</span>
                  )}
                </td>
              ))}
              <td className="py-1 pr-2 text-right font-semibold tabular-nums">{remainingOf(r)}</td>
              {editable && (
                <td className="py-1 text-center">
                  <button
                    type="button"
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    className="size-7 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-black"
                    aria-label={`Remove ${r.name || "row"}`}
                  >
                    ×
                  </button>
                </td>
              )}
            </tr>
          ))}
          <tr className="bg-neutral-50 font-semibold">
            <td className="py-1.5 pl-3.5">Total</td>
            <td className="text-center tabular-nums">{t.required}</td>
            <td className="text-center tabular-nums">{t.earned}</td>
            <td className="pr-2 text-right tabular-nums">{t.remaining}</td>
            {editable && <td />}
          </tr>
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 p-2">
        {data.status === "draft" && (
          <>
            <button type="button" onClick={confirm} className="h-10 rounded-full bg-black px-4 font-semibold text-white hover:bg-neutral-800">
              Confirm and save
            </button>
            <button type="button" onClick={() => setRows([...rows, { name: "", required: 0, earned: 0 }])} className="h-10 rounded-full px-3 font-medium hover:bg-neutral-100">
              Add row
            </button>
            <button
              type="button"
              onClick={() => chatStore.updateMessage(message.id, { credits: { ...data, status: "discarded" } })}
              className="h-10 rounded-full px-3 text-neutral-600 underline underline-offset-4 hover:text-black"
            >
              Discard
            </button>
          </>
        )}
        {data.status === "saved" && (
          <p className="flex items-center gap-2 px-1 py-1.5">
            <span className="font-semibold">Saved to your profile.</span>
            <Link href="/courses" className="underline underline-offset-4">
              See graduation progress
            </Link>
          </p>
        )}
        {data.status === "discarded" && <p className="px-1 py-1.5 text-neutral-500">Discarded. Nothing was saved.</p>}
      </div>
    </div>
  );
}
