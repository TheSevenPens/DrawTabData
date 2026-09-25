// Edit one tablet, pen or pressure session by EntityId (RFC #45, the
// "edit this EntityId" command it left for later). scripts/edit.ts is the
// CLI; this is the logic, kept separate so it can be tested.
//
// An edit is a list of assignments against the record's source file:
//
//   Field=value        set a string            ReleaseYear=2016
//   Field:=json        set a JSON value        Digitizer.Dimensions.Width:=254
//                                              Model.IncludedPen:=["xppen.pen.p01"]
//   (unset) Field      remove the key
//
// Fields are dotted paths into the record. A bare name resolves against the
// record type's schema when unambiguous — a top-level field, or a field of
// exactly one top-level object (on a tablet, `ReleaseYear` is
// `Model.ReleaseYear`) — so a field the record doesn't have yet still works.
//
// Nothing is written unless the edited record passes its schema. Identity
// fields are refused: changing an EntityId, Brand or model id moves the
// file and orphans every reference, which is a migration, not an edit.

import * as v from "valibot";
import { PenSchema, PressureResponseSchema, TabletSchema } from "./schemas.js";
import * as path from "node:path";
import { runDataQuality, type Issue } from "./data-quality.js";
import { readSourceRecord, regenerate, sourceCollection, writeSourceRecord, type SourceCollection } from "./sources.js";

type Json = unknown;
type Rec = Record<string, Json>;

export type Assignment =
  | { path: string; kind: "set"; value: Json }
  | { path: string; kind: "unset" };

const COLLECTION_BY_TYPE: Record<string, string> = {
  tablet: "tablets",
  pen: "pens",
  session: "pressure-response",
};

const SCHEMAS: Record<string, v.GenericSchema> = {
  tablets: TabletSchema,
  pens: PenSchema,
  "pressure-response": PressureResponseSchema,
};

/** Paths whose change is a reference migration, not an edit. */
const IDENTITY_PATHS: Record<string, readonly string[]> = {
  tablets: ["Meta.EntityId", "Meta._id", "Model.Brand", "Model.Id", "Model.IdSuffix"],
  pens: ["EntityId", "_id", "Brand", "PenId"],
  "pressure-response": ["EntityId", "_id", "Brand", "InventoryId", "Date", "IdSuffix"],
};

const MODIFIED_PATH: Record<string, string> = {
  tablets: "Meta._ModifiedDate",
  pens: "_ModifiedDate",
  "pressure-response": "_ModifiedDate",
};

/** The source collection an EntityId belongs to, from its type segment. */
export function collectionForEntityId(entityId: string): SourceCollection {
  const type = entityId.split(".")[1];
  const name = COLLECTION_BY_TYPE[type ?? ""];
  if (!name) {
    throw new Error(
      `${entityId}: only tablets, pens and pressure sessions have editable source files (got type "${type ?? ""}")`,
    );
  }
  return sourceCollection(name);
}

/**
 * Parse CLI assignments. `Field=value` sets a string; `Field:=json` sets
 * parsed JSON. The first `:=` or `=` splits, so values may contain `=`.
 */
export function parseAssignments(args: readonly string[], unset: readonly string[] = []): Assignment[] {
  const out: Assignment[] = [];
  for (const arg of args) {
    const json = arg.indexOf(":=");
    const eq = arg.indexOf("=");
    if (json > 0 && json === eq - 1) {
      const raw = arg.slice(json + 2);
      let value: Json;
      try {
        value = JSON.parse(raw);
      } catch {
        throw new Error(`${arg}: the value after := must be JSON (strings in double quotes)`);
      }
      out.push({ path: arg.slice(0, json), kind: "set", value });
    } else if (eq > 0) {
      out.push({ path: arg.slice(0, eq), kind: "set", value: arg.slice(eq + 1) });
    } else {
      throw new Error(`${arg}: expected Field=value or Field:=json`);
    }
  }
  for (const path of unset) out.push({ path, kind: "unset" });
  return out;
}

const isObject = (x: Json): x is Rec => typeof x === "object" && x !== null && !Array.isArray(x);

type AnySchema = { type: string; entries?: Record<string, AnySchema>; wrapped?: AnySchema };

/** The field schemas of an object schema, looking through optional(). */
function objectEntries(schema: AnySchema | undefined): Record<string, AnySchema> | undefined {
  let s = schema;
  while (s && (s.type === "optional" || s.type === "nullable" || s.type === "nullish")) s = s.wrapped;
  return s && s.entries && /object$/.test(s.type) ? s.entries : undefined;
}

/**
 * Resolve a bare field name to its dotted path using the record type's
 * *schema*, so a field the record doesn't have yet (Tilt on a pen nobody
 * has filled in) still resolves: a top-level key, or a key of exactly one
 * top-level object. Dotted paths pass through.
 */
