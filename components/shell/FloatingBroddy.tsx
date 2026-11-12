"use client";

import { useRef, type PointerEvent } from "react";
import { BroddyPanel } from "./BroddyPanel";
import { uiStore, useViewport, type FloatRect } from "./uiStore";

const MIN_W = 320;
const MIN_H = 380;
const MARGIN = 8;

function fit(r: FloatRect, vw: number, vh: number): FloatRect {
  const w = Math.min(Math.max(r.w, MIN_W), vw - MARGIN * 2);
  const h = Math.min(Math.max(r.h, MIN_H), vh - MARGIN * 2);
  return {
    w,
    h,
    x: Math.min(Math.max(r.x, MARGIN), vw - w - MARGIN),
    y: Math.min(Math.max(r.y, MARGIN), vh - h - MARGIN),
  };
}

/** Broddy as a floating window: drag by the header, resize from the bottom-right corner, stays in the viewport. */
export function FloatingBroddy() {
  const ui = uiStore.useValue();
  const { w: vw, h: vh } = useViewport();
  const el = useRef<HTMLDivElement>(null);
  const base = ui.float ?? { w: 440, h: Math.min(680, vh - 120), x: vw - 440 - 24, y: 88 };
  const rect = fit(base, vw, vh);
  const op = useRef<{ kind: "move" | "size"; px: number; py: number; start: FloatRect; cur: FloatRect } | null>(null);

  function begin(kind: "move" | "size", e: PointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    if (kind === "move" && (e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    op.current = { kind, px: e.clientX, py: e.clientY, start: rect, cur: rect };
    document.documentElement.dataset.resizing = kind === "move" ? "move" : "true";
  }

  function move(e: PointerEvent<HTMLElement>) {
    const o = op.current;
    const node = el.current;
    if (!o || !node) return;
    const dx = e.clientX - o.px;
    const dy = e.clientY - o.py;
    const next =
      o.kind === "move"
        ? fit({ ...o.start, x: o.start.x + dx, y: o.start.y + dy }, window.innerWidth, window.innerHeight)
        : fit({ ...o.start, w: o.start.w + dx, h: o.start.h + dy }, window.innerWidth, window.innerHeight);
    op.current = { ...o, cur: next };
    // Direct DOM writes while dragging: no React re-render per pointer move.
    Object.assign(node.style, { left: `${next.x}px`, top: `${next.y}px`, width: `${next.w}px`, height: `${next.h}px` });
  }

  function end() {
    const o = op.current;
    op.current = null;
    delete document.documentElement.dataset.resizing;
    if (o) uiStore.set((s) => ({ ...s, float: o.cur }));
  }

  const dragProps = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => begin("move", e),
    onPointerMove: (e: PointerEvent<HTMLElement>) => move(e),
    onPointerUp: () => end(),
    onPointerCancel: () => end(),
    style: { cursor: "move", touchAction: "none" as const },
  };

  return (
    <div
      ref={el}
      role="dialog"
      aria-label="Broddy chat (floating window)"
      className="fixed z-40 hidden animate-fade-in overflow-hidden rounded-2xl border border-black bg-white shadow-2xl lg:block"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      <BroddyPanel variant="floating" onCollapse={() => uiStore.set((s) => ({ ...s, broddyMode: "docked" }))} dragHandleProps={dragProps} />
      <span
        role="presentation"
        onPointerDown={(e) => begin("size", e)}
        onPointerMove={(e) => move(e)}
        onPointerUp={() => end()}
        onPointerCancel={() => end()}
        className="absolute bottom-0 right-0 z-10 size-5 cursor-nwse-resize touch-none"
        title="Drag to resize"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="text-neutral-400">
          <path d="M16 8v8H8M16 12v4h-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  );
}
