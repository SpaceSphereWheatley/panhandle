// Dictionary keys for the Settings subpage titles, keyed by the joined
// settingsPath (e.g. "admin/statistikk"). Both AppShell.jsx (the single shared
// Header shown while a subpage is open) and SettingsRoot.jsx (the navigation
// rows into those subpages) need the same label, and before this the two
// hardcoded the strings separately and had to be kept in sync by hand.
export const SETTINGS_SUBPAGE_TITLE_KEYS = {
  utseende: "settings.nav.utseende",
  konto: "settings.nav.konto",
  sprak: "settings.nav.sprak",
  varsler: "settings.nav.varsler",
  hjem: "settings.nav.hjem",
  butikk: "settings.nav.butikk",
  admin: "settings.nav.admin",
  "admin/statistikk": "settings.nav.statistikk",
};
