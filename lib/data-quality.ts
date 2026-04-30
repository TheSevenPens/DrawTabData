import * as fs from "fs";
import * as path from "path";
import * as v from "valibot";
import {
  TabletSchema,
  PenSchema,
  PenFamilySchema,
  TabletFamilySchema,
  DriverSchema,
  BrandSchema,
  PenCompatGroupedSchema,
  PressureResponseSchema,
} from "./schemas.js";
import { BRANDS } from "./loader-shared.js";

// --- Types ---

export interface Issue {
  file: string;
  entityId: string;
  field: string;
  issue: string;
  value?: string;
}

interface RawRecord {
  [key: string]: unknown;
}

// --- Helpers ---

function getString(r: RawRecord, field: string): string | undefined {
  const v = r[field];
  return typeof v === "string" ? v : undefined;
}

function getNestedString(r: RawRecord, ...path: string[]): string | undefined {
  let cur: unknown = r;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as RawRecord)[key];
  }
  return typeof cur === "string" ? cur : undefined;
}

function getEntityId(r: RawRecord): string {
  // Try nested tablet structure first, then flat (pens, drivers, etc.)
  return getNestedString(r, "Meta", "EntityId")
    ?? getString(r, "EntityId")
    ?? getString(r, "ModelId")
    ?? getString(r, "PenId")
    ?? "UNKNOWN";
}

// --- Schema-based shape validation ---

function checkSchema(
  schema: v.GenericSchema | v.GenericSchemaAsync,
  record: RawRecord,
  file: string,
): Issue[] {
  const result = v.safeParse(schema as v.GenericSchema, record);
  if (result.success) return [];
  const eid = getEntityId(record);
  return result.issues.map((iss) => {
    const pathParts = (iss.path ?? []).map((p: { key?: unknown }) => String(p.key ?? ""));
    const field = pathParts.join(".") || "(root)";
    const value = iss.received !== undefined && iss.received !== "undefined"
      ? String(iss.received)
      : undefined;
    return {
      file,
      entityId: eid,
      field,
      issue: iss.message,
      value,
    };
  });
}

// --- Business-rule checks (not expressible in the schema) ---

function checkTabletEntityId(t: RawRecord, file: string): Issue[] {
  const issues: Issue[] = [];
  const eid = getEntityId(t);
  const brand = getNestedString(t, "Model", "Brand");
  const id = getNestedString(t, "Model", "Id");
  const entityId = getNestedString(t, "Meta", "EntityId");
  if (brand && id) {
    const expected =
      brand.toLowerCase() + ".tablet." + id.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    if (entityId !== expected) {
      issues.push({
        file,
        entityId: eid,
        field: "Meta.EntityId",
        issue: "does not match derived value",
        value: `got "${entityId}", expected "${expected}"`,
      });
    }
  }
  return issues;
}

function checkPenEntityId(p: RawRecord, file: string): Issue[] {
  return checkDerivedEntityId(p, file, "PEN", "PenId");
}

function checkDerivedEntityId(
  r: RawRecord,
  file: string,
  entityType: string,
  idField: string,
): Issue[] {
  const issues: Issue[] = [];
  const eid = getEntityId(r);
  const brand = getString(r, "Brand");
  const id = getString(r, idField);
  const entityId = getString(r, "EntityId");
  if (brand && id) {
    const expected =
      brand.toLowerCase() +
      "." +
      entityType.toLowerCase() +
      "." +
      id.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    if (entityId !== expected) {
      issues.push({
        file,
        entityId: eid,
        field: "EntityId",
        issue: "does not match derived value",
        value: `got "${entityId}", expected "${expected}"`,
      });
    }
  }
  return issues;
}

function checkDuplicateEntityIds(
  records: { file: string; record: RawRecord }[],
): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, string>();
  for (const { file, record } of records) {
    const eid = getNestedString(record, "Meta", "EntityId") ?? getString(record, "EntityId");
    if (!eid) continue;
    const prev = seen.get(eid);
    if (prev) {
      issues.push({
        file,
        entityId: eid,
        field: "EntityId",
        issue: `duplicate EntityId (also in ${prev})`,
      });
    } else {
      seen.set(eid, file);
    }
  }
  return issues;
}

// --- Generic per-entity runner ---

