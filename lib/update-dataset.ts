// One transaction boundary for CLI edits and imports. No live source is
// modified until the complete candidate has generated and validated.
import * as fs from "node:fs";
import * as path from "node:path";
import { writeDataJson } from "./data-json.js";
import { applyFilePlan, resolveOwnedPath } from "./file-plan.js";
import { generateDataset, withDatasetCopy } from "./generate-dataset.js";
import { runDataQuality, type Issue } from "./data-quality.js";
import { planBundles, sourceCollection, writeSourceRecord, type SourceCollection } from "./sources.js";

export interface RecordUpdate { collection: SourceCollection["name"]; record: Record<string, unknown> }
export interface DatasetUpdateOptions {
  dryRun?: boolean;
  force?: boolean;
  /** Grouped authored JSON changed by the same import (paths under data/). */
  dataFiles?: ReadonlyMap<string, unknown>;
}
export interface DatasetUpdateResult { written: boolean; newIssues: Issue[]; changed: string[] }

function tree(root: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const walk = (rel: string) => {
    if (!fs.existsSync(path.join(root, rel))) return;
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child);
      else if (e.isFile()) out.set(child, fs.readFileSync(path.join(root, child)));
      else throw new Error(`Dataset entry must be a regular file or directory: ${child}`);
    }
  };
  walk("source"); walk("data"); return out;
}

export function updateDataset(repoRoot: string, updates: readonly RecordUpdate[], options: DatasetUpdateOptions = {}): DatasetUpdateResult {
  const preflight = planBundles(repoRoot).result;
  if (preflight.sourceIssues.length) throw new Error(preflight.sourceIssues.map(i => `${i.file}: ${i.problem}`).join("\n"));
  const before = tree(repoRoot);
  const issueKey = (i: Issue) => JSON.stringify([i.file, i.entityId, i.field, i.issue, i.value]);
  const priorIssues = new Set(runDataQuality(path.join(repoRoot, "data")).map(issueKey));
  return withDatasetCopy(repoRoot, candidate => {
    for (const update of updates) writeSourceRecord(candidate, sourceCollection(update.collection), update.record);
    for (const [rel, value] of options.dataFiles ?? []) {
      const normalized = rel.replace(/\\/g, "/");
      if (!normalized.startsWith("data/") || normalized === "data/version.json" || /^data\/(tablets|pens|pressure-response)\//.test(normalized)) {
        throw new Error(`Not an authored grouped data path: ${rel}`);
      }
      writeDataJson(resolveOwnedPath(candidate, normalized), value);
    }
    const generated = generateDataset(candidate, { write: true, checkQuality: false });
    if (generated.sourceIssues.length) throw new Error(generated.sourceIssues.map(i => `${i.file}: ${i.problem}`).join("\n"));
    const newIssues = runDataQuality(path.join(candidate, "data")).filter(i => !priorIssues.has(issueKey(i)));
    if (options.dryRun || (newIssues.length && !options.force)) return { written: false, newIssues, changed: [] };
    const after = tree(candidate);
    const plan = new Map<string, Buffer | null>();
    for (const [file, bytes] of after) if (!before.get(file)?.equals(bytes)) plan.set(file, bytes);
    for (const file of before.keys()) if (!after.has(file)) plan.set(file, null);
    // Refuse to overwrite a concurrent local edit made while the candidate was validated.
    const current = tree(repoRoot);
    if (current.size !== before.size || [...before].some(([file, bytes]) => !current.get(file)?.equals(bytes))) {
      throw new Error("Dataset changed during validation; retry the edit against the current files");
    }
    applyFilePlan(repoRoot, plan);
    return { written: true, newIssues, changed: [...plan.keys()] };
  });
}

/** Imports fail loudly on rejected changes; the interactive edit CLI can inspect the outcome. */
export function commitDatasetUpdate(repoRoot: string, updates: readonly RecordUpdate[], options: DatasetUpdateOptions = {}): DatasetUpdateResult {
  const result = updateDataset(repoRoot, updates, options);
  if (!result.written && result.newIssues.length) {
    throw new Error(`Nothing written: ${result.newIssues.map(i => `${i.entityId} ${i.field}: ${i.issue}`).join("\n")}`);
  }
  return result;
}
