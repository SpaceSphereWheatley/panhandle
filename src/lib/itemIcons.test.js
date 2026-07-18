import { describe, it, expect } from "vitest";
import { iconForItem, ITEM_ICON_LIB, ITEM_ICON_MAP } from "./itemIcons.js";
import { COMMON_ITEMS } from "../../worker/index.js";

describe("iconForItem", () => {
  it("resolves an icon for every COMMON_ITEMS catalogue entry", () => {
    const missing = COMMON_ITEMS.filter((item) => !iconForItem(item.name)).map((item) => item.name);
    expect(missing).toEqual([]);
  });

  it("every MAP entry points at a key that exists in the icon library", () => {
    const danglingKeys = Object.entries(ITEM_ICON_MAP)
      .filter(([, key]) => !ITEM_ICON_LIB[key])
      .map(([name, key]) => `${name} -> ${key}`);
    expect(danglingKeys).toEqual([]);
  });

  it("returns null for a name with no catalogue match", () => {
    expect(iconForItem("this item definitely does not exist")).toBeNull();
  });
});
