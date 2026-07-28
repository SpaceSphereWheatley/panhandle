import { describe, it, expect } from "vitest";
import { isMajorVersionBump } from "./version.js";

describe("isMajorVersionBump", () => {
  it("returns false for a PATCH-only bump", () => {
    expect(isMajorVersionBump("1.34.2", "1.34.3")).toBe(false);
  });

  it("returns false for a MINOR bump", () => {
    expect(isMajorVersionBump("1.34.3", "1.35.0")).toBe(false);
  });

  it("returns true for a MAJOR bump", () => {
    expect(isMajorVersionBump("1.35.0", "2.0.0")).toBe(true);
  });

  it("returns false when MINOR changed even if PATCH also changed", () => {
    expect(isMajorVersionBump("1.34.3", "1.35.2")).toBe(false);
  });

  it("returns false when versions are identical", () => {
    expect(isMajorVersionBump("1.35.0", "1.35.0")).toBe(false);
  });
});
