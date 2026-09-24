// Per-record source files and the bundles generated from them (RFC #45,
// phases 2–3).
//
// Tablets and pens are authored one record per file:
//
//   source/tablets/<brand>/<EntityId>.json     -> data/tablets/<BRAND>-tablets.json
//   source/pens/<brand>/<EntityId>.json        -> data/pens/<BRAND>-pens.json
//
// The files under source/ are the only editable copy. The brand bundles
// under data/ are generated from them, kept tracked at their old paths so
// every existing consumer (loaders, raw GitHub URLs, the npm package, the
// Explorer's static links and prerender) keeps working, and checked in CI:
// `generate --check` rebuilds them in memory and fails if the committed
// bytes differ, before anything could regenerate over a stale file.
//
// Deterministic by construction: records within a bundle are sorted by
// EntityId (plain code-unit comparison, no locale), each file is written by
// formatDataJson(), and nothing time-dependent is included.
//
// Only node: imports and ./data-json — keeps this loadable from Vite
// config and plain tsx scripts.

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { checkDataJsonText, formatDataJson, parseDataJson } from "./data-json.js";

export interface SourceCollection {
  /** Collection name, also the source/ and data/ subdirectory. */
  name: "tablets" | "pens";
  /** Root key of the generated bundle envelope. */
  rootKey: "DrawingTablets" | "Pens";
  entityId(record: Record<string, unknown>): unknown;
  brand(record: Record<string, unknown>): unknown;
}

export const SOURCE_COLLECTIONS: readonly SourceCollection[] = [
  {
    name: "tablets",
    rootKey: "DrawingTablets",
    entityId: (r) => (r.Meta as { EntityId?: unknown } | undefined)?.EntityId,
    brand: (r) => (r.Model as { Brand?: unknown } | undefined)?.Brand,
  },
  {
    name: "pens",
    rootKey: "Pens",
    entityId: (r) => r.EntityId,
    brand: (r) => r.Brand,
  },
];

export function sourceCollection(name: string): SourceCollection {
  const c = SOURCE_COLLECTIONS.find((c) => c.name === name);
  if (!c) throw new Error(`Unknown source collection: ${name}`);
  return c;
}

/** Relative (forward-slash) path of a record's source file. */
export function sourcePath(collection: SourceCollection, brand: string, entityId: string): string {
  return `source/${collection.name}/${brand.toLowerCase()}/${entityId}.json`;
}

/** Relative path of a brand's generated bundle. */
export function bundlePath(collection: SourceCollection, brand: string): string {
  return `data/${collection.name}/${brand}-${collection.name}.json`;
}

export interface SourceRecord {
  /** Relative path of the source file. */
  file: string;
  entityId: string;
  brand: string;
  record: Record<string, unknown>;
}

export interface SourceIssue {
  /** The source file (or directory) to fix. */
  file: string;
  problem: string;
}

const SAFE_NAME = /^[a-z0-9][a-z0-9._-]*$/;

/**
 * Read every source file of a collection. Problems are collected, not
 * thrown, so one run reports all of them with the editable file named.
 */
