import * as fs from "fs";
import * as path from "path";
import * as v from "valibot";
import { TabletSchema } from "./schemas.js";

// --- Types ---

export interface Issue {
  file: string;
  entityId: string;
  field: string;
  issue: string;
  value?: string;
}

interface RawTablet {
  [key: string]: unknown;
}

interface TabletFile {
  DrawingTablets: RawTablet[];
}

// --- Helpers ---

function getString(t: RawTablet, field: string): string | undefined {
  const v = t[field];
  return typeof v === "string" ? v : undefined;
}

function getEntityId(t: RawTablet): string {
  return getString(t, "EntityId") ?? getString(t, "ModelId") ?? "UNKNOWN";
}

// --- Schema-based shape validation ---

function checkSchema(t: RawTablet, file: string): Issue[] {
  const result = v.safeParse(TabletSchema, t);
  if (result.success) return [];
  const eid = getEntityId(t);
  return result.issues.map((iss) => {
    // Build a dotted path of the field that failed.
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

function checkEntityId(t: RawTablet, file: string): Issue[] {
  const issues: Issue[] = [];
  const eid = getEntityId(t);
  const brand = getString(t, "Brand");
  const modelId = getString(t, "ModelId");
  const entityId = getString(t, "EntityId");
  if (brand && modelId) {
    const expected =
      brand.toUpperCase() +
      ".TABLET." +
      modelId.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
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

function checkDuplicateEntityIds(allTablets: { file: string; tablet: RawTablet }[]): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, string>();
  for (const { file, tablet } of allTablets) {
    const eid = getString(tablet, "EntityId");
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

// --- Runner ---

export function runDataQuality(dataDir: string): Issue[] {
  const tabletsDir = path.join(dataDir, "tablets");
  const files = fs.readdirSync(tabletsDir).filter((f) => f.endsWith("-tablets.json"));

  const allIssues: Issue[] = [];
  const allTablets: { file: string; tablet: RawTablet }[] = [];

  for (const file of files) {
    const filePath = path.join(tabletsDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data: TabletFile = JSON.parse(raw);

    for (const tablet of data.DrawingTablets) {
      allTablets.push({ file, tablet });
      allIssues.push(
        ...checkSchema(tablet, file),
        ...checkEntityId(tablet, file),
      );
    }
  }

  allIssues.push(...checkDuplicateEntityIds(allTablets));

  return allIssues;
}