interface EntityCheckSpec {
  dirName: string;
  fileSuffix: string;
  rootKey: string;
  schema: v.GenericSchema;
  /** Per-record business rule checks (e.g. derived EntityId). */
  perRecordChecks?: ((record: RawRecord, file: string) => Issue[])[];
  /** Whether to check for duplicate EntityIds across files. */
  dedupe?: boolean;
}

function runEntityChecks(dataDir: string, spec: EntityCheckSpec): Issue[] {
  const dir = path.join(dataDir, spec.dirName);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(spec.fileSuffix));

  const issues: Issue[] = [];
  const allRecords: { file: string; record: RawRecord }[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    const items = data[spec.rootKey];
    if (!Array.isArray(items)) continue;

    for (const record of items as RawRecord[]) {
      allRecords.push({ file, record });
      issues.push(...checkSchema(spec.schema, record, file));
      for (const check of spec.perRecordChecks ?? []) {
        issues.push(...check(record, file));
      }
    }
  }

  if (spec.dedupe) {
    issues.push(...checkDuplicateEntityIds(allRecords));
  }

  return issues;
}

// --- Brands (single-file, no brand partitioning) ---

function runBrandsChecks(dataDir: string): Issue[] {
  const filePath = path.join(dataDir, "brands", "brands.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as { Brands?: RawRecord[] };
  const issues: Issue[] = [];
  const records: { file: string; record: RawRecord }[] = [];
  for (const record of data.Brands ?? []) {
    records.push({ file: "brands.json", record });
    issues.push(...checkSchema(BrandSchema, record, "brands.json"));
  }
  issues.push(...checkDuplicateEntityIds(records));
  return issues;
}

// --- Brand drift: brands.json must agree with the BRANDS / BrandEnum list ---
//
// brands.json is the source of truth for the human-facing brand catalog,
// but BRANDS in loader-shared.ts (and the BrandEnum picklist in schemas.ts)
// is what code actually validates against. Drift between the two means a
// brand exists in one place but not the other — silently breaking either
// data loading or schema validation.

function runBrandDriftCheck(dataDir: string): Issue[] {
  const filePath = path.join(dataDir, "brands", "brands.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as { Brands?: { BrandId?: string }[] };
  const idsInData = new Set(
    (data.Brands ?? []).map((b) => b.BrandId).filter((s): s is string => !!s),
  );
  const idsInEnum = new Set<string>(BRANDS);
  const issues: Issue[] = [];
  for (const id of idsInData) {
    if (!idsInEnum.has(id)) {
      issues.push({
        file: "brands.json",
        entityId: id,
        field: "BrandId",
        issue: "in brands.json but missing from BRANDS / BrandEnum",
        value: "add to loader-shared.ts BRANDS and schemas.ts BrandEnum",
      });
    }
  }
  for (const id of idsInEnum) {
    if (!idsInData.has(id)) {
      issues.push({
        file: "brands.json",
        entityId: id,
        field: "BrandId",
        issue: "in BRANDS / BrandEnum but missing from brands.json",
        value: "add a Brands entry or remove from loader-shared.ts",
      });
    }
  }
  return issues;
}

// --- Cross-entity orphan reference checks ---
//
// These need data from multiple files at once (a Tablet's Model.Family
// pointing to a TabletFamily that exists, etc.). The browser data-quality
// page also runs these checks; mirroring them in the CLI means a typo
// fails validation instead of silently producing an iPad that doesn't
// link to its family page.

function readAllInDir(
  dataDir: string,
  dirName: string,
  rootKey: string,
): { file: string; record: RawRecord }[] {
  const dir = path.join(dataDir, dirName);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const all: { file: string; record: RawRecord }[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    const items = data[rootKey];
    if (Array.isArray(items)) {
      for (const record of items as RawRecord[]) {
        all.push({ file, record });
      }
    }
  }
  return all;
}

function runCrossEntityChecks(dataDir: string): Issue[] {
  const tablets = readAllInDir(dataDir, "tablets", "DrawingTablets");
  const pens = readAllInDir(dataDir, "pens", "Pens");
  const tabletFamilies = readAllInDir(dataDir, "tablet-families", "TabletFamilies");
  const penFamilies = readAllInDir(dataDir, "pen-families", "PenFamilies");
  const penCompat = readAllInDir(dataDir, "pen-compat", "PenCompat");

  const tabletModelIds = new Set<string>();
  for (const { record } of tablets) {
    const id = getNestedString(record, "Model", "Id");
    if (id) tabletModelIds.add(id);
  }
  const penIds = new Set<string>();
  for (const { record } of pens) {
    const id = getString(record, "PenId");
    if (id) penIds.add(id);
  }
  const tabletFamilyIds = new Set<string>();
  for (const { record } of tabletFamilies) {
    const id = getString(record, "EntityId");
    if (id) tabletFamilyIds.add(id);
  }
  const penFamilyIds = new Set<string>();
  for (const { record } of penFamilies) {
    const id = getString(record, "EntityId");
    if (id) penFamilyIds.add(id);
  }

  const issues: Issue[] = [];

  // Tablet.Model.Family -> TabletFamily.EntityId
  for (const { file, record } of tablets) {
    const family = getNestedString(record, "Model", "Family");
    if (family && !tabletFamilyIds.has(family)) {
      issues.push({
        file,
        entityId: getEntityId(record),
        field: "Model.Family",
        issue: "references unknown TabletFamily",
        value: family,
      });
    }
  }

  // Pen.PenFamily -> PenFamily.EntityId
  for (const { file, record } of pens) {
    const family = getString(record, "PenFamily");
    if (family && !penFamilyIds.has(family)) {
      issues.push({
        file,
        entityId: getEntityId(record),
        field: "PenFamily",
        issue: "references unknown PenFamily",
        value: family,
      });
    }
  }

  // PenCompat.PenId / TabletIds -> Pen.PenId / Tablet.Model.Id
  for (const { file, record } of penCompat) {
    const penId = getString(record, "PenId");
    if (penId && !penIds.has(penId)) {
      issues.push({
        file,
        entityId: penId,
        field: "PenId",
        issue: "pen-compat references unknown pen",
        value: penId,
      });
    }
    const tabletIdsRaw = record.TabletIds;
    if (Array.isArray(tabletIdsRaw)) {
      for (const tid of tabletIdsRaw) {
        if (typeof tid === "string" && !tabletModelIds.has(tid)) {
          issues.push({
            file,
            entityId: penId ?? "UNKNOWN",
            field: "TabletIds",
            issue: "pen-compat references unknown tablet",
            value: tid,
          });
        }
      }
    }
  }

  return issues;
}

// --- Runner ---

export function runDataQuality(dataDir: string): Issue[] {
  return [
    ...runEntityChecks(dataDir, {
      dirName: "tablets",
      fileSuffix: "-tablets.json",
      rootKey: "DrawingTablets",
      schema: TabletSchema,
      perRecordChecks: [checkTabletEntityId],
      dedupe: true,
    }),
    ...runEntityChecks(dataDir, {
      dirName: "pens",
      fileSuffix: "-pens.json",
      rootKey: "Pens",
      schema: PenSchema,
      perRecordChecks: [checkPenEntityId],
      dedupe: true,
    }),
    ...runEntityChecks(dataDir, {
      dirName: "pen-families",
      fileSuffix: "-pen-families.json",
      rootKey: "PenFamilies",
      schema: PenFamilySchema,
      dedupe: true,
    }),
    ...runEntityChecks(dataDir, {
      dirName: "tablet-families",
      fileSuffix: "-tablet-families.json",
      rootKey: "TabletFamilies",
      schema: TabletFamilySchema,
      dedupe: true,
    }),
    ...runEntityChecks(dataDir, {
      dirName: "drivers",
      fileSuffix: "-drivers.json",
      rootKey: "Drivers",
      schema: DriverSchema,
      dedupe: true,
    }),
    ...runEntityChecks(dataDir, {
      dirName: "pen-compat",
      fileSuffix: "-pen-compat.json",
      rootKey: "PenCompat",
      schema: PenCompatGroupedSchema,
    }),
    ...runEntityChecks(dataDir, {
      dirName: "pressure-response",
      fileSuffix: "-pressure-response.json",
      rootKey: "PressureResponse",
      schema: PressureResponseSchema,
      dedupe: true,
    }),
    ...runBrandsChecks(dataDir),
    ...runBrandDriftCheck(dataDir),
    ...runCrossEntityChecks(dataDir),
  ];
}
