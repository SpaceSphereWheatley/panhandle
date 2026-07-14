import { describe, it, expect } from "vitest";
import { CATEGORIES } from "./categories.js";

describe("CATEGORIES", () => {
  it("is non-empty", () => {
    expect(CATEGORIES.length).toBeGreaterThan(0);
  });

  it("includes 'Annet' (the worker's fallback category for invalid input)", () => {
    expect(CATEGORIES).toContain("Annet");
  });

  it("has no duplicate entries", () => {
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
  });

  it("contains only non-empty strings", () => {
    for (const c of CATEGORIES) {
      expect(typeof c).toBe("string");
      expect(c.length).toBeGreaterThan(0);
    }
  });
});
