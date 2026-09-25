// Add driver records to data/drivers/<BRAND>-drivers.json.
//
// Usage:
//   npx tsx scripts/add-driver-record.ts <records.json> [--after-version-prefix 6.4.] [--data-dir <dir>]
//
// <records.json> holds one driver record or an array of them, all of the
// same Brand. Each is validated against DriverSchema and rejected if its
// DriverUID or EntityId is already in the file. With --after-version-prefix
// the records go right after the last existing entry whose DriverVersion
// starts with that prefix (the file keeps dated releases together, ahead of
// an undated tail); without it they are appended.
//
// Written with writeDataJson() (lib/data-json.ts), so the file stays
// canonical and the diff is just the new records. Called by
// Add-WacomDriver.ps1, which gathers the data.

import * as path from "path";
import { fileURLToPath } from "url";
import * as v from "valibot";
import { DriverSchema } from "../lib/schemas.js";
import { readDataJson } from "../lib/data-json.js";

import { commitDatasetUpdate } from "../lib/update-dataset.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface DriverRecord {
  DriverVersion: string;
  DriverUID: string;
  EntityId: string;
  [key: string]: unknown;
}

/**
 * Return `drivers` with `records` inserted (see the header for placement).
 * Throws on a duplicate DriverUID/EntityId or a prefix no entry matches.
 */
export function insertDriverRecords<T extends DriverRecord>(
  drivers: T[],
  records: T[],
  afterVersionPrefix?: string,
): T[] {
  const uids = new Set(drivers.map((d) => d.DriverUID));
  const eids = new Set(drivers.map((d) => d.EntityId));
  const dups: string[] = [];
  for (const r of records) {
    if (uids.has(r.DriverUID) || eids.has(r.EntityId)) dups.push(r.DriverUID);
    uids.add(r.DriverUID);
    eids.add(r.EntityId);
  }
  if (dups.length) throw new Error(`Duplicate entries already exist: ${dups.join(", ")}`);

  if (afterVersionPrefix === undefined) return [...drivers, ...records];
  let anchor = -1;
  drivers.forEach((d, i) => {
    if (d.DriverVersion.startsWith(afterVersionPrefix)) anchor = i;
  });
  if (anchor < 0) throw new Error(`No existing ${afterVersionPrefix}x entry found to anchor the insertion.`);
  return [...drivers.slice(0, anchor + 1), ...records, ...drivers.slice(anchor + 1)];
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const opt = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const recordsPath = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  if (!recordsPath) {
    console.error(
      "Usage: npx tsx scripts/add-driver-record.ts <records.json> [--after-version-prefix 6.4.] [--data-dir <dir>]",
    );
    return 1;
  }
  const dataDirOpt = opt("data-dir");
  const dataDir = dataDirOpt ? path.resolve(dataDirOpt) : path.join(__dirname, "..", "data");

  const input = readDataJson<unknown>(recordsPath);
  const records = (Array.isArray(input) ? input : [input]) as DriverRecord[];
  if (records.length === 0) {
    console.error("No records given.");
    return 1;
  }
  for (const r of records) {
    const result = v.safeParse(DriverSchema, r);
    if (!result.success) {
      console.error(`Validation failed for ${r?.DriverUID ?? "(record)"}:`);
      for (const iss of result.issues) {
        const where = (iss.path ?? []).map((p: any) => p.key).join(".") || "(root)";
        console.error(`  ${where}: ${iss.message}`);
      }
      return 1;
    }
  }
  const brands = new Set(records.map((r) => r.Brand as string));
  if (brands.size !== 1) {
    console.error(`All records must share one Brand (got ${[...brands].join(", ")}).`);
    return 1;
  }

  const filePath = path.join(dataDir, "drivers", `${[...brands][0]}-drivers.json`);
  const data = readDataJson<{ Drivers: DriverRecord[] }>(filePath);
  try {
    data.Drivers = insertDriverRecords(data.Drivers ?? [], records, opt("after-version-prefix"));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
  commitDatasetUpdate(path.dirname(dataDir), [], {
    dataFiles: new Map([[`data/drivers/${[...brands][0]}-drivers.json`, data]]),
  });
  for (const r of records) console.log(`  Added ${r.DriverUID} to ${path.basename(filePath)}`);
  return 0;
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  process.exitCode = main();
}
