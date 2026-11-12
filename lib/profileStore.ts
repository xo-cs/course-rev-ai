"use client";

import { createLocalStore } from "./localStore";
import type { Profile } from "./types";

// "Demo sign in": no password, everything stays in this browser.
const store = createLocalStore<Profile>("crai.profile.v1", { name: null, program: null, year: null });

export const profileStore = {
  ...store,
  /** Older saved profiles have no `name` field; normalize. */
  useValue: (): Profile => {
    const p = store.useValue();
    return p.name === undefined ? { ...p, name: null } : p;
  },
  get: (): Profile => { const p = store.get(); return { ...p, name: p.name ?? null }; },
  signOut: () => store.set({ name: null, program: null, year: null }),
};

export const isSignedIn = (p: Profile) => Boolean(p.name?.trim());

export function profileLabel(p: Profile) {
  if (!p.program && !p.year) return "Set your major";
  return [p.program ?? "Undeclared", p.year ? `Year ${p.year}` : ""].filter(Boolean).join(" · ");
}

/** Stable per-browser id for the demo user (who wrote which review). */
export function getUserId() {
  const KEY = "crai.user.id.v1";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "u_local";
  }
}
