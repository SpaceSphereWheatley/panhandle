import { describe, it, expect } from "vitest";
import { translateItemName } from "./itemNames.js";

describe("translateItemName", () => {
  it("translates a known COMMON_ITEMS name to English", () => {
    expect(translateItemName("Melk", "en")).toBe("Milk");
  });

  it("is case-insensitive", () => {
    expect(translateItemName("melk", "en")).toBe("Milk");
    expect(translateItemName("MELK", "en")).toBe("Milk");
  });

  it("returns the name unchanged for nb", () => {
    expect(translateItemName("Melk", "nb")).toBe("Melk");
  });

  it("passes through a custom/free-typed item unchanged", () => {
    expect(translateItemName("Bestemors hjemmelagde syltetøy", "en")).toBe("Bestemors hjemmelagde syltetøy");
  });

  it("is null/undefined-safe", () => {
    expect(translateItemName(null, "en")).toBe(null);
    expect(translateItemName(undefined, "en")).toBe(undefined);
  });
});
