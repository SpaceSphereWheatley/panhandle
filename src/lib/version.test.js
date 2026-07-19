import { describe, it, expect } from "vitest";
import { isFeatureVersionBump } from "./version.js";

describe("isFeatureVersionBump", () => {
  it("returns false for a PATCH-only bump", () => {
    expect(isFeatureVersionBump("1.34.2", "1.34.3")).toBe(false);
  });

  it("returns true for a MINOR bump", () => {
    expect(isFeatureVersionBump("1.34.3", "1.35.0")).toBe(true);
  });

  it("returns true for a MAJOR bump", () => {
    expect(isFeatureVersionBump("1.35.0", "2.0.0")).toBe(true);
  });

  it("returns true when MINOR changed even if PATCH also changed", () => {
    expect(isFeatureVersionBump("1.34.3", "1.35.2")).toBe(true);
  });

  it("returns false when versions are identical", () => {
    expect(isFeatureVersionBump("1.35.0", "1.35.0")).toBe(false);
  });
});
