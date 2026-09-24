// Find tablets that have no Model.Family assigned, grouped by brand.
// Usage: tsx scripts/find-unfamilied.ts [--brand XPPEN]

import * as path from "path";
import { fileURLToPath } from "url";
import { loadTabletsFromDisk } from "../lib/drawtab-loader-node.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

const args = process.argv.slice(2);
const brandFilter = args.indexOf("--brand") >= 0 ? args[args.indexOf("--brand") + 1]?.toUpperCase() : undefined;

let tablets = loadTabletsFromDisk(dataDir);
if (brandFilter) {
  tablets = tablets.filter((t) => t.Model.Brand === brandFilter);
  // An unknown brand used to fall through to "All tablets have a family",
  // which is the opposite of what it means.
  if (tablets.length === 0) {
    console.error(`No tablets for brand ${brandFilter}.`);
    process.exit(1);
  }
}

const unfamilied = tablets.filter((t) => !t.Model.Family);
if (unfamilied.length === 0) {
  console.log("All tablets have a family assigned.");
  process.exit(0);
}

const byBrand = new Map<string, typeof unfamilied>();
for (const t of unfamilied) {
  const list = byBrand.get(t.Model.Brand) ?? [];
  list.push(t);
  byBrand.set(t.Model.Brand, list);
}

for (const [brand, list] of [...byBrand.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`\n=== ${brand} (${list.length} unfamilied) ===`);
  list.sort((a, b) => a.Model.Name.localeCompare(b.Model.Name));
  for (const t of list) {
    console.log(
      `  ${t.Model.Id.padEnd(20)} ${t.Model.Name.padEnd(30)} ${t.Model.ReleaseYear || "?"} ${(t.Model.IncludedPen ?? []).join(",") || "-"}`,
    );
  }
}

console.log(`\n${unfamilied.length} tablet(s) without a family.`);
