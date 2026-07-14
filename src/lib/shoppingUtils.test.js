import { describe, it, expect, vi, afterEach } from "vitest";
import { cap, parseItemInput, extractGF, matchCatalogue, haptic } from "./shoppingUtils.js";

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
    expect(parseItemInput("2 melk", [])).toEqual({ name: "melk", qty: 2 });
  });

  it("does not treat a catalogue name starting with a digit as a quantity", () => {
    expect(parseItemInput("7 Up", catalogue)).toEqual({ name: "7 Up", qty: 1 });
  });

  it("does not parse a trailing number as a quantity", () => {
    expect(parseItemInput("Yoghurt 500", [])).toEqual({ name: "Yoghurt 500", qty: 1 });
  });

  it("defaults to qty 1 for plain text", () => {
    expect(parseItemInput("Egg", [])).toEqual({ name: "Egg", qty: 1 });
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
