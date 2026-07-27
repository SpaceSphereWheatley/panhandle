import { describe, it, expect } from "vitest";
import { SETTINGS_SUBPAGE_TITLE_KEYS, settingsTitleKey } from "./settingsNav.js";
import { en } from "./i18n/dictionaries/en.js";
import { nb } from "./i18n/dictionaries/nb.js";

// The Settings nav registry is the one place a subpage's title is declared,
// and AppShell/SettingsRoot both index it. translate() returns a missing key
// verbatim instead of throwing, so a registry entry pointing at a
// non-existent dictionary key surfaces only as a stray raw string in the UI.
describe("SETTINGS_SUBPAGE_TITLE_KEYS", () => {
  const entries = Object.entries(SETTINGS_SUBPAGE_TITLE_KEYS);

  it("has every title key defined in both dictionaries", () => {
    for (const [path, key] of entries) {
      expect(en[key], `en is missing ${key} (for path "${path}")`).toBeTruthy();
      expect(nb[key], `nb is missing ${key} (for path "${path}")`).toBeTruthy();
    }
  });

  it("has no duplicate title keys across paths", () => {
    const keys = entries.map(([, key]) => key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("settingsTitleKey", () => {
  it("resolves a path array by joining it, matching AppShell's lookup", () => {
    expect(settingsTitleKey(["account"])).toBe("settings.nav.account");
    expect(settingsTitleKey(["dinner-duty"])).toBe("settings.nav.dinnerDuty");
    expect(settingsTitleKey(["admin", "stats"])).toBe("settings.nav.stats");
  });

  it("returns undefined for an unregistered path rather than throwing", () => {
    // AppShell treats a falsy key as "no subpage title" and falls back to the
    // tab title, so an unknown path has to stay non-fatal.
    expect(settingsTitleKey(["nope"])).toBeUndefined();
  });
});
