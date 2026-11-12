"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BroddyAvatar, IconPanelRight } from "@/components/ui/Icons";
import { useSwipeDown } from "@/components/ui/useSwipeDown";
import { broddyFocusStore } from "@/lib/pageContext";
import { toastStore } from "@/lib/toast";
import { usePathname } from "next/navigation";
import { BRODDY_DEFAULT, BRODDY_MIN, NAV_DEFAULT, NAV_MIN, resolveLayout } from "@/lib/layout";
import { BroddyPanel } from "./BroddyPanel";
import { FloatingBroddy } from "./FloatingBroddy";
import { ResizeHandle } from "./ResizeHandle";
import { LeftNav } from "./LeftNav";
import { MobileTabBar } from "./MobileTabBar";
import { ProfileModal } from "./ProfileModal";
import { ShellContext, type ShellApi } from "./ShellContext";
import { uiStore, useViewport } from "./uiStore";

export function AppShell({ children, programs }: { children: ReactNode; programs: string[] }) {
  const ui = uiStore.useValue();
  const { w: vw } = useViewport();
  const layout = resolveLayout(vw, ui);
  const shellRef = useRef<HTMLDivElement>(null);
  const setVar = (name: string, px: number) => shellRef.current?.style.setProperty(name, `${px}px`);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // Close the phone sheet when the student follows a link from Broddy (e.g. a course chip).
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (sheetOpen) setSheetOpen(false);
  }

  const api = useMemo<ShellApi>(
    () => ({
      openProfile: () => setProfileOpen(true),
      openBroddy: () => {
        uiStore.set((s) => ({ ...s, broddyCollapsed: false }));
        if (window.matchMedia("(max-width: 1023.98px)").matches) setSheetOpen(true);
        // Let the panel render, then focus the input.
        requestAnimationFrame(() => broddyFocusStore.set((n) => n + 1));
      },
    }),
    [],
  );

  return (
    <ShellContext.Provider value={api}>
      <div
        ref={shellRef}
        className="flex h-dvh overflow-hidden"
        style={{ "--nav-w": `${layout.nav}px`, "--broddy-w": `${layout.broddy}px` } as CSSProperties}
      >
        <LeftNav />
        {/* Nav | main handle (tablet and desktop, nav expanded) */}
        {!ui.navCollapsed ? (
          <ResizeHandle
            className="hidden md:block"
            label="Resize navigation"
            value={layout.nav}
            min={NAV_MIN}
            max={layout.navMax}
            direction={1}
            onLive={(px) => setVar("--nav-w", px)}
            onCommit={(px) => uiStore.set((st) => ({ ...st, navWidth: px }))}
            onReset={() => uiStore.set((st) => ({ ...st, navWidth: NAV_DEFAULT }))}
          />
        ) : (
          <div className="hidden w-px shrink-0 bg-neutral-200 md:block" aria-hidden />
        )}

        <main
          id="main"
          className="scroll-stable min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(8rem+env(safe-area-inset-bottom))] md:pb-24 lg:pb-0"
        >
          {children}
        </main>

        {/* Desktop Broddy column (lg and up): rail when collapsed, nothing when floating */}
        {layout.broddyColumn === "rail" && (
          <aside className="hidden shrink-0 flex-col items-center gap-3 border-l border-neutral-200 py-3 lg:flex" style={{ width: "var(--broddy-w)" }}>
            <button
              type="button"
              onClick={() => uiStore.set((st) => ({ ...st, broddyCollapsed: false }))}
              className="flex size-11 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-black"
              aria-label="Open Broddy"
            >
              <IconPanelRight />
            </button>
            <button
              type="button"
              onClick={() => uiStore.set((st) => ({ ...st, broddyCollapsed: false }))}
              className="rounded-full"
              aria-label="Open Broddy chat"
            >
              <BroddyAvatar size={40} />
            </button>
          </aside>
        )}
        {layout.broddyColumn === "panel" && (
          <>
            <ResizeHandle
              className="hidden lg:block"
              label="Resize Broddy panel"
              value={layout.broddy}
              min={BRODDY_MIN}
              max={layout.broddyMax}
              direction={-1}
              onLive={(px) => setVar("--broddy-w", px)}
              onCommit={(px) => uiStore.set((st) => ({ ...st, broddyWidth: px, broddyMode: "docked" }))}
              onReset={() => uiStore.set((st) => ({ ...st, broddyWidth: BRODDY_DEFAULT, broddyMode: "docked" }))}
            />
            <aside className="hidden min-w-0 shrink-0 lg:block" style={{ width: "var(--broddy-w)" }}>
              <BroddyPanel variant="desktop" onCollapse={() => uiStore.set((st) => ({ ...st, broddyCollapsed: true }))} />
            </aside>
          </>
        )}
      </div>

      {ui.broddyMode === "floating" && <FloatingBroddy />}

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
