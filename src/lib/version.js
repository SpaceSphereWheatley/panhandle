// Live frontend version, imported from shared/version.js so it can't drift
// from the Worker's VERSION (worker/index.js) on a release — see CHANGELOG.md.
export { VERSION as APP_VERSION } from "../../shared/version.js";

// Determines whether the change from `prev` to `next` is release-worthy
// (MAJOR or MINOR changed — a new capability/phase per CLAUDE.md's
// versioning convention) vs. a quiet PATCH-only bump. Drives
// useDeployVersionCheck's choice between auto-opening the changelog and
// just showing a dismissible toast.
export function isFeatureVersionBump(prev, next) {
  const [prevMajor, prevMinor] = prev.split(".").map(Number);
  const [nextMajor, nextMinor] = next.split(".").map(Number);
  return prevMajor !== nextMajor || prevMinor !== nextMinor;
}
