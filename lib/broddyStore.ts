"use client";

import { createLocalStore } from "./localStore";

/** What Broddy is "looking at" (shown as a removable chip above the input). */
export type BroddyContext = { kind: "course"; courseId: string; label: string } | null;

export const broddyContextStore = createLocalStore<BroddyContext>("crai.broddy.context.v1", null);
