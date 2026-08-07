import { describe, it, expect, vi, afterEach } from "vitest";
import {
  cap,
  parseItemInput,
  extractGF,
  matchCatalogue,
  matchWithDescriptor,
  buildItemNotes,
  haptic,
  parseSqliteDatetime,
} from "./shoppingUtils.js";

describe("cap", () => {
  it("is null/undefined-safe", () => {
    expect(cap(null)).toBe("");
    expect(cap(undefined)).toBe("");
  });

  it("capitalizes only the first character", () => {
    expect(cap("melk")).toBe("Melk");
    expect(cap("gresk yoghurt")).toBe("Gresk yoghurt");
  });

  it("returns empty string unchanged", () => {
    expect(cap("")).toBe("");
  });
});

describe("parseItemInput", () => {
  const catalogue = [{ name: "7 Up", category: "Drinks" }];

  it("parses a leading '<qty> <name>' as a quantity", () => {
    expect(parseItemInput("2 melk", [])).toEqual({ name: "melk", qty: 2, unit: null, unitType: null });
  });

  it("does not treat a catalogue name starting with a digit as a quantity", () => {
    expect(parseItemInput("7 Up", catalogue)).toEqual({ name: "7 Up", qty: 1, unit: null, unitType: null });
  });

  it("parses a trailing '<name> <qty>' below 20 as a quantity", () => {
    expect(parseItemInput("Melk 2", [])).toEqual({ name: "Melk", qty: 2, unit: null, unitType: null });
  });

  it("does not treat a large trailing number as a quantity", () => {
    expect(parseItemInput("Yoghurt 500", [])).toEqual({ name: "Yoghurt 500", qty: 1, unit: null, unitType: null });
  });

  it("does not treat a large leading number as a quantity", () => {
    expect(parseItemInput("500 Yoghurt", [])).toEqual({ name: "500 Yoghurt", qty: 1, unit: null, unitType: null });
  });

  it("defaults to qty 1 for plain text", () => {
    expect(parseItemInput("Egg", [])).toEqual({ name: "Egg", qty: 1, unit: null, unitType: null });
  });

  // Mengde (amount) units: "N g/kg/l" is one amount, not a count, so qty is
  // pinned to 1 and the number stays fused to the unit in a single string.
  it("parses a fused leading Mengde '<qty><unit>' as one amount, qty pinned to 1", () => {
    expect(parseItemInput("2L melk", [])).toEqual({ name: "melk", qty: 1, unit: "2 L", unitType: "mengde" });
  });

  it("parses a fused leading Mengde '<qty><unit>' with no space before the name", () => {
    expect(parseItemInput("500g ost", [])).toEqual({ name: "ost", qty: 1, unit: "500 g", unitType: "mengde" });
  });

  it("parses a spaced leading Mengde '<qty> <unit> <name>'", () => {
    expect(parseItemInput("2 kg poteter", [])).toEqual({ name: "poteter", qty: 1, unit: "2 kg", unitType: "mengde" });
  });

  it("parses a trailing Mengde '<name> <qty><unit>'", () => {
    expect(parseItemInput("Ost 500g", [])).toEqual({ name: "Ost", qty: 1, unit: "500 g", unitType: "mengde" });
  });

  it("does not cap quantity at 20 for a Mengde amount", () => {
    expect(parseItemInput("500 g ost", [])).toEqual({ name: "ost", qty: 1, unit: "500 g", unitType: "mengde" });
  });

  it("accepts a comma-decimal Mengde amount", () => {
    expect(parseItemInput("1,5 kg poteter", [])).toEqual({ name: "poteter", qty: 1, unit: "1,5 kg", unitType: "mengde" });
  });

  it("accepts a dot-decimal Mengde amount", () => {
    expect(parseItemInput("0.5 l fløte", [])).toEqual({ name: "fløte", qty: 1, unit: "0.5 l", unitType: "mengde" });
  });

  it.each(["dl", "cl", "mg"])("recognizes '%s' as a Mengde unit", (unit) => {
    expect(parseItemInput(`2 ${unit} sukker`, [])).toEqual({ name: "sukker", qty: 1, unit: `2 ${unit}`, unitType: "mengde" });
  });

  it.each(["oz", "lb", "lbs", "cup", "tbsp", "tsp", "pt", "qt", "gal"])(
    "recognizes the imperial unit '%s' as Mengde",
    (unit) => {
      expect(parseItemInput(`2 ${unit} flour`, [])).toEqual({ name: "flour", qty: 1, unit: `2 ${unit}`, unitType: "mengde" });
    }
  );

  // Antall (count) units: the number stays a genuine count in `qty`.
  it("parses 'stk' as an Antall unit", () => {
    expect(parseItemInput("3 stk egg", [])).toEqual({ name: "egg", qty: 3, unit: "stk", unitType: "antall" });
  });

  it.each(["pakke", "pk", "boks", "pose", "flaske", "dusin", "knippe", "par"])(
    "recognizes '%s' as an Antall unit",
    (unit) => {
      expect(parseItemInput(`2 ${unit} tomater`, [])).toEqual({ name: "tomater", qty: 2, unit, unitType: "antall" });
    }
  );

  it.each(["pack", "pkg", "can", "bag", "bottle", "dozen", "bunch", "pair"])(
    "recognizes the English Antall unit '%s'",
    (unit) => {
      expect(parseItemInput(`2 ${unit} tomatoes`, [])).toEqual({ name: "tomatoes", qty: 2, unit, unitType: "antall" });
    }
  );
});

