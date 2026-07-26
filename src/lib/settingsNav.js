// Dictionary keys for the Settings subpage titles, keyed by the joined
// settingsPath (e.g. "admin/stats"). Both AppShell.jsx (the single shared
// Header shown while a subpage is open) and SettingsRoot.jsx (the navigation
// rows into those subpages) need the same label, and before this the two
// hardcoded the strings separately and had to be kept in sync by hand.
export const SETTINGS_SUBPAGE_TITLE_KEYS = {
  appearance: "settings.nav.appearance",
  account: "settings.nav.account",
  language: "settings.nav.language",
  notifications: "settings.nav.notifications",
  household: "settings.nav.household",
  store: "settings.nav.store",
  admin: "settings.nav.admin",
  "admin/stats": "settings.nav.stats",
};
