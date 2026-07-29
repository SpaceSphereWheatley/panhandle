// Per-device "have they seen the onboarding intro" flag — same localStorage
// getter/setter shape as theme.js/designIntensity.js. Deliberately per-device
// rather than a server-side per-user flag: a second device (e.g. a household
// member's own phone) meeting the app for the first time should still get
// the intro, same reasoning as the push-notification reminder prefs being
// per-device rather than per-list.
const KEY = "ph_onboarding_seen_v1";

export function hasSeenOnboarding() {
  return localStorage.getItem(KEY) === "1";
}

export function markOnboardingSeen() {
  localStorage.setItem(KEY, "1");
}