describe("extractGF", () => {
  it("strips a trailing GF marker and sets the flag", () => {
    expect(extractGF("Pasta GF")).toEqual({ name: "Pasta", gf: true });
  });

  it("is case-insensitive and recognizes glutenfri/glutenfritt", () => {
    expect(extractGF("pasta glutenfri")).toEqual({ name: "pasta", gf: true });
  });

  it("recognizes the English 'gluten free'/'gluten-free' marker", () => {
    expect(extractGF("pasta gluten free")).toEqual({ name: "pasta", gf: true });
    expect(extractGF("pasta gluten-free")).toEqual({ name: "pasta", gf: true });
  });

  it("matches on word boundaries only", () => {
    expect(extractGF("Giraffe")).toEqual({ name: "Giraffe", gf: false });
  });

  it("leaves marker-only input untouched", () => {
    expect(extractGF("GF")).toEqual({ name: "GF", gf: false });
  });
});

describe("matchCatalogue", () => {
  // Canonical (English) names, as stored in item_catalogue. "Milk" and
  // "Low-fat milk" are real COMMON_ITEMS entries with Norwegian translations;
  // "Chocolate milk" is a household's own custom item, so it has no
  // translation and must still match on its stored name in either language.
  const catalogue = [
    { name: "Low-fat milk", category: "Dairy" },
    { name: "Milk", category: "Dairy" },
    { name: "Chocolate milk", category: "Dairy" },
  ];

  it("matches regardless of token order", () => {
    const results = matchCatalogue("milk low", catalogue);
    expect(results.map((r) => r.name)).toContain("Low-fat milk");
  });

  it("requires every token to appear somewhere in the name", () => {
    const results = matchCatalogue("milk chocolate", catalogue);
    expect(results.map((r) => r.name)).toEqual(["Chocolate milk"]);
  });

  it("ranks an exact match first, then sorts the rest alphabetically", () => {
    const results = matchCatalogue("milk", catalogue, "en");
    expect(results.map((r) => r.name)).toEqual(["Milk", "Chocolate milk", "Low-fat milk"]);
  });

  it("returns [] for empty/whitespace-only query", () => {
    expect(matchCatalogue("", catalogue)).toEqual([]);
    expect(matchCatalogue("   ", catalogue)).toEqual([]);
  });

  it("matches the canonical name only, no translation, when lang is 'en'", () => {
    expect(matchCatalogue("melk", catalogue, "en")).toEqual([]);
  });

  it("also matches an item's Norwegian translation when lang is 'nb'", () => {
    const results = matchCatalogue("melk", catalogue, "nb");
    expect(results.map((r) => r.name)).toEqual(["Milk", "Low-fat milk"]);
  });

  it("still matches the stored (English) name directly when lang is 'nb'", () => {
    const results = matchCatalogue("milk", catalogue, "nb");
    expect(results.map((r) => r.name)).toEqual(["Milk", "Chocolate milk", "Low-fat milk"]);
  });

  // nb is the default because it's the app's default UI language — so the
  // default path is the *translating* one, the reverse of before this flip.
  it("defaults to nb matching when lang is omitted", () => {
    expect(matchCatalogue("melk", catalogue).map((r) => r.name)).toEqual(["Milk", "Low-fat milk"]);
  });

  // Regression for a real bug: "Chard"'s nb translation is "Mangold", which
  // contains "mango" as a plain substring — so a naive includes()-anywhere
  // match ranked it alongside a real "Mango" entry, and on a household whose
  // catalogue happened to list "Chard" first, typing "Mango" surfaced
  // "Mangold" instead. An exact match must always win regardless of
  // catalogue order.
  it("prioritizes an exact match over a coincidental substring hit inside another item's translation", () => {
    const fruitCatalogue = [{ name: "Chard", category: "Fruit and vegetables" }, { name: "Mango", category: "Fruit and vegetables" }];
    const results = matchCatalogue("Mango", fruitCatalogue, "nb");
    expect(results.map((r) => r.name)).toEqual(["Mango", "Chard"]);
  });

  it("sorts same-tier matches alphabetically, not by name length", () => {
    const results = matchCatalogue("plant", [
      { name: "Plant food", category: "Household" },
      { name: "Aloe plant", category: "Household" },
    ]);
    expect(results.map((r) => r.name)).toEqual(["Aloe plant", "Plant food"]);
  });
});

