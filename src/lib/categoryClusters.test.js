import { describe, it, expect } from "vitest";
import { clusterFor, CLUSTER_KEYS } from "./categoryClusters.js";
import { CATEGORIES } from "../../shared/categories.js";

describe("clusterFor", () => {
  it("returns a bg/on token pair for every known category", () => {
    for (const category of CATEGORIES) {
      const result = clusterFor(category);
      expect(result.bg).toMatch(/^var\(--cluster-[a-z]+-bg\)$/);
      expect(result.on).toMatch(/^var\(--cluster-[a-z]+-on\)$/);
    }
  });

  it("maps 'Other' to the 'other' cluster", () => {
    expect(clusterFor("Other")).toEqual({
      bg: "var(--cluster-other-bg)",
      on: "var(--cluster-other-on)",
    });
  });

  it("falls back to the 'other' cluster for an unrecognized category (e.g. 'Recently bought')", () => {
    expect(clusterFor("Recently bought")).toEqual({
      bg: "var(--cluster-other-bg)",
      on: "var(--cluster-other-on)",
    });
  });

  // The pinned important-items section deliberately doesn't fall through to
  // "other" — it reuses the star accent. A stale Norwegian sentinel here would
  // silently regress it to the neutral cluster, which the two tests above
  // can't catch since they assert the fallback.
  it("gives the 'Important' sentinel the star accent, not the 'other' cluster", () => {
    expect(clusterFor("Important")).toEqual({
      bg: "var(--accent-tertiary-subtle)",
      on: "var(--accent-tertiary)",
    });
  });

  // CLUSTER_KEYS and CATEGORIES are maintained in separate files and must
  // agree exactly — a category missing an id renders in the neutral cluster,
  // an orphaned id is dead weight that outlived a renamed category.
  it("has a CLUSTER_KEYS entry for exactly the CATEGORIES set", () => {
    expect(Object.keys(CLUSTER_KEYS).sort()).toEqual([...CATEGORIES].sort());
  });
});
