"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BroddyAvatar, IconPanelRight } from "@/components/ui/Icons";
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

  const api = useMemo<ShellApi>(
    () => ({
      openProfile: () => setProfileOpen(true),
      openBroddy: () => {
        uiStore.set((s) => ({ ...s, broddyCollapsed: false }));
        if (window.matchMedia("(max-width: 1023px)").matches) setSheetOpen(true);
      },
    }),
    [],
  );

  return (
    <ShellContext.Provider value={api}>
      <div className="flex h-dvh overflow-hidden">
        <LeftNav />

        <main id="main" className="min-w-0 flex-1 overflow-y-auto pb-24 md:pb-20 lg:pb-0">
          {children}
        </main>

        {/* Desktop Broddy panel (lg and up) */}
        {ui.broddyCollapsed ? (
          <aside className="hidden w-[68px] shrink-0 flex-col items-center gap-3 border-l border-neutral-200 py-3 lg:flex">
            <button
              type="button"
              onClick={() => uiStore.set((s) => ({ ...s, broddyCollapsed: false }))}
              className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-black"
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

      {/* Mobile / tablet: floating button + full screen sheet */}
      {!sheetOpen && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-black py-2 pl-2 pr-4 text-sm font-medium text-white shadow-lg md:bottom-6 lg:hidden"
          aria-label="Open Broddy chat"
        >
          <BroddyAvatar size={32} className="border border-white/40" />
          Ask Broddy
        </button>
      )}
      {sheetOpen && (
        <div className="fixed inset-0 z-40 animate-sheet-up lg:hidden" role="dialog" aria-modal="true" aria-label="Broddy chat">
          <BroddyPanel variant="sheet" onCollapse={() => setSheetOpen(false)} />
        </div>
      )}

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} programs={programs} />
    </ShellContext.Provider>
  );
}
