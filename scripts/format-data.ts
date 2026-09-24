// Check or normalise the formatting of every managed data file (RFC #45).
//
//   npx tsx scripts/format-data.ts           # --check: report, exit 1 on any issue, never writes
//   npx tsx scripts/format-data.ts --write   # rewrite non-canonical files in canonical form
//
// Canonical form is defined by formatDataJson() in lib/data-json.ts. --write
// refuses files it can't round-trip safely (invalid JSON, duplicate keys).

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkManagedDataFiles,
  listManagedDataFiles,
  readDataJson,
  writeDataJson,
} from "../lib/data-json.js";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const write = process.argv.includes("--write");

if (write) {
  let changed = 0;
  for (const file of listManagedDataFiles(dataDir)) {
    if (writeDataJson(file, readDataJson(file))) {
      changed++;
      console.log(`formatted ${path.relative(dataDir, file)}`);
    }
  }
  console.log(`${changed} file(s) rewritten.`);
}

const issues = checkManagedDataFiles(dataDir);
if (issues.length) {
  for (const i of issues) console.error(`${i.file}: ${i.problem}${i.detail ? ` — ${i.detail}` : ""}`);
  console.error(`\n${issues.length} formatting issue(s). Fix with: npx tsx scripts/format-data.ts --write`);
  process.exit(1);
}
console.log(`All ${listManagedDataFiles(dataDir).length} managed data files are canonical.`);
