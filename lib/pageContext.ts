"use client";

import { createMemoryStore } from "./memoryStore";

/** The course shown on the current page (set by the course page while mounted). */
export const pageCourseStore = createMemoryStore<{ courseId: string; label: string } | null>(null);

/** Pathname whose context chip the student removed. */
export const dismissedContextStore = createMemoryStore<string | null>(null);

/** Incremented to ask the Broddy input to take focus. */
export const broddyFocusStore = createMemoryStore(0);
