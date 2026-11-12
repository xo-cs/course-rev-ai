"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Vertical drag handle between two columns.
 * While dragging it only calls `onLive` (which writes a CSS variable), so React does not
 * re-render on every pointer move; the final width is saved once in `onCommit`.
 * `direction` = 1 when dragging right makes the column wider (left nav), -1 for the right column.
 */
export function ResizeHandle({
  label,
  value,
  min,
  max,
  direction,
  onLive,
  onCommit,
  onReset,
  className = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  direction: 1 | -1;
  onLive: (px: number) => void;
  onCommit: (px: number) => void;
  onReset: () => void;
  className?: string;
}) {
  const drag = useRef<{ x: number; start: number; last: number } | null>(null);
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)));

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, start: value, last: value };
    document.documentElement.dataset.resizing = "true";
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const next = clamp(d.start + (e.clientX - d.x) * direction);
    if (next !== d.last) {
      d.last = next;
      onLive(next);
    }
  }

  function end() {
    const d = drag.current;
    drag.current = null;
    delete document.documentElement.dataset.resizing;
    if (d && d.last !== d.start) onCommit(d.last);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 64 : 16;
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = value - step * direction;
    else if (e.key === "ArrowRight") next = value + step * direction;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    else if (e.key === "Enter") return onReset();
    if (next == null) return;
    e.preventDefault();
    onCommit(clamp(next));
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`${label}. Arrow keys resize, Enter or double-click resets.`}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={`group relative z-20 w-px shrink-0 cursor-col-resize touch-none select-none bg-neutral-200 outline-none transition-colors hover:bg-black focus-visible:bg-black ${className}`}
    >
      {/* Wider invisible hit area */}
      <span aria-hidden className="absolute inset-y-0 -left-[5px] -right-[5px]" />
      {/* Grab handle, visible on hover / focus / drag */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-black opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100"
      />
    </div>
  );
}
