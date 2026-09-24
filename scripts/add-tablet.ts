// Add a new tablet record to data/tablets/<BRAND>-tablets.json.
//
// Usage:
//   tsx scripts/add-tablet.ts <spec.json>
//   tsx scripts/add-tablet.ts <spec.json> --dry-run
//   tsx scripts/add-tablet.ts <spec.json> --data-dir <dir>   (default: data/)
//
// The spec file is a partial Tablet record. Meta (EntityId, _id,
// _CreateDate, _ModifiedDate) is auto-filled if absent. The full record
// is validated against TabletSchema before write.
//
// The brand file is written with writeDataJson() (lib/data-json.ts), so it
// stays canonical and the diff is just the new record.

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import * as v from "valibot";
import { TabletSchema } from "../lib/schemas.js";
import { runDataQuality } from "../lib/data-quality.js";
import { formatDataJson, readDataJson, writeDataJson } from "../lib/data-json.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dataDirIdx = args.indexOf("--data-dir");
const dataDir =
  dataDirIdx >= 0 ? path.resolve(args[dataDirIdx + 1] ?? ".") : path.join(__dirname, "..", "data");
const specPath = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--data-dir");
if (!specPath) {
  console.error("Usage: tsx scripts/add-tablet.ts <spec.json> [--dry-run] [--data-dir <dir>]");
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

// --- Locate brand file (create on first tablet for the brand) ---

const filePath = path.join(dataDir, "tablets", `${brand}-tablets.json`);
let data: { DrawingTablets: any[] };
if (fs.existsSync(filePath)) {
  data = readDataJson<{ DrawingTablets: any[] }>(filePath);
  data.DrawingTablets ??= [];
} else {
  console.log(`Brand file does not exist; creating ${path.basename(filePath)}`);
  data = { DrawingTablets: [] };
}
const existing = data.DrawingTablets;

// --- Duplicate check ---

const eid = record.Meta.EntityId;
if (existing.some((t: any) => t?.Meta?.EntityId === eid)) {
  console.error(`Duplicate EntityId: ${eid}`);
  process.exit(1);
}

console.log(`Adding ${eid} (${record.Model.Name}) to ${path.basename(filePath)}`);
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

// --- Write back (canonical format, so only the new record shows in the diff) ---

data.DrawingTablets = [...existing, record];
writeDataJson(filePath, data);

console.log(`\nWrote ${eid}.`);

// --- Inline data-quality, scoped to the affected brand file ---

const brandFileName = path.basename(filePath);
const allIssues = runDataQuality(dataDir);
const scopedIssues = allIssues.filter((i) => i.file === brandFileName);

if (scopedIssues.length === 0) {
  console.log(`Data quality: no issues in ${brandFileName}.`);
} else {
  const newOnly = scopedIssues.filter((i) => i.entityId === eid);
  const others = scopedIssues.filter((i) => i.entityId !== eid);
  console.log(`\nData quality issues in ${brandFileName} (${scopedIssues.length}):`);
  const print = (group: typeof scopedIssues, label: string) => {
    if (group.length === 0) return;
    console.log(`  ${label}:`);
    for (const { entityId, field, issue, value } of group) {
      const valuePart = value !== undefined ? ` => ${value}` : "";
      console.log(`    ${entityId} | ${field} | ${issue}${valuePart}`);
    }
  };
  print(newOnly, `from the new record (${eid})`);
  print(others, "pre-existing in this brand file");
}

console.log(`\nReminder: data-repo changes need TWO commits — one inside data-repo/, then one in the outer repo to advance the submodule pointer.`);
