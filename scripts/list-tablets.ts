// List tablets with key fields, optionally filtered by brand and/or type.
// Usage: tsx scripts/list-tablets.ts [--brand XPPEN] [--type PENDISPLAY]

import * as path from "path";
import { fileURLToPath } from "url";
import { loadTabletsFromDisk, getDiagonal } from "../lib/drawtab-loader-node.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const brandFilter = getArg("brand")?.toUpperCase();
const typeFilter = getArg("type")?.toUpperCase();

let tablets = loadTabletsFromDisk(dataDir);

if (brandFilter) tablets = tablets.filter(t => t.Model.Brand === brandFilter);
if (typeFilter) tablets = tablets.filter(t => t.Model.Type === typeFilter);

tablets.sort((a, b) => a.Model.Brand.localeCompare(b.Model.Brand) || a.Model.Name.localeCompare(b.Model.Name));

console.log(
  ["Brand", "ModelId", "ModelName", "Year", "Type", "Pen", "Family", "Diagonal(mm)"]
    .join("\t")
);

for (const t of tablets) {
  const diag = getDiagonal(t.Digitizer?.Dimensions);
  console.log([
    t.Model.Brand,
    t.Model.Id,
    t.Model.Name,
    t.Model.ReleaseYear || "?",
    t.Model.Type,
    (t.Model.IncludedPen ?? []).join(",") || "-",
    t.Model.Family || "-",
    diag ? diag.toFixed(1) : "-",
  ].join("\t"));
}

console.log(`\n${tablets.length} tablet(s) found.`);
