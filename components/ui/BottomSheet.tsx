"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconClose } from "./Icons";
import { useSwipeDown } from "./useSwipeDown";

/** Mobile bottom sheet with grab bar, swipe down / Esc / backdrop to close. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { panelRef, handleProps } = useSwipeDown<HTMLDivElement>(onClose);
  const returnFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      (returnFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose, panelRef]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] animate-sheet-up flex-col rounded-t-3xl bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-2xl outline-none"
      >
        <div {...handleProps} className="shrink-0 cursor-grab select-none px-4 pb-2 pt-2 active:cursor-grabbing">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-neutral-300" aria-hidden />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 flex size-11 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-black"
              aria-label="Close"
            >
              <IconClose />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-neutral-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>
  );
}
