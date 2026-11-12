"use client";

import { createContext, useContext } from "react";

export interface ShellApi {
  openProfile: () => void;
  /** Expand Broddy (desktop) or open the sheet (mobile). */
  openBroddy: () => void;
  /** Close the phone/tablet Broddy sheet (no-op on desktop). */
  closeBroddySheet: () => void;
}

export const ShellContext = createContext<ShellApi>({ openProfile: () => {}, openBroddy: () => {}, closeBroddySheet: () => {} });
export const useShell = () => useContext(ShellContext);
