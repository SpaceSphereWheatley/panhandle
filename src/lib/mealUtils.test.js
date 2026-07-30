import { describe, it, expect, vi } from "vitest";

const mockApi = vi.fn();
vi.mock("./api.js", () => ({
  api: (...args) => mockApi(...args),
}));

const {
  buildIngredientRows,
  parseIngredients,
  localIso,
  mondayOf,
  dayOfWeekMonFirst,
  sortMealsByUsage,
  collectLabels,
  findMealByName,
  mealNameMatches,
  findSimilarMeals,
  addRowsToList,
} = await import("./mealUtils.js");

describe("localIso", () => {
  it("formats a Date using its local calendar date, zero-padded", () => {
    expect(localIso(new Date(2024, 0, 5))).toBe("2024-01-05");
    expect(localIso(new Date(2024, 10, 30))).toBe("2024-11-30");
  });

  it("reflects local getters (getFullYear/getMonth/getDate), not a UTC conversion", () => {
    // Regression guard for the documented anti-UTC-shift behavior: localIso
    // must never route through toISOString(), which would roll the date
    // backwards near local midnight in a positive-UTC-offset timezone.
    const d = new Date(2024, 5, 15, 23, 30);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(localIso(d)).toBe(expected);
  });
});

describe("mondayOf", () => {
  it("wraps a Sunday back 6 days to the preceding Monday", () => {
    const sunday = new Date(2024, 0, 7); // Jan 7 2024 is a Sunday
    expect(localIso(mondayOf(sunday))).toBe("2024-01-01");
  });

  it("leaves a Monday unchanged", () => {
    const monday = new Date(2024, 0, 1); // Jan 1 2024 is a Monday
    expect(localIso(mondayOf(monday))).toBe("2024-01-01");
  });

  it("rewinds a mid-week date to that week's Monday", () => {
    const wednesday = new Date(2024, 0, 10); // Jan 10 2024 is a Wednesday
    expect(localIso(mondayOf(wednesday))).toBe("2024-01-08");
  });
});

describe("parseIngredients", () => {
  it("returns [] for empty/null/undefined input", () => {
    expect(parseIngredients(null)).toEqual([]);
    expect(parseIngredients(undefined)).toEqual([]);
    expect(parseIngredients("")).toEqual([]);
  });

  it("parses a valid JSON array", () => {
    expect(parseIngredients('["Melk", "Egg"]')).toEqual(["Melk", "Egg"]);
  });

  it("returns [] for malformed JSON", () => {
    expect(parseIngredients("{not valid json")).toEqual([]);
  });

  it("returns [] for valid JSON that isn't an array", () => {
    expect(parseIngredients('{"a": 1}')).toEqual([]);
    expect(parseIngredients('"just a string"')).toEqual([]);
  });
});

