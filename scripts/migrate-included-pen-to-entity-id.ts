/**
 * One-time migration: replace PenId strings in Tablet.Model.IncludedPen
 * with the full pen EntityId (e.g. "X3ELITE" -> "XPPEN.PEN.X3ELITE").
 *
 * Usage: npx tsx scripts/migrate-included-pen-to-entity-id.ts [--data-dir <dir>]
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { readDataJson, writeDataJson } from "../lib/data-json.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDirIdx = process.argv.indexOf("--data-dir");
const dataDir =
  dataDirIdx >= 0 ? path.resolve(process.argv[dataDirIdx + 1] ?? ".") : path.join(__dirname, "../data");
const pensDir = path.join(dataDir, "pens");
const tabletsDir = path.join(dataDir, "tablets");

// Build PenId -> EntityId map from all pen files
const penIdToEntityId = new Map<string, string>();
for (const file of fs.readdirSync(pensDir).filter(f => f.endsWith(".json"))) {
  const raw = readDataJson<any>(path.join(pensDir, file));
  const pens: Array<{ PenId: string; EntityId: string }> = raw.Pens ?? [];
  for (const pen of pens) {
    if (pen.PenId && pen.EntityId) {
      penIdToEntityId.set(pen.PenId, pen.EntityId);
    }
  }
}
console.log(`Loaded ${penIdToEntityId.size} pen records`);

let totalMigrated = 0;
let totalUnresolved = 0;

for (const file of fs.readdirSync(tabletsDir).filter(f => f.endsWith(".json"))) {
  const filePath = path.join(tabletsDir, file);
  const raw = readDataJson<any>(filePath);
  const topKey = Object.keys(raw)[0];
  const tablets: Array<Record<string, any>> = raw[topKey];
  let changed = false;

  for (const tablet of tablets) {
    const included: string[] | undefined = tablet.Model?.IncludedPen;
    if (!included || included.length === 0) continue;
    const migrated = included.map(id => {
      const eid = penIdToEntityId.get(id);
      if (!eid) {
        console.warn(`  [WARN] No EntityId found for PenId "${id}" in ${file}`);
        totalUnresolved++;
        return id; // leave as-is
      }
      return eid;
    });
    if (JSON.stringify(migrated) !== JSON.stringify(included)) {
      tablet.Model.IncludedPen = migrated;
      changed = true;
      totalMigrated++;
    }
  }

  if (changed) {
    writeDataJson(filePath, raw);
    console.log(`Updated ${file}`);
  }
}

console.log(`\nDone. Migrated ${totalMigrated} records. Unresolved: ${totalUnresolved}`);
