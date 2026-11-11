"use client";

import { useSyncExternalStore } from "react";

/** In-memory store (not persisted) for UI state shared across components. */
export function createMemoryStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return {
    get: () => value,
    set(next: T | ((p: T) => T)) {
      value = typeof next === "function" ? (next as (p: T) => T)(value) : next;
      listeners.forEach((l) => l());
    },
    useValue: () => useSyncExternalStore(subscribe, () => value, () => initial),
  };
}
