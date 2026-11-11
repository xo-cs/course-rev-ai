"use client";

import { BroddyAvatar, IconArrowUp, IconChevronDown, IconPanelRight, IconPlus, IconSettings } from "@/components/ui/Icons";
import { useShell } from "./ShellContext";

/**
 * Broddy chat panel. Phase 1: header, empty body and the input bar (disabled).
 * The chat itself is wired up in Phase 3.
 */
export function BroddyPanel({ variant, onCollapse }: { variant: "desktop" | "sheet"; onCollapse: () => void }) {
  const { openProfile } = useShell();
  return (
    <section aria-label="Broddy, your AI course buddy" className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-neutral-200 px-4">
        <BroddyAvatar size={38} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-tight">Broddy</h2>
          <p className="text-xs text-neutral-500">Your AI course buddy</p>
        </div>
        <button
          type="button"
          onClick={openProfile}
          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-black"
          aria-label="Edit your student profile"
        >
          <IconSettings />
        </button>
        <button
          type="button"
          onClick={onCollapse}
          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-black"
          aria-label={variant === "sheet" ? "Close Broddy" : "Collapse Broddy"}
        >
          {variant === "sheet" ? <IconChevronDown /> : <IconPanelRight />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 text-center" aria-live="polite">
        <BroddyAvatar size={56} />
        <p className="text-[15px] font-medium">Hi, I&apos;m Broddy.</p>
        <p className="text-sm text-neutral-500">
          I&apos;ll help you pick courses using the catalog and student reviews. Chat is coming in the next build.
        </p>
      </div>

      <div className="shrink-0 border-t border-neutral-200 p-3">
        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-400"
            aria-label="Attach a credits screenshot"
          >
            <IconPlus />
          </button>
          <div className="flex min-h-9 flex-1 items-center rounded-full border border-neutral-300 pl-4 pr-1">
            <input
              disabled
              placeholder="Message Broddy"
              aria-label="Message Broddy"
              className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-neutral-400"
            />
            <button
              type="button"
              disabled
              className="flex size-7 items-center justify-center rounded-full bg-neutral-300 text-white"
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
