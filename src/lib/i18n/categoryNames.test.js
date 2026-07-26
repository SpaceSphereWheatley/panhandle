import { describe, it, expect } from "vitest";
import { translateCategoryName } from "./categoryNames.js";
import { CATEGORIES } from "../../../shared/categories.js";

describe("translateCategoryName", () => {
  it("translates a canonical category to Norwegian", () => {
    expect(translateCategoryName("Fruit and vegetables", "nb")).toBe("Frukt og grønt");
    expect(translateCategoryName("Dairy", "nb")).toBe("Meieriprodukter");
  });

  it("returns the canonical English label in en", () => {
    expect(translateCategoryName("Fruit and vegetables", "en")).toBe("Fruit and vegetables");
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

  it("round-trips the en label back to the canonical string", () => {
    // en labels *are* the canonical strings — a translation layer that
    // renamed them would break category_order and the Worker's validation.
    for (const category of CATEGORIES) {
      expect(translateCategoryName(category, "en")).toBe(category);
    }
  });

  it("passes an unknown category through untouched", () => {
    expect(translateCategoryName("Something Else Entirely", "nb")).toBe("Something Else Entirely");
    expect(translateCategoryName("", "nb")).toBe("");
  });
});
