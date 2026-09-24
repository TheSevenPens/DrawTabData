// Add a new tablet: writes its source file
// source/tablets/<brand>/<EntityId>.json, then regenerates the brand bundles
// under data/tablets/ (RFC #45 — the bundles are generated, never edited).
//
// Usage:
//   tsx scripts/add-tablet.ts <spec.json>
//   tsx scripts/add-tablet.ts <spec.json> --dry-run
//   tsx scripts/add-tablet.ts <spec.json> --repo-root <dir>   (default: this data-repo)
//
// The spec file is a partial Tablet record. Meta (EntityId, _id,
// _CreateDate, _ModifiedDate) is auto-filled if absent. The full record
// is validated against TabletSchema before write.
//
// --repo-root is the directory holding source/ and data/ (a copy of the
// data-repo, for testing).

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import * as v from "valibot";
import { TabletSchema } from "../lib/schemas.js";
import { runDataQuality } from "../lib/data-quality.js";
import { formatDataJson, readDataJson } from "../lib/data-json.js";
import { readSources, regenerate, sourceCollection, sourcePath, writeSourceRecord } from "../lib/sources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const rootIdx = args.indexOf("--repo-root");
const repoRoot = rootIdx >= 0 ? path.resolve(args[rootIdx + 1] ?? ".") : path.join(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const specPath = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--repo-root");
if (!specPath) {
  console.error("Usage: tsx scripts/add-tablet.ts <spec.json> [--dry-run] [--repo-root <dir>]");
  process.exit(1);
}

const spec = readDataJson<any>(specPath);
const brand: string | undefined = spec?.Model?.Brand;
const id: string | undefined = spec?.Model?.Id;
const type: string | undefined = spec?.Model?.Type;

if (!brand || !id || !type) {
  console.error("Spec must include Model.Brand, Model.Id, and Model.Type.");
  process.exit(1);
}

// --- Auto-fill Meta ---

const now = new Date().toISOString();
const normalize = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
const idSuffix: string | undefined = spec?.Model?.IdSuffix;
const derivedEntityId =
  brand.toLowerCase() +
  ".tablet." +
  normalize(id) +
  (idSuffix ? "_" + normalize(idSuffix) : "");

// Existing records lead with Meta, then Model; the spec's other sections
// (Digitizer, Display, Physical, ...) follow in the order the spec gives.
const { Meta: specMeta, Model: specModel, ...specRest } = spec;
const record = {
  Meta: {
    EntityId: specMeta?.EntityId ?? derivedEntityId,
    _id: specMeta?._id ?? randomUUID(),
    _CreateDate: specMeta?._CreateDate ?? now,
    _ModifiedDate: specMeta?._ModifiedDate ?? now,
  },
  Model: specModel,
  ...specRest,
};

// --- Validate ---

const result = v.safeParse(TabletSchema, record);
if (!result.success) {
  console.error("Validation failed:");
  for (const iss of result.issues) {
    const where = (iss.path ?? []).map((p: any) => p.key).join(".") || "(root)";
    console.error(`  ${where}: ${iss.message}`);
  }
  process.exit(1);
}

// --- Duplicate check (against the sources, which are authoritative) ---

const tablets = sourceCollection("tablets");
const eid: string = record.Meta.EntityId;
const sourceRel = sourcePath(tablets, brand, eid);
const { records: existing, issues: sourceIssues } = readSources(repoRoot, tablets);
if (sourceIssues.length) {
  // regenerate() would refuse anyway — stop before adding a file.
  console.error("Fix these source problems first (nothing was written):");
  for (const i of sourceIssues) console.error(`  ${i.file}: ${i.problem}`);
  process.exit(1);
}
const clash = existing.find((r) => r.entityId.toLowerCase() === eid.toLowerCase());
if (clash || fs.existsSync(path.join(repoRoot, sourceRel))) {
  console.error(`Duplicate EntityId: ${eid} (${clash?.file ?? sourceRel})`);
  process.exit(1);
}

const bundleName = `${brand}-tablets.json`;
if (!existing.some((r) => r.brand === brand)) {
  console.log(`First ${brand} tablet; the generator will create ${bundleName}`);
}
console.log(`Adding ${eid} (${record.Model.Name}) as ${sourceRel}`);
console.log(`  Type: ${type}`);
console.log(`  ReleaseYear: ${record.Model.ReleaseYear}`);
if (record.Model.IncludedPen?.length) {
  console.log(`  IncludedPen: ${record.Model.IncludedPen.join(", ")}`);
}

if (dryRun) {
  console.log("\n--dry-run: no write.");
  console.log("\nRecord:");
  process.stdout.write(formatDataJson(record));
  process.exit(0);
}

// --- Write the source, then regenerate the bundles from it ---

writeSourceRecord(repoRoot, tablets, record);
console.log(`\nWrote ${sourceRel}.`);
for (const f of regenerate(repoRoot)) console.log(`Regenerated ${f}.`);

// --- Inline data-quality, scoped to the affected brand bundle ---

const allIssues = runDataQuality(dataDir);
const scopedIssues = allIssues.filter((i) => i.file === bundleName);

if (scopedIssues.length === 0) {
  console.log(`Data quality: no issues in ${bundleName}.`);
} else {
  const newOnly = scopedIssues.filter((i) => i.entityId === eid);
  const others = scopedIssues.filter((i) => i.entityId !== eid);
  console.log(`\nData quality issues in ${bundleName} (${scopedIssues.length}):`);
  const print = (group: typeof scopedIssues, label: string) => {
    if (group.length === 0) return;
    console.log(`  ${label}:`);
    for (const { entityId, field, issue, value } of group) {
      const valuePart = value !== undefined ? ` => ${value}` : "";
      console.log(`    ${entityId} | ${field} | ${issue}${valuePart}`);
    }
  };
  print(newOnly, `from the new record (${eid})`);
  print(others, "pre-existing for this brand");
}

console.log(`\nReminder: data-repo changes need TWO commits — one inside data-repo/ (the new source file AND the regenerated bundle), then one in the outer repo to advance the submodule pointer.`);
