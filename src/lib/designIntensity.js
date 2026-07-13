// Design intensity — expressive / muted / classic. The initial value is
// applied by an inline script in app.html (before the stylesheet loads, to
// avoid a flash of the wrong shape/motion language), mirroring
// src/lib/theme.js's shape. Unlike theme, a few components need to branch in
// JS (not just CSS) on the current level, so this also dispatches a
// CustomEvent — see src/hooks/useDesignIntensity.js.
const EVENT = "ph:intensity-change";

export function currentIntensity() {
  return localStorage.getItem("ph_intensity") || "expressive";
}

export function applyIntensity(level) {
  document.documentElement.dataset.designIntensity = level;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: level }));
}

export function setIntensity(level) {
  localStorage.setItem("ph_intensity", level);
  applyIntensity(level);
}

export function subscribeIntensity(cb) {
  const handler = (e) => cb(e.detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
