"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed store usable with React's useSyncExternalStore.
 * The server snapshot is always `initial`, so there is no hydration mismatch;
 * the stored value appears right after hydration.
 */
export function createLocalStore<T>(key: string, initial: T) {
  let cache: T | undefined;
  const listeners = new Set<() => void>();

  function read(): T {
    if (cache !== undefined) return cache;
    try {
      const raw = window.localStorage.getItem(key);
      cache = raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      cache = initial;
    }
    return cache;
  }

  function get(): T {
    return typeof window === "undefined" ? initial : read();
  }

  function set(next: T | ((prev: T) => T)) {
    cache = typeof next === "function" ? (next as (p: T) => T)(read()) : next;
    try {
      window.localStorage.setItem(key, JSON.stringify(cache));
    } catch {
      /* storage full or blocked: keep in memory */
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        cache = undefined;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, get, () => initial);
  }

  return { get, set, subscribe, useValue };
}
