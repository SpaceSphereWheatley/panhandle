import { describe, it, expect } from "vitest";
import { buildIngredientRows, parseIngredients, localIso, mondayOf } from "./mealUtils.js";

describe("localIso", () => {
  it("formats a Date using its local calendar date, zero-padded", () => {
    expect(localIso(new Date(2024, 0, 5))).toBe("2024-01-05");
    expect(localIso(new Date(2024, 10, 30))).toBe("2024-11-30");
  });

  it("reflects local getters (getFullYear/getMonth/getDate), not a UTC conversion", () => {
    // Regression guard for the documented anti-UTC-shift behavior: localIso
    // must never route through toISOString(), which would roll the date
    // backwards near local midnight in a positive-UTC-offset timezone.
    const d = new Date(2024, 5, 15, 23, 30);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(localIso(d)).toBe(expected);
  });
});

describe("mondayOf", () => {
  it("wraps a Sunday back 6 days to the preceding Monday", () => {
    const sunday = new Date(2024, 0, 7); // Jan 7 2024 is a Sunday
    expect(localIso(mondayOf(sunday))).toBe("2024-01-01");
  });

  it("leaves a Monday unchanged", () => {
    const monday = new Date(2024, 0, 1); // Jan 1 2024 is a Monday
    expect(localIso(mondayOf(monday))).toBe("2024-01-01");
  });

  it("rewinds a mid-week date to that week's Monday", () => {
    const wednesday = new Date(2024, 0, 10); // Jan 10 2024 is a Wednesday
    expect(localIso(mondayOf(wednesday))).toBe("2024-01-08");
  });
});

describe("parseIngredients", () => {
  it("returns [] for empty/null/undefined input", () => {
    expect(parseIngredients(null)).toEqual([]);
    expect(parseIngredients(undefined)).toEqual([]);
    expect(parseIngredients("")).toEqual([]);
  });

  it("parses a valid JSON array", () => {
    expect(parseIngredients('["Melk", "Egg"]')).toEqual(["Melk", "Egg"]);
  });

  it("returns [] for malformed JSON", () => {
    expect(parseIngredients("{not valid json")).toEqual([]);
  });

  it("returns [] for valid JSON that isn't an array", () => {
    expect(parseIngredients('{"a": 1}')).toEqual([]);
    expect(parseIngredients('"just a string"')).toEqual([]);
  });
});

describe("buildIngredientRows", () => {
  const catalogue = [
    { name: "Melk", category: "Meieriprodukter" },
    { name: "Egg", category: "Meieriprodukter" },
  ];

  it("dedupes by lowercased name", () => {
    const rows = buildIngredientRows(["Melk", "melk", "MELK"], catalogue, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Melk");
  });

  it("sets category from a catalogue match", () => {
    const rows = buildIngredientRows(["Melk"], catalogue, new Set());
    expect(rows[0].category).toBe("Meieriprodukter");
  });

  it("falls back to 'Annet' category for an unmatched ingredient", () => {
    const rows = buildIngredientRows(["Trylledrikk"], catalogue, new Set());
    expect(rows[0].category).toBe("Annet");
    expect(rows[0].name).toBe("Trylledrikk");
  });

  it("sets the already flag from onListNames", () => {
    const onList = new Set(["melk"]);
    const rows = buildIngredientRows(["Melk", "Egg"], catalogue, onList);
    expect(rows.find((r) => r.name === "Melk").already).toBe(true);
    expect(rows.find((r) => r.name === "Egg").already).toBe(false);
  });
});
