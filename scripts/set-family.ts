import { commitDatasetUpdate, type RecordUpdate } from "../lib/update-dataset.js";
// Assign Model.Family to one or more tablets.
// Usage: tsx scripts/set-family.ts <Family> <Tablet1> [Tablet2] [...] [--repo-root <dir>]
//
// <Family> is a tablet-family EntityId ("xppen.tabletfamily.xppenartistgen2")
// or just its last segment ("XPPenArtistGen2", case-insensitive). Model.Family
// is always written as the full EntityId.
// Each <Tablet> is a Model.Id ("CD100FH") or a tablet EntityId.
//
// Edits each tablet's source file (source/tablets/<brand>/<EntityId>.json),
// then regenerates the data/tablets/ bundles once (RFC #45 — the bundles are
// generated, never edited). --repo-root is the directory holding source/ and
// data/ (default: this data-repo; point it at a copy for testing).
//
// Example: tsx scripts/set-family.ts XPPenArtistGen2 CD100FH CD120FH CD130FH

import * as path from "path";
import { fileURLToPath } from "url";
import { loadTabletFamiliesFromDisk } from "../lib/drawtab-loader-node.js";
import { findFamily } from "../lib/family-lookup.js";
import { readSources, sourceCollection } from "../lib/sources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const rootIdx = argv.indexOf("--repo-root");
const repoRoot = rootIdx >= 0 ? path.resolve(argv[rootIdx + 1] ?? ".") : path.join(__dirname, "..");
const args = argv.filter((a, i) => a !== "--repo-root" && argv[i - 1] !== "--repo-root");

if (args.length < 2) {
  console.error("Usage: tsx scripts/set-family.ts <Family> <Tablet1> [Tablet2] [...] [--repo-root <dir>]");
  process.exit(1);
}

const [familyArg, ...tabletArgs] = args;

// Verify family exists (tablet families are still edited directly in data/)
const families = loadTabletFamiliesFromDisk(path.join(repoRoot, "data"));
const family = findFamily(families, familyArg);
if (!family) {
  console.error(`Family not found: ${familyArg}`);
  console.error(`Available: ${families.map((f) => f.EntityId).sort().join(", ")}`);
  process.exit(1);
}
const familyId = family.EntityId;

const tablets = sourceCollection("tablets");
const { records, issues } = readSources(repoRoot, tablets);
if (issues.length) {
  console.error("Tablet source problems (fix these first; nothing was written):");
  for (const i of issues) console.error(`  ${i.file}: ${i.problem}`);
  process.exit(1);
}

console.log(`Assigning family "${family.FamilyName}" (${familyId}) to ${tabletArgs.length} tablet(s)...\n`);

const pending = new Set(tabletArgs);
let updated = 0;
const changes: RecordUpdate[] = [];

interface TabletRecord {
  Meta?: { EntityId?: string };
  Model: { Id: string; Name?: string; Family?: string };
}

for (const { file, record } of records) {
  const tablet = record as unknown as TabletRecord;
  const key = [tablet.Model.Id, tablet.Meta?.EntityId].find((k) => k && pending.has(k));
  if (!key) continue;
  const old = tablet.Model.Family || "(none)";
  tablet.Model.Family = familyId;
  changes.push({ collection: "tablets", record });
  console.log(`  ${file}: ${tablet.Model.Id} (${tablet.Model.Name}) — ${old} -> ${familyId}`);
  updated++;
  pending.delete(key);
}

if (pending.size > 0) {
  console.error(`\nWarning: tablets not found: ${[...pending].join(", ")}`);
}

console.log(`\nUpdated ${updated} tablet(s).`);
if (updated > 0) for (const f of commitDatasetUpdate(repoRoot, changes).changed) console.log(`Regenerated ${f}.`);
