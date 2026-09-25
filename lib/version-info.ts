// Deterministic tracked content metadata and separate publication provenance.
// Node-only. See docs/CONSUMERS.md for the verification contract.

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import type { VersionInfo } from "./schemas.js";
import { SOURCE_COLLECTIONS, existingBundles, fileSha256, sourceDigest } from "./sources.js";

/**
 * The data's schema version. Hand-maintained, **not** derived: bump it only
 * when a change to the JSON shape would break an existing consumer. The
 * Explorer compares it with its SUPPORTED_SCHEMA_MAJOR.
 */
export const DATA_SCHEMA_VERSION = 1;
/** Bump when source-to-bundle transformation semantics change. */
export const GENERATOR_VERSION = 1;
export const VERIFICATION_VERSION = 1;

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd }).toString().trim();
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, "utf-8").replace(/^﻿/, ""));
}

function countRecords(dataDir: string, dir: string, suffix: string, rootKey: string): number {
  const dirPath = path.join(dataDir, dir);
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  for (const f of fs.readdirSync(dirPath).filter((f) => f.endsWith(suffix))) {
    const items = readJson(path.join(dirPath, f))[rootKey];
    if (Array.isArray(items)) total += items.length;
  }
  return total;
}

function countSingleFile(dataDir: string, file: string, rootKey: string): number {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) return 0;
  const items = readJson(filePath)[rootKey];
  return Array.isArray(items) ? items.length : 0;
}

/** Every .json under data/ except version.json itself, as sorted
 * forward-slash paths relative to data/. */
export function listDataFiles(dataDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), r);
      else if (entry.name.endsWith(".json") && r !== "version.json") out.push(r);
    }
  };
  if (fs.existsSync(dataDir)) walk(dataDir, "");
  return out.sort();
}

/** PenEntityId -> number of pressure-response sessions, across all brands. */
export function pressureSessionsByPen(dataDir: string): Record<string, number> {
  const out: Record<string, number> = {};
  const dir = path.join(dataDir, "pressure-response");
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith("-pressure-response.json"))) {
    const sessions = readJson(path.join(dir, f)).PressureResponse;
    if (!Array.isArray(sessions)) continue;
    for (const s of sessions as { PenEntityId?: string }[]) {
      if (s.PenEntityId) out[s.PenEntityId] = (out[s.PenEntityId] ?? 0) + 1;
    }
  }
  return out;
}

/**
 * sourceDigest + per-bundle hashes for the collections generated from
 * source/ (RFC #45). Omitted entirely while there are no sources.
 */
export function verificationMetadata(repoRoot: string): Pick<VersionInfo, "sourceDigest" | "bundles" | "verification" | "generatorVersion"> {
  const digest = sourceDigest(repoRoot);
  if (!digest) return {};
  const bundles = SOURCE_COLLECTIONS.flatMap((c) =>
    existingBundles(repoRoot, c).map((rel) => {
      const abs = path.join(repoRoot, rel);
      const records = readJson(abs)[c.rootKey];
      return {
        path: rel.slice("data/".length),
        sha256: fileSha256(abs),
        count: Array.isArray(records) ? records.length : 0,
      };
    }),
  );
  return {
    sourceDigest: digest, bundles, generatorVersion: GENERATOR_VERSION,
    verification: {
      version: VERIFICATION_VERSION,
      covers: SOURCE_COLLECTIONS.map(c => `source/${c.name}`),
      bundleRootKeys: Object.fromEntries(SOURCE_COLLECTIONS.map(c => [c.name, c.rootKey])),
    },
  };
}

/** Deterministic tracked metadata, with no self-referential commit or dates. */
export function buildContentInfo(repoRoot: string): VersionInfo {
  const dataDir = path.join(repoRoot, "data");
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    counts: {
      tablets: countRecords(dataDir, "tablets", "-tablets.json", "DrawingTablets"),
      pens: countRecords(dataDir, "pens", "-pens.json", "Pens"),
      penFamilies: countRecords(dataDir, "pen-families", "-pen-families.json", "PenFamilies"),
      tabletFamilies: countRecords(dataDir, "tablet-families", "-tablet-families.json", "TabletFamilies"),
      drivers: countRecords(dataDir, "drivers", "-drivers.json", "Drivers"),
      brands: countSingleFile(dataDir, "brands/brands.json", "Brands"),
      pressureResponse: countRecords(dataDir, "pressure-response", "-pressure-response.json", "PressureResponse"),
    },
    files: listDataFiles(dataDir),
    indexes: { pressureSessionsByPen: pressureSessionsByPen(dataDir) },
    ...verificationMetadata(repoRoot),
  };
}

/** Capture relevant dirty paths, including untracked records and generator inputs. */
export function buildProvenance(repoRoot: string): NonNullable<VersionInfo["provenance"]> {
  const commit = git(repoRoot, "rev-parse", "HEAD");
  const raw = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--",
    "source", "data", "lib", "scripts", "package.json", "package-lock.json", "tsconfig*.json", ".gitattributes"],
    { cwd: repoRoot, encoding: "utf8" });
  const entries = raw.split("\0");
  const dirtyPaths: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    dirtyPaths.push(entry.slice(3).replace(/\\/g, "/"));
    if (/[RC]/.test(entry.slice(0, 2)) && entries[i + 1]) dirtyPaths.push(entries[++i].replace(/\\/g, "/"));
  }
  return { commit, dirty: dirtyPaths.length > 0, ...(dirtyPaths.length ? { dirtyPaths: [...new Set(dirtyPaths)].sort() } : {}) };
}

/** Publication adds provenance to the same content metadata used in Git. */
export function buildVersionInfo(repoRoot: string) {
  const provenance = buildProvenance(repoRoot);
  const commitDate = git(repoRoot, "log", "-1", "--format=%cI");
  return {
    ...buildContentInfo(repoRoot),
    version: commitDate.slice(0, 10).replace(/-/g, "."),
    commit: provenance.commit,
    shortCommit: provenance.commit.slice(0, 7),
    commitDate,
    provenance,
  } satisfies VersionInfo;
}
