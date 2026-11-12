"use client";

import type { HTMLAttributes } from "react";
import { BroddyChat } from "@/components/broddy/BroddyChat";
import { BroddyAvatar, IconClose, IconPanelRight, IconSettings } from "@/components/ui/Icons";
import { chatStore } from "@/lib/chatStore";
import { useShell } from "./ShellContext";

const iconBtn =
  "flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-black";

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
  const messages = chatStore.useMessages();
  const sheet = variant === "sheet";

  return (
    <section aria-label="Broddy, your AI course buddy" className="flex h-full min-h-0 flex-col bg-white">
      <header {...(sheet ? dragHandleProps : {})} className="shrink-0 select-none border-b border-neutral-200">
        {sheet && <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-neutral-300" aria-hidden />}
        <div className={`flex items-center gap-2.5 pl-4 pr-1.5 ${sheet ? "h-14" : "h-16"}`}>
          <BroddyAvatar size={38} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-tight">Broddy</h2>
            <p className="truncate text-xs text-neutral-500">Your AI course buddy</p>
          </div>
          {messages.length > 0 && (
            <button type="button" onClick={() => chatStore.newChat()} className={iconBtn} aria-label="New chat" title="New chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h8M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
          )}
          <button type="button" onClick={openProfile} className={iconBtn} aria-label="Edit your student profile" title="Profile">
            <IconSettings />
          </button>
          <button type="button" onClick={onCollapse} className={iconBtn} aria-label={sheet ? "Close Broddy" : "Collapse Broddy"}>
            {sheet ? <IconClose /> : <IconPanelRight />}
          </button>
        </div>
      </header>
      <BroddyChat />
    </section>
  );
}
