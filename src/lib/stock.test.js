import { describe, it, expect } from "vitest";
import { stockStatusOf, isLearning, needsAttention } from "./stock.js";

describe("stock helpers", () => {
  it("defaults a row without a status to 'out' (older server response)", () => {
    expect(stockStatusOf({ id: 1 })).toBe("out");
    expect(stockStatusOf({ status: "bogus" })).toBe("out");
    expect(stockStatusOf({ status: "low" })).toBe("low");
  });

  it("flags items with few purchases as still learning, unless the interval is user-set", () => {
    expect(isLearning({ times_bought: 2 })).toBe(true);
    expect(isLearning({ times_bought: 3 })).toBe(true);
    expect(isLearning({ times_bought: 4 })).toBe(false);
    expect(isLearning({ times_bought: 1, repeat_every_days: 7 })).toBe(false);
  });

  it("needsAttention drops only the 'ok' items", () => {
    const items = [{ id: 1, status: "ok" }, { id: 2, status: "low" }, { id: 3, status: "out" }, { id: 4 }];
    expect(needsAttention(items).map((i) => i.id)).toEqual([2, 3, 4]);
  });
});
