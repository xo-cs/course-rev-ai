"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconClose } from "./Icons";

/**
 * Native <dialog> modal: focus trap, Esc to close, backdrop click to close.
 * On phones it becomes a full-width sheet anchored to the bottom with its own scroll.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={`m-auto max-h-[min(90dvh,860px)] w-[calc(100%-2rem)] ${wide ? "max-w-xl" : "max-w-md"} flex-col overflow-hidden rounded-2xl border border-black bg-white p-0 text-black shadow-2xl open:flex open:animate-fade-up max-sm:mb-0 max-sm:max-h-[94dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:open:animate-sheet-up`}
    >
      {open && (
        <>
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200 py-2 pl-5 pr-2 sm:pl-6">
            <h2 className="min-w-0 text-lg font-semibold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-black"
              aria-label="Close"
            >
              <IconClose />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-neutral-200 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
              {footer}
            </div>
          )}
        </>
      )}
    </dialog>
  );
}
