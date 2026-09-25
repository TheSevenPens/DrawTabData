// Regenerates bundles and deterministic data/version.json together.
// Run via `npm run version-info` from the data-repo root.
//
// The DrawTabDataExplorer no longer reads this file: it calls
// buildVersionInfo() at its own build time so the deployed metadata always
// matches the data it shipped. This script remains for other consumers of
// the raw repo.

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { regenerateDataset } from "../lib/generate-dataset.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const file of regenerateDataset(repoRoot)) console.log(`Generated ${file}`);
