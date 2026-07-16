const VERSION_RE = /^## \[(.+?)\]\s*(?:—|-)\s*(.+?)\s*$/;
const BULLET_RE = /^- (.+)$/;
const SENTENCE_END_RE = /(?<![eE]\.[gG])(?<![iI]\.[eE])\.\s+(?=[A-ZÆØÅ`"'(])/;
const MAX_TITLE_LENGTH = 160;

function extractTitle(text) {
  const joined = text.replace(/\s+/g, " ").trim();
  const stripped = joined.replace(/\*\*/g, "");
  const match = SENTENCE_END_RE.exec(stripped);
  let title = match ? stripped.slice(0, match.index + 1) : stripped;
  if (title.length > MAX_TITLE_LENGTH) {
    title = `${title.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`;
  }
  return title;
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
