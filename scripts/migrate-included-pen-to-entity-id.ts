/**
 * One-time migration: replace PenId strings in Tablet.Model.IncludedPen
 * with the full pen EntityId (e.g. "X3ELITE" -> "XPPEN.PEN.X3ELITE").
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "../data");
const pensDir = path.join(dataDir, "pens");
const tabletsDir = path.join(dataDir, "tablets");

// Build PenId -> EntityId map from all pen files
const penIdToEntityId = new Map<string, string>();
for (const file of fs.readdirSync(pensDir).filter(f => f.endsWith(".json"))) {
  const raw = JSON.parse(fs.readFileSync(path.join(pensDir, file), "utf8"));
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
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
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
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + "\n");
    console.log(`Updated ${file}`);
  }
}

console.log(`\nDone. Migrated ${totalMigrated} records. Unresolved: ${totalUnresolved}`);
