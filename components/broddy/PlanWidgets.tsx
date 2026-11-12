"use client";

import { useRouter } from "next/navigation";
import { useShell } from "@/components/shell/ShellContext";
import { useState } from "react";
import { chatStore, type ChatMessage } from "@/lib/chatStore";
import { myCoursesStore } from "@/lib/myCoursesStore";
import type { Plan, PlanPrefs } from "@/lib/planner";
import { planPreviewStore } from "@/lib/previewStore";
import { clashesWith } from "@/lib/schedule";
import { showToast } from "@/lib/toast";

const OPTIONS = {
  credits: [12, 15, 18, 21],
  dayOff: [
    ["none", "None"],
    ["Mon", "Mon"],
    ["Fri", "Fri"],
  ],
  style: [
    ["light", "Light"],
    ["balanced", "Balanced"],
    ["challenging", "Challenging"],
  ],
} as const;

export function PlanPicker({ message }: { message: ChatMessage }) {
  const init = message.planPicker!;
  const [p, setP] = useState<Partial<PlanPrefs>>(init);
  const done = Boolean(init.done);
  const ready = p.credits && p.dayOff && p.style;
  const chip = (on: boolean) =>
    `h-10 min-w-11 rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? "border-black bg-black text-white" : "border-neutral-300 bg-white hover:border-black"}`;

  return (
    <div className="mt-2 space-y-2.5 rounded-xl border border-neutral-300 bg-white p-2.5 text-[13px]">
      <Row label="Target credits">
        {OPTIONS.credits.map((c) => (
          <button key={c} type="button" disabled={done} aria-pressed={p.credits === c} onClick={() => setP((x) => ({ ...x, credits: c }))} className={chip(p.credits === c)}>
            {c}
          </button>
        ))}
      </Row>
      <Row label="Day off">
        {OPTIONS.dayOff.map(([v, l]) => (
          <button key={v} type="button" disabled={done} aria-pressed={p.dayOff === v} onClick={() => setP((x) => ({ ...x, dayOff: v }))} className={chip(p.dayOff === v)}>
            {l}
          </button>
        ))}
      </Row>
      <Row label="Style">
        {OPTIONS.style.map(([v, l]) => (
          <button key={v} type="button" disabled={done} aria-pressed={p.style === v} onClick={() => setP((x) => ({ ...x, style: v }))} className={chip(p.style === v)}>
            {l}
          </button>
        ))}
      </Row>
      {!done && (
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            chatStore.updateMessage(message.id, { planPicker: { ...p, done: true } });
            void chatStore.buildPlans(p as PlanPrefs);
          }}
          className="h-10 w-full rounded-full bg-black font-semibold text-white disabled:bg-neutral-300"
        >
          {ready ? "Build my plans" : "Pick all three"}
        </button>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-neutral-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

const toPreview = (plan: Plan) =>
  plan.items.map((i) => ({ courseId: i.courseId, name: i.name, section: i.section, room: i.room, slots: i.slots, professor: i.professor, credits: i.credits, scheduleText: i.scheduleText }));

export function PlanCards({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const { closeBroddySheet } = useShell();
  const [active, setActive] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const preview = (plan: Plan | null) => planPreviewStore.set(plan ? toPreview(plan) : []);

  function accept(plan: Plan, mode: "replace" | "keep") {
    const now = new Date().toISOString();
    const entries = plan.items.map((i) => ({
      courseId: i.courseId,
      name: i.name,
      section: i.section,
      slots: i.slots,
      professor: i.professor,
      room: i.room,
      scheduleText: i.scheduleText,
      credits: i.credits,
      addedAt: now,
    }));
    let skipped: string[] = [];
    if (mode === "replace") {
      for (const m of myCoursesStore.getAll()) myCoursesStore.remove(m.courseId);
      entries.forEach((e) => myCoursesStore.add(e));
    } else {
      for (const e of entries) {
        if (clashesWith(e, myCoursesStore.getAll()).length) skipped.push(e.name);
        else myCoursesStore.add(e);
      }
    }
    skipped = [...new Set(skipped)];
    preview(null);
    setConfirming(null);
    chatStore.say(
      `Added Plan ${plan.id} (${plan.credits} credits) to My Courses${mode === "replace" ? ", replacing your previous plan" : ""}.${
        skipped.length ? ` I skipped ${skipped.join(", ")} because ${skipped.length === 1 ? "it clashes" : "they clash"} with courses you kept.` : ""
      }`,
    );
    showToast(`Plan ${plan.id} added`, { href: "/courses", text: "My Courses" });
    closeBroddySheet(); // phones: show the calendar right away
    router.push("/calendar");
  }

  return (
    <div className="mt-2 space-y-2">
      {plans.map((plan) => {
        const on = active === plan.id;
        return (
          <div
            key={plan.id}
            role="group"
            aria-label={`Plan ${plan.id}`}
            onMouseEnter={() => preview(plan)}
            onMouseLeave={() => !on && preview(null)}
            onClick={() => {
              setActive(on ? null : plan.id);
              preview(on ? null : plan);
            }}
            className={`cursor-pointer rounded-xl border bg-white p-3 text-[13px] transition-colors ${on ? "border-black ring-1 ring-black" : "border-neutral-300 hover:border-black"}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[15px] font-bold">Plan {plan.id}</p>
              <p className="tabular-nums text-neutral-600">{plan.credits} credits</p>
            </div>
            <p className="mt-0.5 text-neutral-700">{plan.tradeoff}</p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Stat label="Avg quality" value={plan.quality == null ? "–" : plan.quality.toFixed(1)} />
              <Stat label="Avg workload" value={plan.workload == null ? "–" : plan.workload.toFixed(1)} />
              <Stat label="Days" value={`${plan.days.length}`} sub={plan.days.join(" ")} />
            </dl>
            <ul className="mt-2 space-y-1">
              {plan.items.map((i) => (
                <li key={i.courseId} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">
                    {i.name} <span className="font-normal text-neutral-500">· {i.section}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-500">{i.scheduleText.replace(/\.\s*/g, " ")}</span>
                </li>
              ))}
            </ul>
            {confirming === plan.id ? (
              <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                <p className="w-full text-neutral-700">You already have courses in My Courses. Replace them or keep them?</p>
                <button type="button" onClick={() => accept(plan, "replace")} className="h-10 rounded-full bg-black px-3.5 font-semibold text-white">
                  Replace my courses
                </button>
                <button type="button" onClick={() => accept(plan, "keep")} className="h-10 rounded-full border border-black px-3.5 font-semibold">
                  Keep and add
                </button>
                <button type="button" onClick={() => setConfirming(null)} className="h-10 rounded-full px-2 text-neutral-600 underline">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (myCoursesStore.getAll().length) setConfirming(plan.id);
                  else accept(plan, "replace");
                }}
                className="mt-2 h-10 w-full rounded-full bg-black font-semibold text-white hover:bg-neutral-800"
              >
                Accept Plan {plan.id}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-neutral-100 px-1 py-1.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.04em] text-neutral-500">{label}</dt>
      <dd className="text-base font-bold tabular-nums leading-tight">{value}</dd>
      {sub && <dd className="truncate text-[10px] text-neutral-500">{sub}</dd>}
    </div>
  );
}
