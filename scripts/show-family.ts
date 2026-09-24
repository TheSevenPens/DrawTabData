// Show all tablets in a given family.
// Usage: tsx scripts/show-family.ts <Family>
//   <Family> is the family EntityId or its last segment, e.g.
//   xppen.tabletfamily.xppenartistgen2 or xppenartistgen2.

import * as path from "path";
import { fileURLToPath } from "url";
import { loadTabletsFromDisk, loadTabletFamiliesFromDisk, getDiagonal } from "../lib/drawtab-loader-node.js";
import { findFamily } from "../lib/family-lookup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

const families = loadTabletFamiliesFromDisk(dataDir);
const familyArg = process.argv[2];
if (!familyArg) {
  console.error("Usage: tsx scripts/show-family.ts <Family>");
  console.error(`\nAvailable families:`);
  for (const f of [...families].sort((a, b) => a.EntityId.localeCompare(b.EntityId))) {
    console.error(`  ${f.EntityId.padEnd(50)} ${f.FamilyName}`);
  }
  process.exit(1);
}

const family = findFamily(families, familyArg);
if (!family) {
  console.error(`Family not found: ${familyArg}`);
  process.exit(1);
}

console.log(`=== ${family.FamilyName} (${family.EntityId}) ===\n`);

// Model.Family holds the family EntityId (see CLAUDE.md "Adding a new brand").
const members = loadTabletsFromDisk(dataDir).filter((t) => t.Model.Family === family.EntityId);
if (members.length === 0) {
  console.log("No tablets assigned to this family.");
  process.exit(0);
}

members.sort(
  (a, b) =>
    (a.Model.ReleaseYear || "").localeCompare(b.Model.ReleaseYear || "") ||
    a.Model.Name.localeCompare(b.Model.Name),
);

console.log(["ModelId", "Name", "Year", "Type", "Pen", "Diagonal(mm)"].join("\t"));
for (const t of members) {
  const diag = getDiagonal(t.Digitizer?.Dimensions);
  console.log(
    [
      t.Model.Id,
      t.Model.Name,
      t.Model.ReleaseYear || "?",
      t.Model.Type,
      (t.Model.IncludedPen ?? []).join(",") || "-",
      diag ? diag.toFixed(1) : "-",
    ].join("\t"),
  );
}

console.log(`\n${members.length} member(s).`);
