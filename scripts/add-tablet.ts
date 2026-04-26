// Add a new tablet record to data/tablets/<BRAND>-tablets.json.
//
// Usage:
//   tsx scripts/add-tablet.ts <spec.json>
//   tsx scripts/add-tablet.ts <spec.json> --dry-run
//
// The spec file is a partial Tablet record. Meta (EntityId, _id,
// _CreateDate, _ModifiedDate) is auto-filled if absent. The full record
// is validated against TabletSchema before write.
//
// Format preservation: the brand JSON file is rewritten via Windows
// PowerShell ConvertTo-Json so the existing wide-indent format is kept.

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import * as v from "valibot";
import { TabletSchema } from "../lib/schemas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const specPath = args.find((a) => !a.startsWith("--"));
if (!specPath) {
  console.error("Usage: tsx scripts/add-tablet.ts <spec.json> [--dry-run]");
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
const brand: string | undefined = spec?.Model?.Brand;
const id: string | undefined = spec?.Model?.Id;
const type: string | undefined = spec?.Model?.Type;

if (!brand || !id || !type) {
  console.error("Spec must include Model.Brand, Model.Id, and Model.Type.");
  process.exit(1);
}

// --- Auto-fill Meta ---

const now = new Date().toISOString();
const derivedEntityId =
  brand.toLowerCase() +
  ".tablet." +
  id.replace(/[^A-Za-z0-9]/g, "").toLowerCase();

spec.Meta = {
  EntityId: spec.Meta?.EntityId ?? derivedEntityId,
  _id: spec.Meta?._id ?? randomUUID(),
  _CreateDate: spec.Meta?._CreateDate ?? now,
  _ModifiedDate: spec.Meta?._ModifiedDate ?? now,
};

// --- Validate ---

const result = v.safeParse(TabletSchema, spec);
if (!result.success) {
  console.error("Validation failed:");
  for (const iss of result.issues) {
    const where = (iss.path ?? []).map((p: any) => p.key).join(".") || "(root)";
    console.error(`  ${where}: ${iss.message}`);
  }
  process.exit(1);
}

// --- Locate brand file ---

const filePath = path.join(dataDir, "tablets", `${brand}-tablets.json`);
if (!fs.existsSync(filePath)) {
  console.error(`Brand file not found: ${filePath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
const existing = data.DrawingTablets ?? [];

// --- Duplicate check ---

const eid = spec.Meta.EntityId;
if (existing.some((t: any) => t?.Meta?.EntityId === eid)) {
  console.error(`Duplicate EntityId: ${eid}`);
  process.exit(1);
}

console.log(`Adding ${eid} (${spec.Model.Name}) to ${path.basename(filePath)}`);
console.log(`  Type: ${type}`);
console.log(`  LaunchYear: ${spec.Model.LaunchYear}`);
if (spec.Model.IncludedPen?.length) {
  console.log(`  IncludedPen: ${spec.Model.IncludedPen.join(", ")}`);
}

if (dryRun) {
  console.log("\n--dry-run: no write.");
  console.log("\nRecord:");
  console.log(JSON.stringify(spec, null, 2));
  process.exit(0);
}

// --- Write back, preserving the existing PowerShell wide-indent format ---

data.DrawingTablets = [...existing, spec];
const tempFile = filePath + ".tmp";
fs.writeFileSync(tempFile, JSON.stringify(data));

// Use Windows PowerShell 5.1 (powershell.exe) for the legacy wide-indent
// ConvertTo-Json format. UTF-8-without-BOM via WriteAllText.
const psScript = [
  `$obj = Get-Content -LiteralPath '${tempFile}' -Raw | ConvertFrom-Json`,
  `$json = $obj | ConvertTo-Json -Depth 30`,
  `[System.IO.File]::WriteAllText('${filePath}', $json)`,
].join("; ");

try {
  execFileSync("powershell.exe", ["-NoProfile", "-Command", psScript], {
    stdio: "inherit",
  });
} finally {
  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
}

console.log(`\nWrote ${eid}.`);
console.log(`Reminder: data-repo changes need TWO commits — one inside data-repo/, then one in the outer repo to advance the submodule pointer.`);
