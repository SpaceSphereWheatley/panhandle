import { describe, it, expect } from "vitest";
import { formatBoxNumber, matchesQuery, groupByLocation } from "./storageBoxes.js";

const box = (over = {}) => ({ number: 1, name: "Tools", location: "Garage", items: [], notes: "", ...over });

describe("formatBoxNumber", () => {
  it("zero-pads to three digits", () => {
    expect(formatBoxNumber(1)).toBe("001");
    expect(formatBoxNumber(42)).toBe("042");
    expect(formatBoxNumber(148)).toBe("148");
  });

  it("leaves numbers past 999 alone rather than truncating", () => {
    expect(formatBoxNumber(1004)).toBe("1004");
  });
});

describe("matchesQuery", () => {
  it("matches an empty query against everything", () => {
    expect(matchesQuery(box(), "")).toBe(true);
    expect(matchesQuery(box(), "   ")).toBe(true);
  });

  it("matches on the padded number, so searching '007' finds box 7", () => {
    expect(matchesQuery(box({ number: 7 }), "007")).toBe(true);
  });

  it("matches name, location and contents case-insensitively", () => {
    expect(matchesQuery(box({ name: "Christmas decorations" }), "CHRISTMAS")).toBe(true);
    expect(matchesQuery(box({ location: "Attic shelf 2" }), "attic")).toBe(true);
    expect(matchesQuery(box({ items: ["Ski boots"] }), "ski")).toBe(true);
  });

  // Notes are editable in BoxEditModal, so they have to be findable too —
  // a field you can write into but never search for would be a trap.
  it("matches notes", () => {
    expect(matchesQuery(box({ notes: "Fragile — glassware" }), "fragile")).toBe(true);
  });

  it("tolerates a missing notes field", () => {
    const { notes, ...withoutNotes } = box();
    expect(() => matchesQuery(withoutNotes, "x")).not.toThrow();
    expect(matchesQuery(withoutNotes, "x")).toBe(false);
  });

  it("returns false when nothing matches", () => {
    expect(matchesQuery(box(), "bicycle")).toBe(false);
  });
});

describe("groupByLocation", () => {
  const UNPLACED = "No location yet";

  it("groups boxes under their location, sorted alphabetically", () => {
    const grouped = groupByLocation(
      [box({ number: 3, location: "Garage" }), box({ number: 1, location: "Attic" }), box({ number: 2, location: "Garage" })],
      UNPLACED
    );
    expect(grouped.map((g) => g.location)).toEqual(["Attic", "Garage"]);
    expect(grouped[1].boxes.map((b) => b.number)).toEqual([2, 3]);
  });

  it("sorts boxes numerically within a group, not as strings", () => {
    const grouped = groupByLocation(
      [box({ number: 10 }), box({ number: 9 }), box({ number: 100 })],
      UNPLACED
    );
    expect(grouped[0].boxes.map((b) => b.number)).toEqual([9, 10, 100]);
  });

  // Boxes with no location are the ones still waiting to be shelved, so they
  // belong at the end rather than sorted in among real place names.
  it("collects unplaced boxes under the supplied label, always last", () => {
    const grouped = groupByLocation(
      [box({ number: 1, location: "" }), box({ number: 2, location: "Zzz shed" }), box({ number: 3, location: "   " })],
      UNPLACED
    );
    expect(grouped.map((g) => g.location)).toEqual(["Zzz shed", UNPLACED]);
    expect(grouped[1].boxes.map((b) => b.number)).toEqual([1, 3]);
  });

  it("returns [] for no boxes", () => {
    expect(groupByLocation([], UNPLACED)).toEqual([]);
  });
});
