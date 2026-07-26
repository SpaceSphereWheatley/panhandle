import { describe, it, expect } from "vitest";
import { dateLocale, weekdayNames } from "./dateLocale.js";

describe("dateLocale", () => {
  it("maps the supported UI languages to their date locales", () => {
    expect(dateLocale("nb")).toBe("nb-NO");
    expect(dateLocale("en")).toBe("en-GB");
  });

  it("falls back to Norwegian for an unknown or missing language", () => {
    expect(dateLocale("de")).toBe("nb-NO");
    expect(dateLocale(undefined)).toBe("nb-NO");
    expect(dateLocale(null)).toBe("nb-NO");
  });

  it("produces day-before-month output in both languages", () => {
    const d = new Date(2026, 6, 27); // Monday 27 July 2026
    const opts = { weekday: "long", day: "numeric", month: "short" };
    expect(d.toLocaleDateString(dateLocale("nb"), opts)).toMatch(/mandag/i);
    expect(d.toLocaleDateString(dateLocale("en"), opts)).toMatch(/Monday/i);
    // Day precedes month in both, so a language switch doesn't reflow the row.
    for (const lang of ["nb", "en"]) {
      const out = d.toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" });
      expect(out.indexOf("27")).toBeLessThan(out.search(/[a-zæøå]/i));
    }
  });
});

describe("weekdayNames", () => {
  it("returns seven Monday-first capitalized names", () => {
    // Same order/casing recurring_schedule.day_of_week assumes (0 = Monday).
    expect(weekdayNames("nb")).toEqual([
      "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag",
    ]);
    expect(weekdayNames("en")).toEqual([
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    ]);
  });

  it("falls back to Norwegian for an unknown language", () => {
    expect(weekdayNames("de")[0]).toBe("Mandag");
  });
});
