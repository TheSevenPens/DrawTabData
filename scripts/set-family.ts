// Assign Model.Family to one or more tablets.
// Usage: tsx scripts/set-family.ts <Family> <Tablet1> [Tablet2] [...] [--data-dir <dir>]
//
// <Family> is a tablet-family EntityId ("xppen.tabletfamily.xppenartistgen2")
// or just its last segment ("XPPenArtistGen2", case-insensitive). Model.Family
// is always written as the full EntityId.
// Each <Tablet> is a Model.Id ("CD100FH") or a tablet EntityId.
//
// Example: tsx scripts/set-family.ts XPPenArtistGen2 CD100FH CD120FH CD130FH

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadTabletFamiliesFromDisk } from "../lib/drawtab-loader-node.js";
import { readDataJson, writeDataJson } from "../lib/data-json.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const dataDirIdx = argv.indexOf("--data-dir");
const dataDir =
  dataDirIdx >= 0 ? path.resolve(argv[dataDirIdx + 1] ?? ".") : path.join(__dirname, "..", "data");
const tabletsDir = path.join(dataDir, "tablets");
const args = argv.filter((a, i) => a !== "--data-dir" && argv[i - 1] !== "--data-dir");

if (args.length < 2) {
  console.error("Usage: tsx scripts/set-family.ts <Family> <Tablet1> [Tablet2] [...] [--data-dir <dir>]");
  process.exit(1);
}

const [familyArg, ...tabletArgs] = args;

// Verify family exists
const families = loadTabletFamiliesFromDisk(dataDir);
const wanted = familyArg.toLowerCase();
const family = families.find(
  (f) => f.EntityId.toLowerCase() === wanted || f.EntityId.toLowerCase().split(".").pop() === wanted,
);
if (!family) {
  console.error(`Family not found: ${familyArg}`);
  console.error(`Available: ${families.map((f) => f.EntityId).sort().join(", ")}`);
  process.exit(1);
}
const familyId = family.EntityId;

console.log(`Assigning family "${family.FamilyName}" (${familyId}) to ${tabletArgs.length} tablet(s)...\n`);

const pending = new Set(tabletArgs);
let updated = 0;

interface TabletRecord {
  Meta?: { EntityId?: string };
  Model: { Id: string; Name?: string; Family?: string };
}

// Process each brand file
const files = fs.readdirSync(tabletsDir).filter((f) => f.endsWith("-tablets.json"));
for (const file of files) {
  const filePath = path.join(tabletsDir, file);
  const data = readDataJson<{ DrawingTablets: TabletRecord[] }>(filePath);
  let fileModified = false;

  for (const tablet of data.DrawingTablets) {
    const key = [tablet.Model.Id, tablet.Meta?.EntityId].find((k) => k && pending.has(k));
    if (!key) continue;
    const old = tablet.Model.Family || "(none)";
    tablet.Model.Family = familyId;
    console.log(`  ${file}: ${tablet.Model.Id} (${tablet.Model.Name}) — ${old} -> ${familyId}`);
    updated++;
    fileModified = true;
    pending.delete(key);
  }

  if (fileModified) {
    writeDataJson(filePath, data);
  }
}

if (pending.size > 0) {
  console.error(`\nWarning: tablets not found: ${[...pending].join(", ")}`);
}

console.log(`\nUpdated ${updated} tablet(s).`);
