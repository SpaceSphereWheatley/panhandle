import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { translateItemName, CANONICAL_ITEM_NAMES } from "./itemNames.js";
import { ITEM_ICON_MAP } from "../itemIcons.js";

describe("translateItemName", () => {
  it("translates a known COMMON_ITEMS name to Norwegian", () => {
    expect(translateItemName("Milk", "nb")).toBe("Melk");
  });

  it("is case-insensitive", () => {
    expect(translateItemName("milk", "nb")).toBe("Melk");
    expect(translateItemName("MILK", "nb")).toBe("Melk");
  });

  it("returns the name unchanged for en", () => {
    expect(translateItemName("Milk", "en")).toBe("Milk");
  });

  it("passes through a custom/free-typed item unchanged", () => {
    expect(translateItemName("Bestemors hjemmelagde syltetøy", "nb")).toBe("Bestemors hjemmelagde syltetøy");
  });

  it("is null/undefined-safe", () => {
    expect(translateItemName(null, "nb")).toBe(null);
    expect(translateItemName(undefined, "nb")).toBe(undefined);
  });
});

// The three lists below are maintained in three separate files but key on the
// same canonical item name. A partial rename is the failure mode this whole
// area is exposed to, and it surfaces only as a silently missing icon or a
// stray untranslated name at runtime — never as an error. So assert the sets
// match exactly.
describe("catalogue name consistency", () => {
  // Read COMMON_ITEMS as text: worker/index.js imports @pushforge/builder and
  // Cloudflare globals, so it can't be imported into a jsdom test run. Resolved
  // from cwd (the repo root, where vitest runs) because import.meta.url isn't a
  // file: URL under jsdom.
  const workerSrc = readFileSync(resolve(process.cwd(), "worker/index.js"), "utf8");
  const start = workerSrc.indexOf("export const COMMON_ITEMS = [");
  const block = workerSrc.slice(start, workerSrc.indexOf("];", start));
  const commonItemNames = [...block.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1].toLowerCase());

  it("parsed a plausible COMMON_ITEMS array", () => {
    // Guards every assertion below against being vacuously true if the array's
    // shape ever changes and the regex silently matches nothing.
    expect(commonItemNames.length).toBeGreaterThan(500);
  });

  it("COMMON_ITEMS has no duplicate names", () => {
    expect(new Set(commonItemNames).size).toBe(commonItemNames.length);
  });

  it("every COMMON_ITEMS name has a Norwegian display name", () => {
    const known = new Set(CANONICAL_ITEM_NAMES);
    expect(commonItemNames.filter((n) => !known.has(n))).toEqual([]);
  });

  it("every Norwegian display name maps to a real COMMON_ITEMS name", () => {
    const known = new Set(commonItemNames);
    expect(CANONICAL_ITEM_NAMES.filter((n) => !known.has(n))).toEqual([]);
  });

  it("every COMMON_ITEMS name has an icon", () => {
    const known = new Set(Object.keys(ITEM_ICON_MAP).map((k) => k.toLowerCase()));
    expect(commonItemNames.filter((n) => !known.has(n))).toEqual([]);
  });

  it("no icon key is orphaned", () => {
    const known = new Set(commonItemNames);
    expect(Object.keys(ITEM_ICON_MAP).filter((k) => !known.has(k.toLowerCase()))).toEqual([]);
  });

  it("Norwegian display names are unique (no two items collide when translated)", () => {
    const nb = CANONICAL_ITEM_NAMES.map((k) => translateItemName(k, "nb").toLowerCase());
    const dupes = nb.filter((n, i) => nb.indexOf(n) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });
});