describe("buildIngredientRows", () => {
  const catalogue = [
    { name: "Melk", category: "Dairy" },
    { name: "Egg", category: "Dairy" },
  ];

  it("dedupes by lowercased name", () => {
    const rows = buildIngredientRows(["Melk", "melk", "MELK"], catalogue, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Melk");
  });

  it("sets category from a catalogue match", () => {
    const rows = buildIngredientRows(["Melk"], catalogue, new Set());
    expect(rows[0].category).toBe("Dairy");
  });

  it("falls back to 'Other' category for an unmatched ingredient", () => {
    const rows = buildIngredientRows(["Trylledrikk"], catalogue, new Set());
    expect(rows[0].category).toBe("Other");
    expect(rows[0].name).toBe("Trylledrikk");
  });

  it("sets the already flag from onListNames", () => {
    const onList = new Set(["melk"]);
    const rows = buildIngredientRows(["Melk", "Egg"], catalogue, onList);
    expect(rows.find((r) => r.name === "Melk").already).toBe(true);
    expect(rows.find((r) => r.name === "Egg").already).toBe(false);
  });

  it("parses a leading Mengde qty+unit off a raw ingredient as one amount, same as manual entry", () => {
    const rows = buildIngredientRows(["2 kg Melk"], catalogue, new Set());
    expect(rows[0]).toMatchObject({ name: "Melk", qty: 1, unit: "2 kg", unitType: "mengde", category: "Dairy" });
  });

  it("parses a leading Antall qty+unit as a genuine count", () => {
    const rows = buildIngredientRows(["2 boks Melk"], catalogue, new Set());
    expect(rows[0]).toMatchObject({ name: "Melk", qty: 2, unit: "boks", unitType: "antall", category: "Dairy" });
  });

  it("parses a bare leading qty with no unit", () => {
    const rows = buildIngredientRows(["3 Egg"], catalogue, new Set());
    expect(rows[0]).toMatchObject({ name: "Egg", qty: 3, unit: null, unitType: null, category: "Dairy" });
  });

  it("defaults to qty 1 with no unit for a plain ingredient", () => {
    const rows = buildIngredientRows(["Melk"], catalogue, new Set());
    expect(rows[0]).toMatchObject({ qty: 1, unit: null, unitType: null });
  });

  it("still falls back to 'Other' when the parsed name has no catalogue match", () => {
    const rows = buildIngredientRows(["500g Trylledrikk"], catalogue, new Set());
    expect(rows[0]).toMatchObject({ name: "Trylledrikk", qty: 1, unit: "500 g", unitType: "mengde", category: "Other" });
  });
});

describe("dayOfWeekMonFirst", () => {
  it("returns 0 for Monday and 6 for Sunday", () => {
    expect(dayOfWeekMonFirst(new Date(2024, 0, 1))).toBe(0); // Monday
    expect(dayOfWeekMonFirst(new Date(2024, 0, 7))).toBe(6); // Sunday
  });

  it("accepts an ISO date string", () => {
    expect(dayOfWeekMonFirst("2024-01-03")).toBe(2); // Wednesday
  });
});

describe("sortMealsByUsage", () => {
  it("sorts by times_planned descending, then name ascending", () => {
    const meals = [
      { name: "Zebra", times_planned: 1 },
      { name: "Taco", times_planned: 5 },
      { name: "Apple", times_planned: 5 },
    ];
    expect(sortMealsByUsage(meals).map((m) => m.name)).toEqual(["Apple", "Taco", "Zebra"]);
  });

  it("doesn't mutate the input array", () => {
    const meals = [{ name: "B", times_planned: 1 }, { name: "A", times_planned: 2 }];
    const copy = [...meals];
    sortMealsByUsage(meals);
    expect(meals).toEqual(copy);
  });
});

describe("collectLabels", () => {
  it("collects distinct labels across meals, sorted alphabetically", () => {
    const meals = [
      { labels: '["Vegetar", "Rask"]' },
      { labels: '["Rask", "Barnevennlig"]' },
    ];
    expect(collectLabels(meals)).toEqual(["Barnevennlig", "Rask", "Vegetar"]);
  });

  it("returns [] when no meal has labels", () => {
    expect(collectLabels([{ labels: null }, { labels: "" }])).toEqual([]);
  });
});

describe("findMealByName", () => {
  const catalogue = [{ id: 1, name: "Taco" }, { id: 2, name: "Pizza" }];

  it("matches case-insensitively and trims the query", () => {
    expect(findMealByName(catalogue, "  taco  ")).toEqual(catalogue[0]);
  });

  it("returns undefined for an empty query or no match", () => {
    expect(findMealByName(catalogue, "")).toBeUndefined();
    expect(findMealByName(catalogue, "Sushi")).toBeUndefined();
  });
});

describe("mealNameMatches", () => {
  it("matches a case-insensitive substring", () => {
    expect(mealNameMatches("Fish Tacos", "taco")).toBe(true);
    expect(mealNameMatches("Fish Tacos", "sushi")).toBe(false);
  });

  it("treats an empty/whitespace query as matching everything", () => {
    expect(mealNameMatches("Fish Tacos", "")).toBe(true);
    expect(mealNameMatches("Fish Tacos", "   ")).toBe(true);
  });
});

describe("findSimilarMeals", () => {
  const catalogue = [{ name: "Tacos" }, { name: "Fish tacos" }, { name: "Pizza" }];

  it("matches either direction of substring containment", () => {
    expect(findSimilarMeals(catalogue, "Taco").map((m) => m.name)).toEqual(["Tacos", "Fish tacos"]);
  });

  it("returns [] for an empty query", () => {
    expect(findSimilarMeals(catalogue, "")).toEqual([]);
  });
});

describe("addRowsToList", () => {
  it("tallies added/merged/failed across POST /list calls", async () => {
    mockApi
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2, duplicate: true })
      .mockRejectedValueOnce(new Error("network"));
    const result = await addRowsToList([
      { name: "Melk", category: "Dairy" },
      { name: "Egg", category: "Dairy" },
      { name: "Smør", category: "Dairy" },
    ]);
    expect(result).toEqual({ added: 1, merged: 1, failed: 1 });
    expect(mockApi).toHaveBeenCalledTimes(3);
  });

  it("returns all zeroes for an empty row list", async () => {
    mockApi.mockClear();
    expect(await addRowsToList([])).toEqual({ added: 0, merged: 0, failed: 0 });
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("posts the row's parsed qty and unit instead of a hardcoded qty of 1", async () => {
    mockApi.mockClear();
    mockApi.mockResolvedValueOnce({ id: 1 });
    await addRowsToList([{ name: "Poteter", category: "Produce", qty: 2, unit: "kg" }]);
    expect(mockApi).toHaveBeenCalledWith(
      "/list",
      expect.objectContaining({ body: JSON.stringify({ name: "Poteter", qty: 2, category: "Produce", notes: "kg" }) })
    );
  });

  it("falls back to qty 1 and no notes when a row has no parsed qty/unit", async () => {
    mockApi.mockClear();
    mockApi.mockResolvedValueOnce({ id: 1 });
    await addRowsToList([{ name: "Egg", category: "Dairy" }]);
    expect(mockApi).toHaveBeenCalledWith(
      "/list",
      expect.objectContaining({ body: JSON.stringify({ name: "Egg", qty: 1, category: "Dairy" }) })
    );
  });
});
