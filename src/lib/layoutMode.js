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

// A per-device override letting someone on a desktop-width viewport opt back
// into the phone layout (Settings → Appearance). Only "compact" is a valid
// stored value — there's no "force desktop on a phone" case — so any other
// value (including absence) means "follow the viewport." Kept as a separate
// key rather than folded into layoutModeForWidth's result so
// viewportLayoutMode() below can stay override-blind: the Settings toggle
// that reverts this must stay visible even while the override is active,
// which means its own visibility can't depend on the effective (overridden)
// mode.
const OVERRIDE_KEY = "ph_layout_override";

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

// The layout the viewport's own width calls for, ignoring any stored
// override. This is what drives whether the "prefer phone layout" toggle
// itself is shown — see the OVERRIDE_KEY comment above for why it can't use
// currentLayoutMode() instead.
export function viewportLayoutMode() {
  if (!canMatchMedia()) return "compact";
  return window.matchMedia(DESKTOP_QUERY).matches ? "desktop" : "compact";
}

export function layoutOverride() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(OVERRIDE_KEY) === "compact" ? "compact" : null;
}

// The mode actually applied to the app: the override when set, else whatever
// the viewport calls for.
export function currentLayoutMode() {
  return layoutOverride() || viewportLayoutMode();
}

export function applyLayoutMode(mode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.layout = mode;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));
}

// mode: "compact" to force the phone layout regardless of viewport width, or
// null to clear the override and go back to following the viewport.
export function setLayoutOverride(mode) {
  if (typeof localStorage !== "undefined") {
    if (mode === "compact") localStorage.setItem(OVERRIDE_KEY, "compact");
    else localStorage.removeItem(OVERRIDE_KEY);
  }
  applyLayoutMode(currentLayoutMode());
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
  applyLayoutMode(currentLayoutMode());
  mql.addEventListener("change", () => applyLayoutMode(currentLayoutMode()));
}
