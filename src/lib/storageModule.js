// Whether the Storage tab is shown at all — a personal, per-device on/off
// switch (Settings → Storage, see StorageSubpage.jsx) for anyone who'd
// rather not see a 4th tab. Same dataset-free CustomEvent+subscribe shape as
// designIntensity.js/layoutMode.js, minus the document.dataset stamp —
// nothing here is CSS-driven, only the tab bar/pane in AppShell.jsx need to
// react in JS.
const KEY = "ph_storage_module_enabled";
const EVENT = "ph:storage-module-change";

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
