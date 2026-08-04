import { describe, it, expect } from "vitest";
import { parseChangelog, hasUnseenChangelogEntry } from "./changelogUtils.js";

describe("parseChangelog", () => {
  it("returns [] for empty/null/undefined input", () => {
    expect(parseChangelog("")).toEqual([]);
    expect(parseChangelog(null)).toEqual([]);
    expect(parseChangelog(undefined)).toEqual([]);
  });

  it("groups bullets under their version heading, extracting the bold lead sentence as the title", () => {
    const md = `# Changelog

## [1.2.0] — 2026-01-05

### Fixed
- **Widgets no longer explode on click.** Root cause was a race between
  the click handler and the teardown effect, fixed by cancelling the
  timeout on unmount.
- **Second entry title.** More detail here.

## [1.1.0] — 2026-01-01

### Added
- Plain, unbolded bullet with a single sentence describing the change.
`;
    const entries = parseChangelog(md);
    expect(entries).toEqual([
      {
        version: "1.2.0",
        date: "2026-01-05",
        titles: [
          "Widgets no longer explode on click.",
          "Second entry title.",
        ],
      },
      {
        version: "1.1.0",
        date: "2026-01-01",
        titles: ["Plain, unbolded bullet with a single sentence describing the change."],
      },
    ]);
  });

  it("stops at the first sentence, dropping the rest of the bullet's description", () => {
    const md = `## [1.0.0] — 2026-01-01

- **Short title.** A much longer explanation follows that should be
  dropped entirely from the title output.
`;
    const entries = parseChangelog(md);
    expect(entries[0].titles).toEqual(["Short title."]);
  });

  it("truncates a very long single-sentence bullet with an ellipsis", () => {
    const longSentence = "A".repeat(200);
    const md = `## [1.0.0] — 2026-01-01

- ${longSentence}
`;
    const entries = parseChangelog(md);
    expect(entries[0].titles[0].endsWith("…")).toBe(true);
    expect(entries[0].titles[0].length).toBeLessThan(longSentence.length);
  });

  it("does not split a sentence at an abbreviation like 'e.g.' followed by lowercase text", () => {
    const md = `## [1.0.0] — 2026-01-01

- Adding an item with a size (e.g. "500g") keeps the whole name intact.
`;
    const entries = parseChangelog(md);
    expect(entries[0].titles).toEqual([
      'Adding an item with a size (e.g. "500g") keeps the whole name intact.',
    ]);
  });

  it("stops at a sentence that ends inside a closing quote", () => {
    const md = `## [1.0.0] — 2026-01-01

- Renamed the button to "Notify the household." The old label was unclear.
`;
    const entries = parseChangelog(md);
    expect(entries[0].titles).toEqual([
      'Renamed the button to "Notify the household."',
    ]);
  });
});

describe("hasUnseenChangelogEntry", () => {
  const entries = [
    { version: "1.59.0", date: "2026-08-04", titles: [] },
    { version: "1.58.3", date: "2026-08-04", titles: [] },
    { version: "1.58.2", date: "2026-08-03", titles: [] },
  ];

  it("is true when an entry sits between the last-seen and current version", () => {
    expect(hasUnseenChangelogEntry(entries, { lastSeen: "1.58.2", current: "1.59.0" })).toBe(true);
  });

  it("is false when every entry is at or below the last-seen version", () => {
    expect(hasUnseenChangelogEntry(entries, { lastSeen: "1.59.0", current: "1.59.0" })).toBe(false);
  });

  // The case this function exists for: a release that bumps VERSION with no
  // changelog entry of its own (an internal or feature-gated change), so the
  // newest entry predates the version now running and there's nothing to say.
  it("is false when a bump added no entry and the user had already seen the newest one", () => {
    expect(hasUnseenChangelogEntry(entries, { lastSeen: "1.59.0", current: "1.60.0" })).toBe(false);
  });

  // ...but such a bump must NOT swallow an older entry the user genuinely
  // hasn't seen yet — someone skipping 1.58.3 -> 1.60.0 still gets told
  // about 1.59.0.
  it("is true when an entry is unseen even though the running version is newer than all of them", () => {
    expect(hasUnseenChangelogEntry(entries, { lastSeen: "1.58.2", current: "1.60.0" })).toBe(true);
  });

  it("ignores entries newer than the version this tab is actually running", () => {
    // CHANGELOG.md is fetched fresh, so right after a deploy it can list a
    // version whose JS this tab hasn't loaded yet — same upper bound
    // ChangelogModal applies before rendering.
    expect(hasUnseenChangelogEntry(entries, { lastSeen: "1.58.3", current: "1.58.3" })).toBe(false);
  });

  it("compares numerically, not as strings", () => {
    const wide = [{ version: "1.10.0", date: "x", titles: [] }];
    expect(hasUnseenChangelogEntry(wide, { lastSeen: "1.9.0", current: "1.10.0" })).toBe(true);
    expect(hasUnseenChangelogEntry(wide, { lastSeen: "1.10.0", current: "1.10.0" })).toBe(false);
  });

  it("is false for an empty changelog", () => {
    expect(hasUnseenChangelogEntry([], { lastSeen: "1.58.3", current: "1.59.0" })).toBe(false);
  });
});
