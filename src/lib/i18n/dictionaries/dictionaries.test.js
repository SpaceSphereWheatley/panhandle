import { describe, it, expect } from "vitest";
import { nb } from "./nb.js";
import { en } from "./en.js";

// The two dictionaries are maintained by hand, one key at a time. translate()
// silently falls back to en for a key missing from nb, which is the right
// runtime behaviour but hides the mistake — a Norwegian user just sees a
// stray English string. These checks make the drift a test failure instead.
describe("dictionaries", () => {
  it("define exactly the same keys", () => {
    const nbKeys = Object.keys(nb).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys.filter((k) => !(k in nb))).toEqual([]);
    expect(nbKeys.filter((k) => !(k in en))).toEqual([]);
  });

  it("agree on which entries are plural forms", () => {
    for (const key of Object.keys(nb)) {
      const nbPlural = typeof nb[key] === "object";
      const enPlural = typeof en[key] === "object";
      expect(`${key}:${enPlural}`).toBe(`${key}:${nbPlural}`);
    }
  });

  it("give every plural entry both a one and an other form", () => {
    for (const dict of [nb, en]) {
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value !== "object") continue;
        expect(`${key}.one:${typeof value.one}`).toBe(`${key}.one:string`);
        expect(`${key}.other:${typeof value.other}`).toBe(`${key}.other:string`);
      }
    }
  });

  it("use the same placeholders on both sides of a key", () => {
    const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [key, value] of Object.entries(nb)) {
      const forms = typeof value === "object" ? ["one", "other"] : [null];
      for (const form of forms) {
        const nbText = form ? value[form] : value;
        const enText = form ? en[key][form] : en[key];
        expect(`${key}: ${placeholders(enText)}`).toBe(`${key}: ${placeholders(nbText)}`);
      }
    }
  });

  it("has no empty string values", () => {
    for (const dict of [nb, en]) {
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value === "object") continue;
        expect(`${key}:${value.length > 0}`).toBe(`${key}:true`);
      }
    }
  });
});
