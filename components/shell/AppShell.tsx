"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { BroddyAvatar, IconPanelRight } from "@/components/ui/Icons";
import { useSwipeDown } from "@/components/ui/useSwipeDown";
import { toastStore } from "@/lib/toast";
import { BroddyPanel } from "./BroddyPanel";
import { LeftNav } from "./LeftNav";
import { MobileTabBar } from "./MobileTabBar";
import { ProfileModal } from "./ProfileModal";
import { ShellContext, type ShellApi } from "./ShellContext";
import { uiStore } from "./uiStore";

export function AppShell({ children, programs }: { children: ReactNode; programs: string[] }) {
  const ui = uiStore.useValue();
  const [profileOpen, setProfileOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const api = useMemo<ShellApi>(
    () => ({
      openProfile: () => setProfileOpen(true),
      openBroddy: () => {
        uiStore.set((s) => ({ ...s, broddyCollapsed: false }));
        if (window.matchMedia("(max-width: 1023.98px)").matches) setSheetOpen(true);
      },
    }),
    [],
  );

  return (
    <ShellContext.Provider value={api}>
      <div className="flex h-dvh overflow-hidden">
        <LeftNav />

        <main
          id="main"
          className="scroll-stable min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-24 lg:pb-0"
        >
          {children}
        </main>

        {/* Desktop Broddy panel (lg and up) */}
        {ui.broddyCollapsed ? (
          <aside className="hidden w-[68px] shrink-0 flex-col items-center gap-3 border-l border-neutral-200 py-3 lg:flex">
            <button
              type="button"
              onClick={() => uiStore.set((s) => ({ ...s, broddyCollapsed: false }))}
              className="flex size-11 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-black"
              aria-label="Open Broddy"
            >
              <IconPanelRight />
            </button>
            <button
              type="button"
              onClick={() => uiStore.set((s) => ({ ...s, broddyCollapsed: false }))}
              className="rounded-full"
              aria-label="Open Broddy chat"
            >
              <BroddyAvatar size={40} />
            </button>
          </aside>
        ) : (
          <aside className="hidden w-[380px] shrink-0 border-l border-neutral-200 lg:block">
            <BroddyPanel variant="desktop" onCollapse={() => uiStore.set((s) => ({ ...s, broddyCollapsed: true }))} />
          </aside>
        )}
      </div>

      <MobileTabBar />

      {/* Phones / tablets: floating button + full screen sheet */}
      {!sheetOpen && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 flex size-14 items-center justify-center gap-2 rounded-full bg-black text-sm font-medium text-white shadow-lg transition-transform active:scale-95 sm:h-12 sm:w-auto sm:pl-2 sm:pr-4 md:bottom-6 lg:hidden"
          aria-label="Open Broddy chat"
        >
          <BroddyAvatar size={34} className="border border-white/40" />
          <span className="hidden sm:inline">Ask Broddy</span>
        </button>
      )}
      {sheetOpen && <BroddySheet onClose={closeSheet} />}

      <Toaster />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} programs={programs} />
    </ShellContext.Provider>
  );
}

function BroddySheet({ onClose }: { onClose: () => void }) {
  const { panelRef, handleProps } = useSwipeDown<HTMLDivElement>(onClose);
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Broddy chat">
      <div className="absolute inset-0 animate-fade-in bg-black/40" aria-hidden />
      <div
        ref={panelRef}
        className="absolute inset-0 animate-sheet-up overflow-hidden bg-white pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      >
        <BroddyPanel variant="sheet" onCollapse={onClose} dragHandleProps={handleProps} />
      </div>
    </div>
  );
}

function Toaster() {
  const toast = toastStore.useValue();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-24 lg:bottom-6"
    >
      {toast && (
        <div
          key={toast.id}
          className="pointer-events-auto flex max-w-md animate-fade-up items-center gap-4 rounded-full bg-black py-3 pl-5 pr-3 text-sm text-white shadow-xl"
        >
          <span>{toast.text}</span>
          {toast.href && (
            <Link href={toast.href} className="flex h-8 items-center rounded-full bg-white px-3 font-medium text-black">
              {toast.linkText}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