describe("matchWithDescriptor", () => {
  const catalogue = [
    { name: "Chicken", category: "Meat" },
    { name: "Chicken fillet", category: "Meat" },
    { name: "Yogurt", category: "Dairy" },
    { name: "Plain yogurt", category: "Dairy" },
  ];

  it("returns a whole-phrase match with no descriptor, preferring the compound over its base word", () => {
    expect(matchWithDescriptor("chicken fillet", catalogue, "en")).toEqual({
      match: catalogue[1],
      descriptor: "",
    });
  });

  it("falls back to a shorter leading prefix, with the leftover as descriptor", () => {
    expect(matchWithDescriptor("yogurt vanilje", catalogue, "en")).toEqual({
      match: catalogue[2],
      descriptor: "vanilje",
    });
  });

  it("prefers the longest matching prefix over a shorter one", () => {
    expect(matchWithDescriptor("chicken fillet fresh", catalogue, "en")).toEqual({
      match: catalogue[1],
      descriptor: "fresh",
    });
  });

  it("returns no match and no descriptor when nothing matches at any prefix length", () => {
    expect(matchWithDescriptor("something totally unknown", catalogue, "en")).toEqual({
      match: null,
      descriptor: "",
    });
  });
});

describe("buildItemNotes", () => {
  it("returns undefined when nothing is set", () => {
    expect(buildItemNotes({})).toBeUndefined();
    expect(buildItemNotes()).toBeUndefined();
  });

  it("drops a bare 'stk' unit, redundant with qty", () => {
    expect(buildItemNotes({ unit: "stk" })).toBeUndefined();
    expect(buildItemNotes({ unit: "STK" })).toBeUndefined();
  });

  it("keeps a non-'stk' antall unit", () => {
    expect(buildItemNotes({ unit: "boks" })).toBe("boks");
  });

  it("keeps a mengde unit", () => {
    expect(buildItemNotes({ unit: "2 kg" })).toBe("2 kg");
  });

  it("combines descriptor, unit and gf in order", () => {
    expect(buildItemNotes({ descriptor: "vanilje", unit: "boks", gf: true })).toBe("vanilje, boks, Glutenfri");
  });

  it("omits the unit when it's 'stk' but keeps descriptor and gf", () => {
    expect(buildItemNotes({ descriptor: "vanilje", unit: "stk", gf: true })).toBe("vanilje, Glutenfri");
  });
});

describe("haptic", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("calls navigator.vibrate by default", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    haptic(20);
    expect(vibrate).toHaveBeenCalledWith(20);
  });

  it("respects the ph_haptics='0' opt-out", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { vibrate });
    localStorage.setItem("ph_haptics", "0");
    haptic(20);
    expect(vibrate).not.toHaveBeenCalled();
  });
});

describe("parseSqliteDatetime", () => {
  it("parses SQLite's space-separated UTC format as a valid UTC instant", () => {
    const d = parseSqliteDatetime("2026-07-18 12:30:00");
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(d.toISOString()).toBe("2026-07-18T12:30:00.000Z");
  });
});
