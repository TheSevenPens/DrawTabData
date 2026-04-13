// Show all tablets in a given family.
// Usage: tsx scripts/show-family.ts XPPenArtistGen2

import * as path from "path";
import { fileURLToPath } from "url";
import { loadTabletsFromDisk, loadTabletFamiliesFromDisk, getDiagonal } from "../lib/drawtab-loader-node.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

const familyId = process.argv[2];
if (!familyId) {
  console.error("Usage: tsx scripts/show-family.ts <FamilyId>");
  const families = loadTabletFamiliesFromDisk(dataDir);
  console.error(`\nAvailable families:`);
  for (const f of families.sort((a, b) => a.Brand.localeCompare(b.Brand) || a.FamilyId.localeCompare(b.FamilyId))) {
    console.error(`  ${f.FamilyId.padEnd(30)} ${f.FamilyName}`);
  }
  process.exit(1);
}

const families = loadTabletFamiliesFromDisk(dataDir);
const family = families.find(f => f.FamilyId === familyId);

if (!family) {
  console.error(`Family not found: ${familyId}`);
  process.exit(1);
}

console.log(`=== ${family.FamilyName} (${family.FamilyId}) ===\n`);

const tablets = loadTabletsFromDisk(dataDir);
const members = tablets.filter(t => t.ModelFamily === familyId);

if (members.length === 0) {
  console.log("No tablets assigned to this family.");
  process.exit(0);
}

members.sort((a, b) => (a.ModelLaunchYear || "").localeCompare(b.ModelLaunchYear || "") || a.ModelName.localeCompare(b.ModelName));

console.log(
  ["ModelId", "ModelName", "Year", "Type", "Pen", "Diagonal(mm)"]
    .join("\t")
);

for (const t of members) {
  const diag = getDiagonal(t.DigitizerDimensions);
  console.log([
    t.ModelId,
    t.ModelName,
    t.ModelLaunchYear || "?",
    t.ModelType,
    (t.ModelIncludedPen ?? []).join(",") || "-",
    diag ? diag.toFixed(1) : "-",
  ].join("\t"));
}

console.log(`\n${members.length} member(s).`);