export function readSources(
  repoRoot: string,
  collection: SourceCollection,
): { records: SourceRecord[]; issues: SourceIssue[] } {
  const records: SourceRecord[] = [];
  const issues: SourceIssue[] = [];
  const root = path.join(repoRoot, "source", collection.name);
  if (!fs.existsSync(root)) return { records, issues };

  for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
    const dirRel = `source/${collection.name}/${dirent.name}`;
    if (!dirent.isDirectory()) {
      issues.push({ file: dirRel, problem: "unexpected file; sources live in <brand>/ subdirectories" });
      continue;
    }
    if (!SAFE_NAME.test(dirent.name)) {
      issues.push({ file: dirRel, problem: "brand directory must be lowercase [a-z0-9._-]" });
    }
    for (const f of fs.readdirSync(path.join(root, dirent.name)).sort()) {
      const file = `${dirRel}/${f}`;
      if (!f.endsWith(".json")) {
        issues.push({ file, problem: "not a .json file" });
        continue;
      }
      const text = fs.readFileSync(path.join(root, dirent.name, f), "utf8");
      const formatIssues = checkDataJsonText(text, file);
      const fatal = formatIssues.find((i) => i.problem === "invalid-json" || i.problem === "duplicate-keys");
      if (fatal) {
        issues.push({ file, problem: `${fatal.problem}: ${fatal.detail ?? ""}` });
        continue;
      }
      for (const i of formatIssues) issues.push({ file, problem: `${i.problem}${i.detail ? `: ${i.detail}` : ""}` });

      const record = parseDataJson(text, file);
      if (record === null || typeof record !== "object" || Array.isArray(record)) {
        issues.push({ file, problem: "must contain a single record object" });
        continue;
      }
      const rec = record as Record<string, unknown>;
      const entityId = collection.entityId(rec);
      const brand = collection.brand(rec);
      if (typeof entityId !== "string" || !entityId) {
        issues.push({ file, problem: "record has no EntityId" });
        continue;
      }
      if (typeof brand !== "string" || !brand) {
        issues.push({ file, problem: "record has no Brand" });
        continue;
      }
      const base = f.slice(0, -".json".length);
      if (!SAFE_NAME.test(base)) issues.push({ file, problem: "file name must be lowercase [a-z0-9._-]" });
      if (base !== entityId) issues.push({ file, problem: `file name must equal the EntityId "${entityId}"` });
      if (dirent.name !== brand.toLowerCase()) {
        issues.push({ file, problem: `record Brand "${brand}" belongs in ${collection.name}/${brand.toLowerCase()}/` });
      }
      records.push({ file, entityId, brand, record: rec });
    }
  }

  // EntityIds must be unique — case-insensitively, so they can't collide
  // as file names on Windows/macOS either.
  const seen = new Map<string, string>();
  for (const r of records) {
    const key = r.entityId.toLowerCase();
    const prior = seen.get(key);
    if (prior) issues.push({ file: r.file, problem: `duplicate EntityId (also in ${prior})` });
    else seen.set(key, r.file);
  }
  return { records, issues };
}

/** EntityId order, by plain UTF-16 code units — never locale-dependent. */
export function compareEntityIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Expected bundle files (relative path -> canonical text) for a collection. */
export function buildBundles(collection: SourceCollection, records: readonly SourceRecord[]): Map<string, string> {
  const byBrand = new Map<string, SourceRecord[]>();
  for (const r of records) {
    const list = byBrand.get(r.brand) ?? [];
    list.push(r);
    byBrand.set(r.brand, list);
  }
  const out = new Map<string, string>();
  for (const brand of [...byBrand.keys()].sort()) {
    const sorted = byBrand.get(brand)!.sort((a, b) => compareEntityIds(a.entityId, b.entityId));
    out.set(bundlePath(collection, brand), formatDataJson({ [collection.rootKey]: sorted.map((r) => r.record) }));
  }
  return out;
}

/** Bundle files currently on disk for a collection (generator-owned paths only). */
export function existingBundles(repoRoot: string, collection: SourceCollection): string[] {
  const dir = path.join(repoRoot, "data", collection.name);
  if (!fs.existsSync(dir)) return [];
  const suffix = `-${collection.name}.json`;
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .map((f) => `data/${collection.name}/${f}`)
    .sort();
}

export interface GenerateResult {
  /** Collections that have sources (the others are left untouched). */
  collections: string[];
  sourceIssues: SourceIssue[];
  changed: string[];
  missing: string[];
  extra: string[];
}

/**
 * Compare (check) or rewrite (write) the generated bundles of every
 * collection that has a source/ directory. In check mode nothing is
 * written. In write mode nothing is written either when the sources have
 * problems — a bad source must fail the build, not publish partial output.
 */
