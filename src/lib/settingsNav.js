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
  members: "settings.nav.members",
  "dinner-duty": "settings.nav.dinnerDuty",
  store: "settings.nav.store",
  storage: "settings.nav.storage",
  admin: "settings.nav.admin",
  "admin/stats": "settings.nav.stats",
  "calendar-sync": "settings.nav.calendarSync",
};

// Looks the title key up from a settingsPath *array* — the same value a row
// passes to onNavigate. SettingsRoot used to index the object by hand with a
// separate literal per row, which silently drifted from the real property
// names (six rows rendered with an empty label until 1.48.2). Going through
// the destination path means a label and its navigation target can't diverge.
export function settingsTitleKey(path) {
  return SETTINGS_SUBPAGE_TITLE_KEYS[path.join("/")];
}
