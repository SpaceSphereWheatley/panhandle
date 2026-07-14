import { describe, it, expect } from "vitest";
import { clusterFor } from "./categoryClusters.js";
import { CATEGORIES } from "../../shared/categories.js";

describe("clusterFor", () => {
  it("returns a bg/on token pair for every known category", () => {
    for (const category of CATEGORIES) {
      const result = clusterFor(category);
      expect(result.bg).toMatch(/^var\(--cluster-[a-z]+-bg\)$/);
      expect(result.on).toMatch(/^var\(--cluster-[a-z]+-on\)$/);
    }
  });

  it("maps 'Annet' to the 'other' cluster", () => {
    expect(clusterFor("Annet")).toEqual({
      bg: "var(--cluster-other-bg)",
      on: "var(--cluster-other-on)",
    });
  });

  it("falls back to the 'other' cluster for an unrecognized category (e.g. 'Nylig kjøpt')", () => {
    expect(clusterFor("Nylig kjøpt")).toEqual({
      bg: "var(--cluster-other-bg)",
      on: "var(--cluster-other-on)",
    });
  });
});
