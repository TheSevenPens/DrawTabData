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
  };
}
