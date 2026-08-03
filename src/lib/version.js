// Live frontend version, imported from shared/version.js so it can't drift
// from the Worker's VERSION (worker/index.js) on a release — see CHANGELOG.md.
export { VERSION as APP_VERSION } from "../../shared/version.js";

// Determines whether the change from `prev` to `next` is a MAJOR bump —
// a breaking change per CLAUDE.md's versioning convention — vs. a
// MINOR/PATCH bump. Drives useDeployVersionCheck's choice between
// auto-opening the changelog (MAJOR only) and just showing a dismissible
// toast (everything else).
export function isMajorVersionBump(prev, next) {
  const prevMajor = Number(prev.split(".")[0]);
  const nextMajor = Number(next.split(".")[0]);
  return prevMajor !== nextMajor;
}

// Numeric MAJOR.MINOR.PATCH comparison (not a string compare, so "1.9.0" <
// "1.10.0" comes out right). Returns -1/0/1. Used by ChangelogModal to filter
// out entries newer than the version actually running in this tab — the
// bundled JS can lag a fresh CHANGELOG.md fetch by however long it takes
// Cloudflare's Pages deploy to roll out and this tab to reload, so the two
// can briefly disagree after every deploy.
export function compareVersions(a, b) {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}
