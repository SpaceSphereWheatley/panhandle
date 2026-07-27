// Layout mode — "compact" (phone/tablet) | "desktop". Mirrors the shape of
// src/lib/designIntensity.js: it stamps document.documentElement.dataset.layout
// so CSS can branch via :root[data-layout="desktop"], and dispatches a
// CustomEvent so the handful of components that must branch in *JS* (the tab
// bar's bottom-bar-vs-rail structure, Sheet's sheet-vs-dialog placement, the
// shopping grid's column formula, MealsTab's swipe paging) can react — see
// src/hooks/useIsDesktop.js.
//
// This is the ONLY place the breakpoint number exists. No @media (min-width:…)
// query anywhere restates it, so the CSS and JS halves cannot drift apart.
//
// Unlike theme/intensity there's no inline bootstrap script in app.html: those
// must beat the stylesheet because body's background paints before React
// mounts, whereas data-layout only governs boxes that don't exist until React
// commits. Importing this module from main.jsx (before App) is early enough.
export const DESKTOP_MIN_WIDTH = 1024;
export const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px)`;

const EVENT = "ph:layout-change";

// Pure, so it's unit-testable without a DOM.
export function layoutModeForWidth(width) {
  return width >= DESKTOP_MIN_WIDTH ? "desktop" : "compact";
}

// jsdom implements neither matchMedia nor a meaningful innerWidth, and
// src/test/setup.js adds no shim — so guard rather than crash on import.
// Falling back to "compact" also means any browser without matchMedia gets
// today's phone layout, which is the safe direction.
function canMatchMedia() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

export function currentLayoutMode() {
  if (!canMatchMedia()) return "compact";
  return window.matchMedia(DESKTOP_QUERY).matches ? "desktop" : "compact";
}

export function applyLayoutMode(mode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.layout = mode;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));
}

export function subscribeLayoutMode(cb) {
  if (typeof window === "undefined") return () => {};
  const handler = (e) => cb(e.detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

// Stamp the initial value and keep it in sync as the window is resized.
if (canMatchMedia()) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  applyLayoutMode(mql.matches ? "desktop" : "compact");
  mql.addEventListener("change", (e) => applyLayoutMode(e.matches ? "desktop" : "compact"));
}
