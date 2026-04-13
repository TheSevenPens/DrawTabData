// Find tablets that have no ModelFamily assigned, grouped by brand.
// Usage: tsx scripts/find-unfamilied.ts [--brand XPPEN]

import * as path from "path";
import { fileURLToPath } from "url";
import { loadTabletsFromDisk } from "../lib/drawtab-loader-node.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

const args = process.argv.slice(2);
const brandFilter = args.indexOf("--brand") >= 0 ? args[args.indexOf("--brand") + 1]?.toUpperCase() : undefined;

let tablets = loadTabletsFromDisk(dataDir);
if (brandFilter) tablets = tablets.filter(t => t.Brand === brandFilter);

const unfamilied = tablets.filter(t => !t.ModelFamily);
if (unfamilied.length === 0) {
  console.log("All tablets have a family assigned.");
  process.exit(0);
}

const byBrand = new Map<string, typeof unfamilied>();
for (const t of unfamilied) {
  const list = byBrand.get(t.Brand) ?? [];
  list.push(t);
  byBrand.set(t.Brand, list);
}

for (const [brand, tablets] of [...byBrand.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`\n=== ${brand} (${tablets.length} unfamilied) ===`);
  tablets.sort((a, b) => a.ModelName.localeCompare(b.ModelName));
  for (const t of tablets) {
    console.log(`  ${t.ModelId.padEnd(20)} ${t.ModelName.padEnd(30)} ${t.ModelLaunchYear || "?"} ${(t.ModelIncludedPen ?? []).join(",") || "-"}`);
  }
}

console.log(`\n${unfamilied.length} tablet(s) without a family.`);
