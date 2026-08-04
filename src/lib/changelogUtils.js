import { compareVersions } from "./version.js";

const VERSION_RE = /^## \[(.+?)\]\s*(?:—|-)\s*(.+?)\s*$/;
const BULLET_RE = /^- (.+)$/;
// The optional captured group tolerates a closing quote landing between the
// period and the following whitespace (a sentence ending inside quotes, e.g.
// `to "Notify the household." The old label...`) — without it, that shape
// never matched and the whole bullet fell through to the length-based
// ellipsis truncation instead of stopping cleanly after the real sentence end.
const SENTENCE_END_RE = /(?<![eE]\.[gG])(?<![iI]\.[eE])\.(["'”]{0,2})\s+(?=[A-ZÆØÅ`"'(])/;
const MAX_TITLE_LENGTH = 160;

function extractTitle(text) {
  const joined = text.replace(/\s+/g, " ").trim();
  const stripped = joined.replace(/\*\*/g, "");
  const match = SENTENCE_END_RE.exec(stripped);
  let title = match ? stripped.slice(0, match.index + 1 + match[1].length) : stripped;
  if (title.length > MAX_TITLE_LENGTH) {
    title = `${title.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`;
  }
  return title;
}

// Whether ChangelogModal would actually have something new to show a user
// coming from `lastSeen` — i.e. an entry newer than what they last ran, but
// not newer than the JS running right now (the same upper bound the modal
// itself applies, since a freshly-fetched CHANGELOG.md can list a version
// this tab's bundle hasn't received yet).
//
// Exists because a release can legitimately bump VERSION with no changelog
// entry at all: an internal/gated change still alters the built output, so
// CLAUDE.md's versioning rule requires the bump, but there's deliberately
// nothing to announce. Without this check useDeployVersionCheck would tell
// every user "updated to X" and then show them a changelog whose newest
// entry predates the version it just named.
export function hasUnseenChangelogEntry(entries, { lastSeen, current }) {
  return entries.some(
    (entry) => compareVersions(entry.version, lastSeen) > 0 && compareVersions(entry.version, current) <= 0
  );
}

// Parses CHANGELOG.md into per-version entry titles (the bold lead sentence
// of each bullet, by convention — or its first sentence when unbolded),
// dropping the fuller descriptive text that follows. Powers ChangelogModal's
// compact view; the raw file is still linked out to for full detail.
export function parseChangelog(markdown) {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const entries = [];
  let current = null;
  let buffer = null;

  function flush() {
    if (buffer !== null && current) {
      current.titles.push(extractTitle(buffer));
    }
    buffer = null;
  }

  for (const line of lines) {
    const versionMatch = VERSION_RE.exec(line);
    if (versionMatch) {
      flush();
      current = { version: versionMatch[1], date: versionMatch[2].trim(), titles: [] };
      entries.push(current);
      continue;
    }
    if (!current) continue;

    const bulletMatch = BULLET_RE.exec(line);
    if (bulletMatch) {
      flush();
      buffer = bulletMatch[1];
      continue;
    }

    if (buffer !== null && line.trim() && /^\s/.test(line)) {
      buffer += ` ${line.trim()}`;
      continue;
    }

    flush();
  }
  flush();

  return entries;
}
