import { describe, it, expect } from "vitest";
import { translateCategoryName } from "./categoryNames.js";
import { CATEGORIES } from "../../../shared/categories.js";

describe("translateCategoryName", () => {
  it("translates a canonical category to English", () => {
    expect(translateCategoryName("Frukt og grønt", "en")).toBe("Fruit and vegetables");
    expect(translateCategoryName("Meieriprodukter", "en")).toBe("Dairy");
  });

  it("returns the canonical Norwegian label in nb", () => {
    expect(translateCategoryName("Frukt og grønt", "nb")).toBe("Frukt og grønt");
  });

  // The whole point of the stable-key layer: every CATEGORIES entry has to
  // resolve, or an aisle silently renders as a raw `category.xyz` key.
  it("covers every CATEGORIES entry in both languages", () => {
    for (const category of CATEGORIES) {
      for (const lang of ["nb", "en"]) {
        const label = translateCategoryName(category, lang);
        expect(`${category}/${lang}: ${label.startsWith("category.")}`).toBe(`${category}/${lang}: false`);
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });

  it("round-trips the nb label back to the canonical string", () => {
    // nb labels *are* the canonical strings — a translation layer that
    // renamed them would break category_order and the Worker's validation.
    for (const category of CATEGORIES) {
      expect(translateCategoryName(category, "nb")).toBe(category);
    }
  });

  it("passes an unknown category through untouched", () => {
    expect(translateCategoryName("Noe Helt Annet", "en")).toBe("Noe Helt Annet");
    expect(translateCategoryName("", "en")).toBe("");
  });
});
