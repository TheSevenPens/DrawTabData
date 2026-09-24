// Find a pen by name/id, or scaffold a new one.
//
// Usage:
//   tsx scripts/find-or-add-pen.ts <query>
//     -- Search PenName, PenId, EntityId for a substring match.
//
//   tsx scripts/find-or-add-pen.ts --add <BRAND> <PenId> "<PenName>" [--year YYYY]
//     -- Add a new pen record to data/pens/<BRAND>-pens.json.
//        EntityId derived as <brand>.pen.<penid> (lowercase, alphanumeric only).
//
//   tsx scripts/find-or-add-pen.ts --add ... --dry-run
//     -- Print the record without writing.
//
//   --data-dir <dir>   use another data directory (default: data/)
//
// The brand file is written with writeDataJson() (lib/data-json.ts), so it
// stays canonical and the diff is just the new record.

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import * as v from "valibot";
import { PenSchema } from "../lib/schemas.js";
import { formatDataJson, readDataJson, writeDataJson } from "../lib/data-json.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const isAdd = args.includes("--add");
const dryRun = args.includes("--dry-run");
const dataDirIdx = args.indexOf("--data-dir");
const dataDir =
  dataDirIdx >= 0 ? path.resolve(args[dataDirIdx + 1] ?? ".") : path.join(__dirname, "..", "data");
const pensDir = path.join(dataDir, "pens");
// Positional args, minus the values that belong to --data-dir / --year.
const positional = args.filter(
  (a, i) => !a.startsWith("--") && args[i - 1] !== "--data-dir" && args[i - 1] !== "--year",
);

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

  for (const file of fs.readdirSync(pensDir).filter((f) => f.endsWith("-pens.json"))) {
    const data = readDataJson<any>(path.join(pensDir, file));
    for (const pen of data.Pens ?? []) {
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

const filePath = path.join(pensDir, `${brand}-pens.json`);
if (!fs.existsSync(filePath)) {
  console.error(`Brand file not found: ${filePath}`);
  process.exit(1);
}

const data = readDataJson<any>(filePath);
const existing = data.Pens ?? [];

if (existing.some((p: any) => p?.EntityId === entityId)) {
  console.error(`Duplicate EntityId: ${entityId}`);
  process.exit(1);
}

console.log(`Adding ${entityId} (${penName}) to ${path.basename(filePath)}`);

if (dryRun) {
  console.log("\n--dry-run: no write.");
  console.log("\nRecord:");
  process.stdout.write(formatDataJson(record));
  process.exit(0);
}

// Canonical format, so only the new record shows in the diff.
data.Pens = [...existing, record];
writeDataJson(filePath, data);

console.log(`\nWrote ${entityId}.`);
