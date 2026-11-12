// Column layout rules for desktop/tablet (pure, no React). Phones don't use these.
export const NAV_MIN = 200;
export const NAV_MAX = 320;
export const NAV_DEFAULT = 240;
export const NAV_COLLAPSED = 68;
export const BRODDY_MIN = 320;
export const BRODDY_DEFAULT = 440;
export const BRODDY_RAIL = 68;
export const MAIN_MIN = 480;
export const WIDE_RATIO = 0.6;
export const DESKTOP_MIN = 1024; // Broddy is a docked column from here (lg)
export const NAV_VISIBLE_MIN = 768; // left nav is visible from here (md)

export type BroddyMode = "docked" | "wide" | "floating";

export interface LayoutPrefs {
  navCollapsed: boolean;
  broddyCollapsed: boolean;
  navWidth: number;
  broddyWidth: number;
  broddyMode: BroddyMode;
}

export interface ResolvedLayout {
  nav: number;
  broddy: number; // width of the Broddy column (0 when floating or hidden)
  navMax: number;
  broddyMax: number;
  broddyColumn: "panel" | "rail" | "none";
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const DIVIDERS = 2; // two 1px handles between the columns

export function resolveLayout(viewport: number, p: LayoutPrefs): ResolvedLayout {
  const desktop = viewport >= DESKTOP_MIN;
  const vw = viewport - DIVIDERS;
  const column: ResolvedLayout["broddyColumn"] = !desktop || p.broddyMode === "floating" ? "none" : p.broddyCollapsed ? "rail" : "panel";

  let nav = viewport < NAV_VISIBLE_MIN ? 0 : p.navCollapsed ? NAV_COLLAPSED : clamp(p.navWidth, NAV_MIN, NAV_MAX);
  let broddy = column === "rail" ? BRODDY_RAIL : 0;

  if (column === "panel") {
    const wanted = p.broddyMode === "wide" ? vw * WIDE_RATIO : p.broddyWidth;
    let max = Math.min(vw * WIDE_RATIO, vw - nav - MAIN_MIN);
    if (max < BRODDY_MIN && !p.navCollapsed) {
      // Not enough room: shrink the nav first (down to its minimum).
      nav = Math.max(NAV_MIN, vw - MAIN_MIN - BRODDY_MIN);
      max = Math.min(vw * WIDE_RATIO, vw - nav - MAIN_MIN);
    }
    broddy = Math.round(clamp(wanted, BRODDY_MIN, Math.max(BRODDY_MIN, max)));
  }

  const navMax = p.navCollapsed ? NAV_COLLAPSED : Math.max(NAV_MIN, Math.min(NAV_MAX, vw - broddy - MAIN_MIN));
  nav = p.navCollapsed || nav === 0 ? nav : Math.round(Math.min(nav, navMax));
  const broddyMax = Math.max(BRODDY_MIN, Math.round(Math.min(vw * WIDE_RATIO, vw - nav - MAIN_MIN)));
  return { nav, broddy, navMax, broddyMax, broddyColumn: column };
}
