"use client";

import { createMemoryStore } from "./memoryStore";
import type { Slot } from "./types";

/** A section being hovered on an "Add to My Courses" button: drawn as a ghost block on the calendar. */
export interface PreviewSection {
  courseId: string;
  name: string;
  section: string;
  room: string;
  slots: Slot[];
  professor?: string;
  credits?: number | null;
  scheduleText?: string;
}

export const previewStore = createMemoryStore<PreviewSection | null>(null);

/** Sections of the plan card being hovered/tapped (dashed blocks on the calendar). */
export const planPreviewStore = createMemoryStore<PreviewSection[]>([]);
