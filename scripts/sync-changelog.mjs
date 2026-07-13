// Runs automatically before `npm run build` (see package.json's "prebuild").
// public/CHANGELOG.md is a duplicate of the root CHANGELOG.md, needed only
// because Vite's publicDir copy-through can't reach outside the project
// (see CLAUDE.md) — this script keeps that copy from silently drifting
// instead of relying on a developer remembering to copy it by hand.
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
copyFileSync(path.join(root, "CHANGELOG.md"), path.join(root, "public", "CHANGELOG.md"));
console.log("Synced CHANGELOG.md -> public/CHANGELOG.md");
