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
