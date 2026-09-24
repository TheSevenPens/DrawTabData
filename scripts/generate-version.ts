// Generates data/version.json with git metadata and record counts.
// Run via `npm run version-info` from the data-repo root.
//
// The DrawTabDataExplorer no longer reads this file: it calls
// buildVersionInfo() at its own build time so the deployed metadata always
// matches the data it shipped. This script remains for other consumers of
// the raw repo.

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { buildVersionInfo } from "../lib/version-info.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const versionInfo = buildVersionInfo(repoRoot);

const outPath = path.join(repoRoot, "data", "version.json");
fs.writeFileSync(outPath, JSON.stringify(versionInfo, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
console.log(JSON.stringify(versionInfo, null, 2));
