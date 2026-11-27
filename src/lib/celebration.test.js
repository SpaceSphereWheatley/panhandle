import { describe, it, expect } from "vitest";
import { CELEBRATION_VARIANTS, pickCelebration } from "./celebration.js";

describe("pickCelebration", () => {
  it("returns a known variant", () => {
    expect(CELEBRATION_VARIANTS).toContain(pickCelebration());
  });
  it("never repeats the previous pick, whatever the random value", () => {
    for (const prev of CELEBRATION_VARIANTS) {
      for (const r of [0, 0.3, 0.5, 0.99, 1]) {
        expect(pickCelebration(prev, () => r)).not.toBe(prev);
      }
    }
  });
  it("can reach every variant", () => {
    const seen = new Set();
    for (const prev of [null, ...CELEBRATION_VARIANTS]) {
      for (const r of [0, 0.99]) seen.add(pickCelebration(prev, () => r));
    }
    expect(seen.size).toBe(CELEBRATION_VARIANTS.length);
  });
});
