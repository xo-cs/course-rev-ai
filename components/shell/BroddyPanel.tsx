"use client";

import type { HTMLAttributes } from "react";
import { BroddyChat } from "@/components/broddy/BroddyChat";
import { BroddyAvatar, IconClose, IconDock, IconExpand, IconPanelRight, IconPopOut, IconSettings, IconShrink } from "@/components/ui/Icons";
import { chatStore } from "@/lib/chatStore";
import { useShell } from "./ShellContext";
import { uiStore } from "./uiStore";

export function BroddyPanel({
  variant,
  onCollapse,
  dragHandleProps,
}: {
  variant: "desktop" | "sheet" | "floating";
  onCollapse: () => void;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
}) {
  const { openProfile } = useShell();
  const messages = chatStore.useMessages();
  const ui = uiStore.useValue();
  const sheet = variant === "sheet";
  const floating = variant === "floating";
  const wide = ui.broddyMode === "wide";
  // 44px targets on phones; slightly smaller on desktop so the header fits a narrow panel.
  const btn = `flex ${sheet ? "size-11" : "size-9"} shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-black`;
  const icon = sheet ? 20 : 18;

  return (
    <section aria-label="Broddy, your AI course buddy" className="flex h-full min-h-0 flex-col bg-white">
      <header {...(sheet || floating ? dragHandleProps : {})} className="shrink-0 select-none border-b border-neutral-200">
        {sheet && <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-neutral-300" aria-hidden />}
        <div className={`flex items-center gap-1 pl-4 pr-2 ${sheet ? "h-14" : "h-16"}`}>
          <BroddyAvatar size={38} />
          <div className="ml-1.5 min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-tight">Broddy</h2>
            <p className="truncate text-xs text-neutral-500">Your AI course buddy</p>
          </div>
          {messages.length > 0 && (
            <button type="button" onClick={() => chatStore.newChat()} className={btn} aria-label="New chat" title="New chat">
              <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h8M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
          )}
          <button type="button" onClick={openProfile} className={btn} aria-label="Edit your student profile" title="Profile">
            <IconSettings width={icon} height={icon} />
          </button>
          {variant === "desktop" && (
            <button
              type="button"
              onClick={() => uiStore.set((s) => ({ ...s, broddyMode: wide ? "docked" : "wide" }))}
              className={btn}
              aria-label={wide ? "Shrink Broddy" : "Expand Broddy (wide mode)"}
              aria-pressed={wide}
              title={wide ? "Shrink" : "Expand"}
            >
              {wide ? <IconShrink width={icon} height={icon} /> : <IconExpand width={icon} height={icon} />}
            </button>
          )}
          {!sheet && (
            <button
              type="button"
              onClick={() => uiStore.set((s) => ({ ...s, broddyMode: floating ? "docked" : "floating", broddyCollapsed: false }))}
              className={btn}
              aria-label={floating ? "Dock Broddy to the right" : "Pop out Broddy into a floating window"}
              title={floating ? "Dock" : "Pop out"}
            >
              {floating ? <IconDock width={icon} height={icon} /> : <IconPopOut width={icon} height={icon} />}
            </button>
          )}
          {!floating && (
            <button type="button" onClick={onCollapse} className={btn} aria-label={sheet ? "Close Broddy" : "Collapse Broddy"} title={sheet ? "Close" : "Collapse"}>
              {sheet ? <IconClose width={icon} height={icon} /> : <IconPanelRight width={icon} height={icon} />}
            </button>
          )}
        </div>
      </header>
      <BroddyChat />
    </section>
  );
}
