import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { currentLanguage, setLanguage } from "./language.js";

function mockNavigatorLanguage(value) {
  vi.spyOn(window.navigator, "language", "get").mockReturnValue(value);
}

describe("currentLanguage", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the stored language when it's supported", () => {
    localStorage.setItem("ph_language", "en");
    expect(currentLanguage()).toBe("en");
  });

  it("falls back to browser detection when nothing is stored", () => {
    mockNavigatorLanguage("en-US");
    expect(currentLanguage()).toBe("en");
  });

  it("falls back to nb when the browser language is unsupported", () => {
    mockNavigatorLanguage("de-DE");
    expect(currentLanguage()).toBe("nb");
  });

  it("falls back to browser detection when the stored value is garbage", () => {
    localStorage.setItem("ph_language", "xx");
    mockNavigatorLanguage("en-GB");
    expect(currentLanguage()).toBe("en");
  });
});

describe("setLanguage", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
  });

  it("persists to localStorage and updates <html lang>", () => {
    setLanguage("en");
    expect(localStorage.getItem("ph_language")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });
});
