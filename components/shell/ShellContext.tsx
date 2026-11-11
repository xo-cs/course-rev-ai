"use client";

import { createContext, useContext } from "react";

export interface ShellApi {
  openProfile: () => void;
  /** Expand Broddy (desktop) or open the sheet (mobile). */
  openBroddy: () => void;
}

export const ShellContext = createContext<ShellApi>({ openProfile: () => {}, openBroddy: () => {} });
export const useShell = () => useContext(ShellContext);
