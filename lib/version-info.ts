// Builds the dataset's version metadata (schema version, data commit,
// record counts) from a checkout. Node-only.
//
// It used to live only inside scripts/generate-version.ts, which wrote the
// tracked data/version.json by hand — so nothing kept it current, and the
// Explorer's About page showed an April snapshot (300 tablets) against a
// dataset of 377 (TheSevenPens/DrawTabDataExplorer#333). Consumers now call
// buildVersionInfo() at *their* build time instead of trusting that file.

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
  walk(dataDir, "");
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
export function verificationMetadata(repoRoot: string): Pick<VersionInfo, "sourceDigest" | "bundles"> {
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
  return { sourceDigest: digest, bundles };
}

/** Version metadata for the data checkout at `repoRoot` (the dir holding `data/`). */
export function buildVersionInfo(repoRoot: string): VersionInfo {
  const dataDir = path.join(repoRoot, "data");
  const commit = git(repoRoot, "rev-parse", "HEAD");
  const commitDate = git(repoRoot, "log", "-1", "--format=%cI");
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    version: commitDate.slice(0, 10).replace(/-/g, "."), // YYYY.MM.DD
    commit,
    shortCommit: commit.slice(0, 7),
    commitDate,
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
