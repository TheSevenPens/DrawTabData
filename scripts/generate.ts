// Generate the tracked brand bundles (data/tablets/*, data/pens/*) from the
// per-record source files under source/ (RFC #45).
//
//   npx tsx scripts/generate.ts           # --check: compare only, never writes; exit 1 on drift
//   npx tsx scripts/generate.ts --write   # rewrite changed / missing bundles, delete orphaned ones
//
// CI runs --check BEFORE anything that could regenerate, so a stale
// committed bundle fails the build instead of being silently repaired.
// --write refuses to write anything while a source file has problems.

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { generateBundles } from "../lib/sources.js";

const argv = process.argv.slice(2);
const dirIdx = argv.indexOf("--repo-root");
const repoRoot =
  dirIdx >= 0 ? path.resolve(argv[dirIdx + 1] ?? ".") : path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = argv.includes("--write");

const r = generateBundles(repoRoot, { write });
if (r.collections.length === 0) {
  console.log("No source/ collections yet — nothing to generate.");
  process.exit(0);
}
for (const i of r.sourceIssues) console.error(`${i.file}: ${i.problem}`);
if (r.sourceIssues.length) {
  console.error(`\n${r.sourceIssues.length} source problem(s); nothing was written.`);
  process.exit(1);
}

const drift = [
  ...r.changed.map((f) => `${f}: differs from its sources`),
  ...r.missing.map((f) => `${f}: missing (sources exist for it)`),
  ...r.extra.map((f) => `${f}: no sources produce it (orphaned)`),
];
if (write) {
  for (const d of drift) console.log(`fixed ${d}`);
  console.log(`Bundles for ${r.collections.join(", ")} are up to date.`);
} else if (drift.length) {
  for (const d of drift) console.error(d);
  console.error(`\nGenerated bundles are out of date. Edit source/, then run: npx tsx scripts/generate.ts --write`);
  process.exit(1);
} else {
  console.log(`Bundles for ${r.collections.join(", ")} match their sources.`);
}