export function resolvePath(schema: v.GenericSchema, field: string): string {
  if (field.includes(".")) return field;
  const top = objectEntries(schema as unknown as AnySchema) ?? {};
  if (field in top) return field;
  const owners = Object.keys(top).filter((k) => field in (objectEntries(top[k]) ?? {}));
  if (owners.length === 1) return `${owners[0]}.${field}`;
  if (owners.length > 1) {
    throw new Error(`"${field}" is ambiguous — use one of: ${owners.map((o) => `${o}.${field}`).join(", ")}`);
  }
  throw new Error(`"${field}" isn't a field of this record type (check the schema in lib/schemas.ts)`);
}

function getAt(record: Rec, path: string): Json {
  let cur: Json = record;
  for (const part of path.split(".")) {
    if (!isObject(cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function setAt(record: Rec, path: string, value: Json): void {
  const parts = path.split(".");
  let cur: Rec = record;
  for (const part of parts.slice(0, -1)) {
    if (cur[part] === undefined) cur[part] = {};
    if (!isObject(cur[part])) throw new Error(`${path}: ${part} is not an object`);
    cur = cur[part] as Rec;
  }
  cur[parts[parts.length - 1]] = value;
}

function unsetAt(record: Rec, path: string): void {
  const parts = path.split(".");
  const parent = getAt(record, parts.slice(0, -1).join("."));
  const target = parts.length === 1 ? record : parent;
  if (isObject(target)) delete target[parts[parts.length - 1]];
}

export interface FieldChange {
  path: string;
  before: Json;
  after: Json;
}

export interface EditResult {
  collection: SourceCollection;
  record: Rec;
  changes: FieldChange[];
}

/**
 * Apply assignments to a copy of the record and validate it. Throws —
 * nothing written — on an identity field, a schema failure, or an edit
 * that changes nothing.
 */
export function applyEdit(
  repoRoot: string,
  entityId: string,
  assignments: readonly Assignment[],
  now: string = new Date().toISOString(),
): EditResult {
  const collection = collectionForEntityId(entityId);
  const original = readSourceRecord(repoRoot, collection, entityId);
  if (!original) throw new Error(`${entityId}: no source file`);
  const record = structuredClone(original) as Rec;

  const changes: FieldChange[] = [];
  for (const a of assignments) {
    const path = resolvePath(SCHEMAS[collection.name], a.path);
    if (IDENTITY_PATHS[collection.name].includes(path) || path === MODIFIED_PATH[collection.name]) {
      throw new Error(
        `${path} is an identity/tracking field — changing it moves the file or orphans references; that's a migration, not an edit`,
      );
    }
    const before = structuredClone(getAt(record, path));
    if (a.kind === "unset") unsetAt(record, path);
    else setAt(record, path, coerce(before, a.value));
    const after = getAt(record, path);
    if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ path, before, after });
  }
  if (changes.length === 0) throw new Error(`${entityId}: nothing to change — the record already has those values`);

  const parsed = v.safeParse(SCHEMAS[collection.name], record);
  if (!parsed.success) {
    const lines = parsed.issues.map((i) => `  ${v.getDotPath(i) ?? "(record)"}: ${i.message}`);
    throw new Error(`the edited record fails its schema; nothing was written:\n${lines.join("\n")}`);
  }

  setAt(record, MODIFIED_PATH[collection.name], now);
  return { collection, record, changes };
}

/**
 * `Field=value` is a string. Where the field already holds a number, a
 * numeric string is stored as a number — `Width=254` keeps the field's type
 * rather than turning 254 into "254". Anything else is left as given.
 */
function coerce(before: Json, value: Json): Json {
  if (typeof before === "number" && typeof value === "string" && value.trim() !== "" && !isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

export interface EditOutcome extends EditResult {
  /** Data-quality issues the edit introduced — on this record or on one that references it. */
  newIssues: Issue[];
  /** Whether the source file (and bundles) now hold the edit. */
  written: boolean;
}

/**
 * Validate, write the source, regenerate — then run data-quality and, if the
 * edit introduced any issue — on this record, or on another record it
 * breaks (a pen re-dated after a tablet that ships it flags the *tablet*) —
 * put the file back and regenerate
 * again. `force` keeps a write despite new issues; `dryRun` writes nothing.
 */
export function editRecord(
  repoRoot: string,
  entityId: string,
  assignments: readonly Assignment[],
  opts: { dryRun?: boolean; force?: boolean; now?: string } = {},
): EditOutcome {
  const result = applyEdit(repoRoot, entityId, assignments, opts.now);
  if (opts.dryRun) return { ...result, newIssues: [], written: false };

  const dataDir = path.join(repoRoot, "data");
  const key = (i: Issue) => `${i.file}|${i.entityId}|${i.field}|${i.issue}|${i.value ?? ""}`;
  const before = new Set(runDataQuality(dataDir).map(key));
  const original = readSourceRecord(repoRoot, result.collection, entityId)!;

  writeSourceRecord(repoRoot, result.collection, result.record);
  regenerate(repoRoot);
  const newIssues = runDataQuality(dataDir).filter((i) => !before.has(key(i)));
  if (newIssues.length > 0 && !opts.force) {
    writeSourceRecord(repoRoot, result.collection, original);
    regenerate(repoRoot);
    return { ...result, newIssues, written: false };
  }
  return { ...result, newIssues, written: true };
}