export function generateBundles(repoRoot: string, { write }: { write: boolean }): GenerateResult {
  const result: GenerateResult = { collections: [], sourceIssues: [], changed: [], missing: [], extra: [] };
  const plans: { expected: Map<string, string>; existing: string[] }[] = [];

  for (const collection of SOURCE_COLLECTIONS) {
    if (!fs.existsSync(path.join(repoRoot, "source", collection.name))) continue;
    result.collections.push(collection.name);
    const { records, issues } = readSources(repoRoot, collection);
    result.sourceIssues.push(...issues);
    const expected = buildBundles(collection, records);
    const existing = existingBundles(repoRoot, collection);
    for (const [rel, text] of expected) {
      const abs = path.join(repoRoot, rel);
      if (!fs.existsSync(abs)) result.missing.push(rel);
      else if (fs.readFileSync(abs, "utf8") !== text) result.changed.push(rel);
    }
    for (const rel of existing) if (!expected.has(rel)) result.extra.push(rel);
    plans.push({ expected, existing });
  }

  if (write && result.sourceIssues.length === 0) {
    for (const { expected, existing } of plans) {
      for (const [rel, text] of expected) {
        const abs = path.join(repoRoot, rel);
        if (fs.existsSync(abs) && fs.readFileSync(abs, "utf8") === text) continue;
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        const tmp = `${abs}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, text, "utf8");
        fs.renameSync(tmp, abs);
      }
      // A deleted or renamed source must not leave its old bundle behind.
      for (const rel of existing) if (!expected.has(rel)) fs.rmSync(path.join(repoRoot, rel));
    }
  }
  return result;
}

/** Every source file, sorted, as forward-slash paths relative to the repo. */
export function listSourceFiles(repoRoot: string): string[] {
  const out: string[] = [];
  const walk = (abs: string, rel: string) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(path.join(abs, e.name), r);
      else if (e.name.endsWith(".json")) out.push(r);
    }
  };
  const root = path.join(repoRoot, "source");
  if (fs.existsSync(root)) walk(root, "source");
  return out.sort();
}

/**
 * The source-content digest published with the bundles (RFC #45,
 * "External consumer verification"). Cross-platform by definition:
 *
 *   for each source file, sorted by its forward-slash relative path:
 *     line = <path> "\0" <sha256 hex of its UTF-8 bytes with CRLF -> LF> "\n"
 *   digest = sha256 hex of the concatenated lines
 *
 * It changes when any source file's content, name or set changes (a
 * formatting-only source edit included) and nothing else — a docs-only
 * commit leaves it alone.
 */
export function sourceDigest(repoRoot: string): string | null {
  const files = listSourceFiles(repoRoot);
  if (files.length === 0) return null;
  const h = crypto.createHash("sha256");
  for (const rel of files) {
    const text = fs.readFileSync(path.join(repoRoot, rel), "utf8").replace(/\r\n/g, "\n");
    h.update(`${rel}\0${crypto.createHash("sha256").update(text, "utf8").digest("hex")}\n`, "utf8");
  }
  return h.digest("hex");
}

/** sha256 of a file's bytes, for the published per-bundle hashes. */
export function fileSha256(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

// --- Editing sources (for tools) -------------------------------------------
//
// Every tool that changes a tablet or pen edits its SOURCE file and then
// regenerates the bundles — never the bundle. (A hand-edited bundle fails
// `generate --check` in CI.)

/** Source path for an EntityId: its first segment is the brand directory. */
export function sourcePathForEntityId(collection: SourceCollection, entityId: string): string {
  const brandDir = entityId.split(".")[0];
  return `source/${collection.name}/${brandDir}/${entityId}.json`;
}

/** Read one record's source, or undefined when there is none. */
export function readSourceRecord(
  repoRoot: string,
  collection: SourceCollection,
  entityId: string,
): Record<string, unknown> | undefined {
  const abs = path.join(repoRoot, sourcePathForEntityId(collection, entityId));
  if (!fs.existsSync(abs)) return undefined;
  return parseDataJson(fs.readFileSync(abs, "utf8"), abs) as Record<string, unknown>;
}

/**
 * Write one record to its source file (canonical format). The path comes
 * from the record's own EntityId and Brand, so a record can't land in the
 * wrong place. Returns the relative path written.
 */
export function writeSourceRecord(
  repoRoot: string,
  collection: SourceCollection,
  record: Record<string, unknown>,
): string {
  const entityId = collection.entityId(record);
  const brand = collection.brand(record);
  if (typeof entityId !== "string" || !entityId) throw new Error("record has no EntityId");
  if (typeof brand !== "string" || !brand) throw new Error(`${entityId}: record has no Brand`);
  const rel = sourcePath(collection, brand, entityId);
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const text = formatDataJson(record);
  if (!fs.existsSync(abs) || fs.readFileSync(abs, "utf8") !== text) {
    const tmp = `${abs}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, text, "utf8");
    fs.renameSync(tmp, abs);
  }
  return rel;
}

/**
 * Regenerate the bundles after an edit. Throws — listing each source file
 * and problem — instead of writing partial output when a source is bad.
 * Returns the bundle files that changed.
 */
export function regenerate(repoRoot: string): string[] {
  const r = generateBundles(repoRoot, { write: true });
  if (r.sourceIssues.length) {
    throw new Error(
      `source problems; bundles not regenerated:\n${r.sourceIssues.map((i) => `  ${i.file}: ${i.problem}`).join("\n")}`,
    );
  }
  return [...r.changed, ...r.missing, ...r.extra];
}
