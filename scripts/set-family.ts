// Assign ModelFamily to one or more tablets by ModelId.
// Usage: tsx scripts/set-family.ts <FamilyId> <ModelId1> [ModelId2] [...]
//
// Example: tsx scripts/set-family.ts XPPenArtistGen2 CD100FH CD120FH CD130FH

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadTabletFamiliesFromDisk } from "../lib/drawtab-loader-node.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const tabletsDir = path.join(dataDir, "tablets");

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: tsx scripts/set-family.ts <FamilyId> <ModelId1> [ModelId2] [...]");
  process.exit(1);
}

const [familyId, ...modelIds] = args;

// Verify family exists
const families = loadTabletFamiliesFromDisk(dataDir);
const family = families.find(f => f.FamilyId === familyId);
if (!family) {
  console.error(`Family not found: ${familyId}`);
  console.error(`Available: ${families.map(f => f.FamilyId).sort().join(", ")}`);
  process.exit(1);
}

console.log(`Assigning family "${family.FamilyName}" (${familyId}) to ${modelIds.length} tablet(s)...\n`);

const targetIds = new Set(modelIds);
let updated = 0;

// Process each brand file
const files = fs.readdirSync(tabletsDir).filter(f => f.endsWith("-tablets.json"));
for (const file of files) {
  const filePath = path.join(tabletsDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  let fileModified = false;

  for (const tablet of data.DrawingTablets) {
    if (targetIds.has(tablet.ModelId)) {
      const old = tablet.ModelFamily || "(none)";
      tablet.ModelFamily = familyId;
      console.log(`  ${file}: ${tablet.ModelId} (${tablet.ModelName}) — ${old} -> ${familyId}`);
      updated++;
      fileModified = true;
      targetIds.delete(tablet.ModelId);
    }
  }

  if (fileModified) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  }
}

if (targetIds.size > 0) {
  console.error(`\nWarning: ModelIds not found: ${[...targetIds].join(", ")}`);
}

console.log(`\nUpdated ${updated} tablet(s).`);
