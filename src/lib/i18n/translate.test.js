import { describe, it, expect } from "vitest";
import { translate, interpolate } from "./translate.js";

describe("interpolate", () => {
  it("substitutes a single placeholder", () => {
    expect(interpolate("hei {name}", { name: "Ola" })).toBe("hei Ola");
  });

  it("substitutes multiple placeholders", () => {
    expect(interpolate("{a} og {b}", { a: "1", b: "2" })).toBe("1 og 2");
  });

  it("renders missing params as an empty string instead of throwing", () => {
    expect(interpolate("hei {name}", {})).toBe("hei ");
  });
});

describe("translate", () => {
  it("looks up a plain key in nb", () => {
    expect(translate("nb", "shoppingList.section.important")).toBe("Viktig");
  });

  it("looks up a plain key in en", () => {
    expect(translate("en", "shoppingList.section.important")).toBe("Important");
  });

  it("interpolates params into the looked-up string", () => {
    expect(translate("en", "shoppingList.toast.duplicateIncreased", { name: "milk", qty: 3 })).toBe(
      '"milk" was already on the list – quantity increased to 3'
    );
  });

  it.each([
    [0, "0 varer igjen"],
    [1, "1 vare igjen"],
    [2, "2 varer igjen"],
  ])("picks the right nb plural form for count=%i", (count, expected) => {
    expect(translate("nb", "shoppingList.summary.itemsLeft", { count })).toBe(expected);
  });

  it.each([
    [0, "0 items left"],
    [1, "1 item left"],
    [2, "2 items left"],
  ])("picks the right en plural form for count=%i", (count, expected) => {
    expect(translate("en", "shoppingList.summary.itemsLeft", { count })).toBe(expected);
  });

  // en is the base language (en.js is authored, nb.js translated), so an
  // unsupported language resolves against en — see translate.js's DEFAULT_LANG.
  it("falls back to the en dictionary for an unsupported language", () => {
    expect(translate("fr", "shoppingList.section.important")).toBe("Important");
  });

  it("returns the key itself when it exists in no dictionary", () => {
    expect(translate("nb", "totally.unknown.key")).toBe("totally.unknown.key");
  });
});
