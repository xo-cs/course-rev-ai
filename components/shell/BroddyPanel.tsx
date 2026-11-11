"use client";

import type { HTMLAttributes } from "react";
import { BroddyAvatar, IconArrowUp, IconClose, IconPanelRight, IconPlus, IconSettings } from "@/components/ui/Icons";
import { broddyContextStore } from "@/lib/broddyStore";
import { useShell } from "./ShellContext";

const iconBtn =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-black";

/**
 * Broddy chat panel. Phase 2: header, context chip, empty body and the input bar (disabled).
 * The chat itself is wired up in Phase 3.
 */
export function BroddyPanel({
  variant,
  onCollapse,
  dragHandleProps,
}: {
  variant: "desktop" | "sheet";
  onCollapse: () => void;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
}) {
  const { openProfile } = useShell();
  const context = broddyContextStore.useValue();
  const sheet = variant === "sheet";

  return (
    <section aria-label="Broddy, your AI course buddy" className="flex h-full min-h-0 flex-col bg-white">
      <header {...(sheet ? dragHandleProps : {})} className="shrink-0 select-none border-b border-neutral-200">
        {sheet && <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-neutral-300" aria-hidden />}
        <div className={`flex items-center gap-3 pl-4 pr-2 ${sheet ? "h-14" : "h-16"}`}>
          <BroddyAvatar size={38} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-tight">Broddy</h2>
            <p className="truncate text-xs text-neutral-500">Your AI course buddy</p>
          </div>
          <button type="button" onClick={openProfile} className={iconBtn} aria-label="Edit your student profile">
            <IconSettings />
          </button>
          <button type="button" onClick={onCollapse} className={iconBtn} aria-label={sheet ? "Close Broddy" : "Collapse Broddy"}>
            {sheet ? <IconClose /> : <IconPanelRight />}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-8 text-center" aria-live="polite">
        <BroddyAvatar size={56} />
        <p className="text-[15px] font-medium">Hi, I&apos;m Broddy.</p>
        <p className="max-w-xs text-sm text-neutral-500">
          {context
            ? `Ask me about ${context.label} soon: chat is coming in the next build.`
            : "I'll help you pick courses using the catalog and student reviews. Chat is coming in the next build."}
        </p>
      </div>

      <div className="shrink-0 border-t border-neutral-200 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pb-3">
        {context && (
          <div className="mb-2 flex">
            <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-neutral-300 pl-3 pr-1 text-[13px]">
              <span className="text-neutral-500">Looking at</span>
              <span className="truncate font-medium">{context.label}</span>
              <button
                type="button"
                onClick={() => broddyContextStore.set(null)}
                className="flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-black"
                aria-label={`Remove ${context.label} from Broddy's context`}
              >
                <IconClose width={14} height={14} />
              </button>
            </span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-400"
            aria-label="Attach a credits screenshot"
          >
            <IconPlus />
          </button>
          <div className="flex min-h-11 flex-1 items-center rounded-full border border-neutral-300 pl-4 pr-1.5">
            <input
              disabled
              placeholder="Message Broddy"
              aria-label="Message Broddy"
              className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400 lg:text-[15px]"
            />
            <button
              type="button"
              disabled
              className="flex size-8 items-center justify-center rounded-full bg-neutral-300 text-white"
              aria-label="Send"
            >
              <IconArrowUp width={16} height={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
