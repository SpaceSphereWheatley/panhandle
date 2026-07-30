import { useEffect, useState } from "react";
import { currentLayoutMode, subscribeLayoutMode, viewportLayoutMode, DESKTOP_QUERY } from "../lib/layoutMode.js";

// True at >= the desktop breakpoint — for the handful of places that need to
// branch in JS rather than CSS (TabBar's bottom-bar-vs-rail structure, Sheet's
// sheet-vs-dialog placement, ShoppingListTab's grid formula, MealsTab's swipe
// paging). Pure-CSS consumers of the layout tokens need nothing extra; they
// react via the cascade the instant documentElement.dataset.layout flips.
//
// The initializer is synchronous (not an effect) so the very first render is
// already correct — an effect-driven value would paint the phone layout for a
// frame on desktop.
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => currentLayoutMode() === "desktop");
  useEffect(() => subscribeLayoutMode((mode) => setIsDesktop(mode === "desktop")), []);
  return isDesktop;
}

// True at >= the desktop breakpoint by viewport width alone, ignoring the
// "prefer phone layout" override (see layoutMode.js's OVERRIDE_KEY comment).
// The only consumer is the Appearance subpage's toggle for that override:
// its own visibility must track the physical viewport, not the effective
// (possibly-overridden) layout — otherwise turning the override on would
// hide the control needed to turn it back off.
export function useIsDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(() => viewportLayoutMode() === "desktop");
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const handler = (e) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}
