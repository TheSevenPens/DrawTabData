import { commitDatasetUpdate } from "../lib/update-dataset.js";
// Find a pen by name/id, or scaffold a new one.
//
// Usage:
//   tsx scripts/find-or-add-pen.ts <query>
//     -- Search PenName, PenId, EntityId for a substring match.
//
//   tsx scripts/find-or-add-pen.ts --add <BRAND> <PenId> "<PenName>" [--year YYYY]
//     -- Add a new pen: writes source/pens/<brand>/<EntityId>.json, then
//        regenerates the data/pens/ bundles from the sources (RFC #45 — the
//        bundles are generated, never edited).
//        EntityId derived as <brand>.pen.<penid> (lowercase, alphanumeric only).
//
//   tsx scripts/find-or-add-pen.ts --add ... --dry-run
//     -- Print the record without writing.
//
//   --repo-root <dir>   the directory holding source/ and data/ (default:
//                       this data-repo; point it at a copy for testing)

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import * as v from "valibot";
import { PenSchema } from "../lib/schemas.js";
import { formatDataJson } from "../lib/data-json.js";
import { readSources, sourceCollection, sourcePath } from "../lib/sources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const isAdd = args.includes("--add");
const dryRun = args.includes("--dry-run");
const rootIdx = args.indexOf("--repo-root");
const repoRoot = rootIdx >= 0 ? path.resolve(args[rootIdx + 1] ?? ".") : path.join(__dirname, "..");
const pens = sourceCollection("pens");
// Positional args, minus the values that belong to --repo-root / --year.
const positional = args.filter(
  (a, i) => !a.startsWith("--") && args[i - 1] !== "--repo-root" && args[i - 1] !== "--year",
);

// The sources are the authoritative copy. Stop on any problem in them —
// regenerate() would refuse to write anyway.
const { records: sources, issues: sourceIssues } = readSources(repoRoot, pens);
if (sourceIssues.length) {
  console.error("Pen source problems (fix these first; nothing was written):");
  for (const i of sourceIssues) console.error(`  ${i.file}: ${i.problem}`);
  process.exit(1);
}

if (!isAdd) {
  // --- Search mode ---
  const query = positional[0];
  if (!query) {
    console.error("Usage: tsx scripts/find-or-add-pen.ts <query>");
    console.error("       tsx scripts/find-or-add-pen.ts --add <BRAND> <PenId> \"<PenName>\" [--year YYYY]");
    process.exit(1);
  }
  const q = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  const matches: Array<{ file: string; pen: any; score: number }> = [];

  for (const { file, record } of sources) {
    const pen = record as any;
    const haystack = [pen.PenName, pen.PenId, pen.EntityId]
      .filter(Boolean)
      .map((s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ""))
      .join(" ");
    if (haystack.includes(q)) {
      // exact-name match scores highest, then PenId, then substring
      const score =
        (pen.PenName?.toLowerCase().replace(/[^a-z0-9]/g, "") === q ? 100 : 0) +
        (pen.PenId?.toLowerCase().replace(/[^a-z0-9]/g, "") === q ? 80 : 0) +
        (haystack.includes(q) ? 10 : 0);
      matches.push({ file, pen, score });
    }
  }

  if (matches.length === 0) {
    console.log(`No pen matches "${query}".`);
    console.log(`To add one: tsx scripts/find-or-add-pen.ts --add <BRAND> <PenId> "<PenName>" [--year YYYY]`);
    process.exit(1);
  }

  matches.sort((a, b) => b.score - a.score);
  console.log(`${matches.length} match${matches.length === 1 ? "" : "es"}:`);
  for (const { file, pen } of matches) {
    console.log(`  ${pen.EntityId.padEnd(36)} ${(pen.PenName ?? "").padEnd(28)} (${file})`);
  }
  process.exit(0);
}

// --- Add mode ---

const brandIn = positional[0];
const penIdIn = positional[1];
const penName = positional[2];
const yearFlag = args.indexOf("--year");
const year = yearFlag >= 0 ? args[yearFlag + 1] : "";

if (!brandIn || !penIdIn || !penName) {
  console.error("Usage: tsx scripts/find-or-add-pen.ts --add <BRAND> <PenId> \"<PenName>\" [--year YYYY]");
  process.exit(1);
}

const brand = brandIn.toUpperCase();
const penId = penIdIn.toUpperCase();
const entityId = `${brand.toLowerCase()}.pen.${penId.replace(/[^A-Za-z0-9]/g, "").toLowerCase()}`;
const now = new Date().toISOString();

const record = {
  EntityId: entityId,
  Brand: brand,
  PenId: penId,
  PenName: penName,
  PenFamily: "",
  ReleaseYear: year,
  _id: randomUUID(),
  _CreateDate: now,
  _ModifiedDate: now,
};

const result = v.safeParse(PenSchema, record);
if (!result.success) {
  console.error("Validation failed:");
  for (const iss of result.issues) {
    const where = (iss.path ?? []).map((p: any) => p.key).join(".") || "(root)";
    console.error(`  ${where}: ${iss.message}`);
  }
  process.exit(1);
}

const sourceRel = sourcePath(pens, brand, entityId);
const clash = sources.find((r) => r.entityId.toLowerCase() === entityId);
if (clash || fs.existsSync(path.join(repoRoot, sourceRel))) {
  console.error(`Duplicate EntityId: ${entityId} (${clash?.file ?? sourceRel})`);
  process.exit(1);
}

if (!sources.some((r) => r.brand === brand)) {
  console.log(`First ${brand} pen; the generator will create ${brand}-pens.json`);
}
console.log(`Adding ${entityId} (${penName}) as ${sourceRel}`);

if (dryRun) {
  console.log("\n--dry-run: no write.");
  console.log("\nRecord:");
  process.stdout.write(formatDataJson(record));
  process.exit(0);
}

const updated = commitDatasetUpdate(repoRoot, [{ collection: "pens", record }]);
console.log(`\nWrote ${sourceRel}.`);
for (const f of updated.changed) console.log(`Regenerated ${f}.`);

console.log(
  "\nReminder: data-repo changes need TWO commits — one inside data-repo/ (the new source file AND the regenerated bundle), then one in the outer repo to advance the submodule pointer.",
);
