// Runs automatically after `npm run build` (see package.json's "postbuild").
// public/sw.js ships with a literal `__SW_CACHE_VERSION__` placeholder in its
// CACHE_NAME so the checked-in source never needs editing by hand; this
// stamps the real app VERSION into dist/sw.js's copy, giving every deploy a
// distinct cache name so the service worker's own `activate` cleanup (which
// already deletes any cache key other than the current CACHE_NAME) actually
// prunes the previous deploy's cached assets instead of never firing.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { VERSION } from "../shared/version.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const swPath = path.join(root, "dist", "sw.js");
const contents = readFileSync(swPath, "utf8");
writeFileSync(swPath, contents.replaceAll("__SW_CACHE_VERSION__", VERSION));
console.log(`Stamped dist/sw.js cache name with VERSION ${VERSION}`);
