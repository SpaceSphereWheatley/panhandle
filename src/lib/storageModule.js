// Whether the Storage/boxes prototype tab is shown at all — a personal,
// per-device on/off switch (Settings → Appearance) layered on top of the
// account gate below, so the experiment can be hidden without touching code.
// Same dataset-free CustomEvent+subscribe shape as designIntensity.js/
// layoutMode.js, minus the document.dataset stamp — nothing here is
// CSS-driven, only the tab bar/pane in AppShell.jsx need to react in JS.
const KEY = "ph_storage_module_enabled";
const EVENT = "ph:storage-module-change";

// The only account this whole module is visible to — see AppShell.jsx's
// nav gating and AppearanceSubpage.jsx's toggle row. A plain client-side
// check, not a security boundary: this tab has no real data or backend
// behind it, so hiding it from the UI is all that's needed.
export const STORAGE_TAB_USER = "mohibb91@gmail.com";

export function isStorageModuleEnabled() {
  return localStorage.getItem(KEY) !== "0";
}

export function setStorageModuleEnabled(on) {
  localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
}

export function subscribeStorageModule(cb) {
  const handler = (e) => cb(e.detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
