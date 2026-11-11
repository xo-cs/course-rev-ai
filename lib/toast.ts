"use client";

import { createMemoryStore } from "./memoryStore";

export interface Toast {
  id: number;
  text: string;
  href?: string;
  linkText?: string;
}

export const toastStore = createMemoryStore<Toast | null>(null);
let timer: number | undefined;

export function showToast(text: string, link?: { href: string; text: string }) {
  window.clearTimeout(timer);
  toastStore.set({ id: Date.now(), text, href: link?.href, linkText: link?.text });
  timer = window.setTimeout(() => toastStore.set(null), 3500);
}
