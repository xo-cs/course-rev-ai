"use client";

import { createLocalStore } from "./localStore";
import type { Profile } from "./types";

export const profileStore = createLocalStore<Profile>("crai.profile.v1", { program: null, year: null });

export function profileLabel(p: Profile, short = false) {
  if (!p.program && !p.year) return "Set your major";
  const program = p.program ?? "Undeclared";
  const year = p.year ? (short ? `Y${p.year}` : `Year ${p.year}`) : "";
  return [program, year].filter(Boolean).join(" · ");
}
