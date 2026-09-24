/**
 * RETIRED one-time migration: replaced PenId strings in Tablet.Model.IncludedPen
 * with the full pen EntityId (e.g. "X3ELITE" -> "xppen.pen.x3elite").
 *
 * It was applied in 8bb362a ("store pen EntityIds in Model.IncludedPen") and
 * edited the old data/tablets/ brand bundles, which are now generated from
 * source/tablets/ (RFC #45). Re-running the rewrite would be a no-op at best:
 * every value is already an EntityId, which the old PenId lookup can't match.
 * The original code is in git history (see ac903bf).
 *
 * What it does now: a read-only check that the migration still holds — every
 * IncludedPen value in the tablet sources is an existing pen EntityId. Exits 1
 * listing the offenders otherwise (fix those in their source files).
 *
 * Usage: npx tsx scripts/migrate-included-pen-to-entity-id.ts [--repo-root <dir>]
 */
import * as path from "path";
import { fileURLToPath } from "url";
import { readSources, sourceCollection } from "../lib/sources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootIdx = process.argv.indexOf("--repo-root");
const repoRoot = rootIdx >= 0 ? path.resolve(process.argv[rootIdx + 1] ?? ".") : path.join(__dirname, "..");

console.log("This one-time migration was already applied (8bb362a); it no longer rewrites anything.");

const penIds = new Set(readSources(repoRoot, sourceCollection("pens")).records.map((r) => r.entityId));
let total = 0;
const offenders: string[] = [];
for (const { file, record } of readSources(repoRoot, sourceCollection("tablets")).records) {
  const included = (record.Model as { IncludedPen?: string[] } | undefined)?.IncludedPen ?? [];
  for (const id of included) {
    total++;
    if (!penIds.has(id)) offenders.push(`  ${file}: "${id}" is not a pen EntityId`);
  }
}

if (offenders.length) {
  console.error(`\n${offenders.length} of ${total} IncludedPen value(s) are not pen EntityIds:`);
  for (const o of offenders) console.error(o);
  process.exit(1);
}
console.log(`Check: all ${total} IncludedPen values are pen EntityIds.`);
