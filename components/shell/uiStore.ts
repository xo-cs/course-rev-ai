"use client";

import { createLocalStore } from "@/lib/localStore";

export const uiStore = createLocalStore("crai.ui.v1", { navCollapsed: false, broddyCollapsed: false });
