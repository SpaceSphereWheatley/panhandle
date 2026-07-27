import { useEffect, useState } from "react";
import { currentLayoutMode, subscribeLayoutMode } from "../lib/layoutMode.js";

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
