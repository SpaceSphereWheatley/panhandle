import { describe, it, expect, vi, afterEach } from "vitest";
import { cap, parseItemInput, extractGF, matchCatalogue, haptic, parseSqliteDatetime } from "./shoppingUtils.js";

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
  const catalogue = [{ name: "7 Up", category: "Drikkevarer" }];

  it("parses a leading '<qty> <name>' as a quantity", () => {
    expect(parseItemInput("2 melk", [])).toEqual({ name: "melk", qty: 2, unit: null });
  });

  it("does not treat a catalogue name starting with a digit as a quantity", () => {
    expect(parseItemInput("7 Up", catalogue)).toEqual({ name: "7 Up", qty: 1, unit: null });
  });

  it("parses a trailing '<name> <qty>' below 20 as a quantity", () => {
    expect(parseItemInput("Melk 2", [])).toEqual({ name: "Melk", qty: 2, unit: null });
  });

  it("does not treat a large trailing number as a quantity", () => {
    expect(parseItemInput("Yoghurt 500", [])).toEqual({ name: "Yoghurt 500", qty: 1, unit: null });
  });

  it("does not treat a large leading number as a quantity", () => {
    expect(parseItemInput("500 Yoghurt", [])).toEqual({ name: "500 Yoghurt", qty: 1, unit: null });
  });

  it("defaults to qty 1 for plain text", () => {
    expect(parseItemInput("Egg", [])).toEqual({ name: "Egg", qty: 1, unit: null });
  });

  it("parses a fused leading '<qty><unit>' as quantity + unit", () => {
    expect(parseItemInput("2L melk", [])).toEqual({ name: "melk", qty: 2, unit: "L" });
  });

  it("parses a fused leading '<qty><unit>' with no space before the name", () => {
    expect(parseItemInput("500g ost", [])).toEqual({ name: "ost", qty: 500, unit: "g" });
  });

  it("parses a spaced leading '<qty> <unit> <name>'", () => {
    expect(parseItemInput("2 kg poteter", [])).toEqual({ name: "poteter", qty: 2, unit: "kg" });
  });

  it("parses 'stk' as a unit", () => {
    expect(parseItemInput("3 stk egg", [])).toEqual({ name: "egg", qty: 3, unit: "stk" });
  });

  it("parses a trailing '<name> <qty><unit>'", () => {
    expect(parseItemInput("Ost 500g", [])).toEqual({ name: "Ost", qty: 500, unit: "g" });
  });

  it("does not cap quantity at 20 when a unit is present", () => {
    expect(parseItemInput("500 g ost", [])).toEqual({ name: "ost", qty: 500, unit: "g" });
  });
});

describe("extractGF", () => {
  it("strips a trailing GF marker and sets the flag", () => {
    expect(extractGF("Pasta GF")).toEqual({ name: "Pasta", gf: true });
  });

  it("is case-insensitive and recognizes glutenfri/glutenfritt", () => {
    expect(extractGF("pasta glutenfri")).toEqual({ name: "pasta", gf: true });
  });

  it("matches on word boundaries only", () => {
    expect(extractGF("Giraffe")).toEqual({ name: "Giraffe", gf: false });
  });

  it("leaves marker-only input untouched", () => {
    expect(extractGF("GF")).toEqual({ name: "GF", gf: false });
  });
});

describe("matchCatalogue", () => {
  const catalogue = [
    { name: "Lettmelk", category: "Meieriprodukter" },
    { name: "Melk", category: "Meieriprodukter" },
    { name: "Sjokolademelk", category: "Meieriprodukter" },
  ];

  it("matches regardless of token order", () => {
    const results = matchCatalogue("melk lett", catalogue);
    expect(results.map((r) => r.name)).toContain("Lettmelk");
  });

  it("requires every token to appear somewhere in the name", () => {
    const results = matchCatalogue("melk sjokolade", catalogue);
    expect(results.map((r) => r.name)).toEqual(["Sjokolademelk"]);
  });

  it("sorts matches shortest-name-first", () => {
    const results = matchCatalogue("melk", catalogue);
    expect(results.map((r) => r.name)).toEqual(["Melk", "Lettmelk", "Sjokolademelk"]);
  });

  it("returns [] for empty/whitespace-only query", () => {
    expect(matchCatalogue("", catalogue)).toEqual([]);
    expect(matchCatalogue("   ", catalogue)).toEqual([]);
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
