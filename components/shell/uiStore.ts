"use client";

import { useSyncExternalStore } from "react";
import { createLocalStore } from "@/lib/localStore";
import { BRODDY_DEFAULT, NAV_DEFAULT, type BroddyMode } from "@/lib/layout";

export interface FloatRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UiState {
  navCollapsed: boolean;
  broddyCollapsed: boolean;
  navWidth: number;
  broddyWidth: number;
  broddyMode: BroddyMode;
  float: FloatRect | null;
}

const DEFAULTS: UiState = {
  navCollapsed: false,
  broddyCollapsed: false,
  navWidth: NAV_DEFAULT,
  broddyWidth: BRODDY_DEFAULT,
  broddyMode: "docked",
  float: null,
};

const store = createLocalStore<Partial<UiState>>("crai.ui.v1", DEFAULTS);
let lastRaw: Partial<UiState> | undefined;
let lastMerged: UiState = DEFAULTS;
// Older saved values may miss newer fields: merge with defaults (stable object per stored value).
const merged = (raw: Partial<UiState>) => {
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastMerged = { ...DEFAULTS, ...raw };
  }
  return lastMerged;
};

export const uiStore = {
  useValue: (): UiState => merged(store.useValue()),
  get: (): UiState => merged(store.get()),
  set: (next: UiState | ((s: UiState) => UiState)) =>
    store.set((raw) => (typeof next === "function" ? next(merged(raw)) : next)),
  defaults: DEFAULTS,
};

const subscribeResize = (cb: () => void) => {
  let frame = 0;
  const on = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(cb);
  };
  window.addEventListener("resize", on);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", on);
  };
};

/** Viewport size (rAF-throttled). Server snapshot assumes a typical desktop. */
export function useViewport() {
  const w = useSyncExternalStore(subscribeResize, () => window.innerWidth, () => 1440);
  const h = useSyncExternalStore(subscribeResize, () => window.innerHeight, () => 900);
  return { w, h };
}
