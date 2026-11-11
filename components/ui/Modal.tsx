"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconClose } from "./Icons";

/** Native <dialog> modal: focus trap, Esc to close, backdrop click to close. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
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
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-xl" : "max-w-md"} rounded-2xl border border-black bg-white p-0 text-black shadow-2xl open:animate-fade-up`}
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="-m-1.5 rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-black"
              aria-label="Close"
            >
              <IconClose />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
