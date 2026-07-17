import { describe, it, expect, beforeEach } from "vitest";
import { readCache, writeCache } from "./localCache.js";

describe("readCache/writeCache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips a JSON-serializable value", () => {
    writeCache("k", { a: 1, b: [2, 3] });
    expect(readCache("k", null)).toEqual({ a: 1, b: [2, 3] });
  });

  it("returns the fallback when the key is missing", () => {
    expect(readCache("missing", "fallback")).toBe("fallback");
  });

  it("returns the fallback when the stored value is corrupt JSON", () => {
    localStorage.setItem("k", "{not json");
    expect(readCache("k", "fallback")).toBe("fallback");
  });
});
