// Single source of truth for the deployed app version. The Worker
// (worker/index.js) and the frontend (src/lib/version.js) both import this,
// so a release only requires bumping the number here — see CLAUDE.md's
// versioning convention (MAJOR.MINOR.PATCH) for when to bump which part.
export const VERSION = "1.21.8";
