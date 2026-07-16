import { describe, it, expect } from "vitest";
import { parseChangelog } from "./changelogUtils.js";

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
});
