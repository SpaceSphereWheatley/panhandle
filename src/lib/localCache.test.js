import { describe, it, expect, beforeEach } from "vitest";
import { readCache, writeCache, clearCache } from "./localCache.js";

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

describe("clearCache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("removes only keys matching the given prefix", () => {
    localStorage.setItem("ph_cache_items_v1", "a");
    localStorage.setItem("ph_cache_plan_v1", "b");
    localStorage.setItem("ph_view", "list");
    clearCache("ph_cache_");
    expect(localStorage.getItem("ph_cache_items_v1")).toBeNull();
    expect(localStorage.getItem("ph_cache_plan_v1")).toBeNull();
    expect(localStorage.getItem("ph_view")).toBe("list");
  });

  it("defaults to the ph_cache_ prefix", () => {
    localStorage.setItem("ph_cache_items_v1", "a");
    localStorage.setItem("ph_other", "keep");
    clearCache();
    expect(localStorage.getItem("ph_cache_items_v1")).toBeNull();
    expect(localStorage.getItem("ph_other")).toBe("keep");
  });
});
