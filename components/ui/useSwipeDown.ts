"use client";

import { useCallback, useRef, type PointerEvent } from "react";

/**
 * Swipe-down-to-close for sheets. Attach `handleProps` to the drag area (header / grab bar)
 * and `panelRef` to the element that moves. Writes transform directly to the DOM so
 * dragging never re-renders React (transform only: cheap to animate).
 */
export function useSwipeDown<T extends HTMLElement>(onClose: () => void, threshold = 90) {
  const panelRef = useRef<T>(null);
  const start = useRef<{ y: number; t: number; dy: number } | null>(null);

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Don't hijack taps on buttons inside the header.
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    start.current = { y: e.clientY, t: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (panelRef.current) panelRef.current.style.transition = "none";
  }, []);

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s || !panelRef.current) return;
    s.dy = Math.max(0, e.clientY - s.y);
    panelRef.current.style.transform = `translate3d(0, ${s.dy}px, 0)`;
  }, []);

  const finish = useCallback(() => {
    const s = start.current;
    const el = panelRef.current;
    start.current = null;
    if (!s || !el) return;
    const velocity = s.dy / Math.max(1, performance.now() - s.t); // px per ms
    el.style.transition = "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)";
    if (s.dy > threshold || (s.dy > 20 && velocity > 0.6)) {
      el.style.transform = "translate3d(0, 100%, 0)";
      window.setTimeout(onClose, 180);
    } else {
      el.style.transform = "";
    }
  }, [onClose, threshold]);

  return {
    panelRef,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      style: { touchAction: "none" as const },
    },
  };
}
