import { describe, it, expect } from "vitest";
import { isMajorVersionBump, compareVersions } from "./version.js";

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

describe("compareVersions", () => {
  it("returns 0 for identical versions", () => {
    expect(compareVersions("1.57.6", "1.57.6")).toBe(0);
  });

  it("returns -1 when the first version is older", () => {
    expect(compareVersions("1.57.5", "1.57.6")).toBe(-1);
  });

  it("returns 1 when the first version is newer", () => {
    expect(compareVersions("1.57.6", "1.57.5")).toBe(1);
  });

  it("compares numerically, not lexically", () => {
    expect(compareVersions("1.9.0", "1.10.0")).toBe(-1);
  });

  it("compares the MAJOR segment first", () => {
    expect(compareVersions("2.0.0", "1.99.99")).toBe(1);
  });
});
