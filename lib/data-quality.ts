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

function getEntityId(r: RawRecord): string {
  return getString(r, "EntityId") ?? getString(r, "ModelId") ?? getString(r, "PenId") ?? "UNKNOWN";
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
  return checkDerivedEntityId(t, file, "TABLET", "ModelId");
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
      brand.toUpperCase() +
      "." +
      entityType +
      "." +
      id.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
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
    const eid = getString(record, "EntityId");
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
  ];
}
