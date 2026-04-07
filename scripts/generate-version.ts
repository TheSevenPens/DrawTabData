// Generates data/version.json with git metadata and record counts.
// Run via `npm run version` from the data-repo root.

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const dataDir = path.join(repoRoot, "data");

function git(args: string): string {
  return execSync(`git ${args}`, { cwd: repoRoot }).toString().trim();
}

function countRecords(dir: string, suffix: string, rootKey: string): number {
  const dirPath = path.join(dataDir, dir);
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  for (const f of fs.readdirSync(dirPath).filter((f) => f.endsWith(suffix))) {
    const data = JSON.parse(fs.readFileSync(path.join(dirPath, f), "utf-8"));
    const items = data[rootKey];
    if (Array.isArray(items)) total += items.length;
  }
  return total;
}

function countSingleFile(file: string, rootKey: string): number {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) return 0;
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return Array.isArray(data[rootKey]) ? data[rootKey].length : 0;
}

const commit = git("rev-parse HEAD");
const shortCommit = git("rev-parse --short HEAD");
const commitDate = git("log -1 --format=%cI");
const version = commitDate.slice(0, 10).replace(/-/g, "."); // YYYY.MM.DD

const counts = {
  tablets: countRecords("tablets", "-tablets.json", "DrawingTablets"),
  pens: countRecords("pens", "-pens.json", "Pens"),
  penFamilies: countRecords("pen-families", "-pen-families.json", "PenFamilies"),
  tabletFamilies: countRecords("tablet-families", "-tablet-families.json", "TabletFamilies"),
  drivers: countRecords("drivers", "-drivers.json", "Drivers"),
  brands: countSingleFile("brands/brands.json", "Brands"),
  pressureResponse: countRecords("pressure-response", "-pressure-response.json", "PressureResponse"),
};

const versionInfo = {
  schemaVersion: 1,
  version,
  commit,
  shortCommit,
  commitDate,
  counts,
};

const outPath = path.join(dataDir, "version.json");
fs.writeFileSync(outPath, JSON.stringify(versionInfo, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
console.log(JSON.stringify(versionInfo, null, 2));
