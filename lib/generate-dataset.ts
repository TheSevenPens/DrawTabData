// Publish bundles and deterministic metadata from one validated candidate.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { formatDataJson } from "./data-json.js";
import { applyFilePlan } from "./file-plan.js";
import { buildContentInfo } from "./version-info.js";
import { planBundles, editableSourceFor, type GenerateResult } from "./sources.js";
import { runDataQuality, runUuidChecks } from "./data-quality.js";

export function withDatasetCopy<T>(repoRoot: string, run: (candidate: string) => T): T {
  const candidate = fs.mkdtempSync(path.join(os.tmpdir(), "drawtab-candidate-"));
  try {
    for (const dir of ["source", "data"]) {
      const from = path.join(repoRoot, dir);
      if (fs.existsSync(from)) fs.cpSync(from, path.join(candidate, dir), { recursive: true });
    }
    return run(candidate);
  } finally {
    // candidate is the exact private directory returned by mkdtemp above.
    fs.rmSync(candidate, { recursive: true, force: true });
  }
}

export function generateDataset(repoRoot: string, options: { write: boolean; checkQuality?: boolean }): GenerateResult {
  const { result, files } = planBundles(repoRoot);
  if (result.sourceIssues.length) return result;
  const plan = new Map(files);
  withDatasetCopy(repoRoot, candidate => {
    applyFilePlan(candidate, plan);
    const quality = options.checkQuality === false ? runUuidChecks(path.join(candidate, "data")) : runDataQuality(path.join(candidate, "data"));
    for (const issue of quality) result.sourceIssues.push({
      file: editableSourceFor(issue.file, issue.entityId) ?? issue.file,
      problem: `${issue.entityId} ${issue.field}: ${issue.issue}${issue.value ? ` (${issue.value})` : ""}`,
    });
    const bytes = Buffer.from(formatDataJson(buildContentInfo(candidate)), "utf8");
    plan.set("data/version.json", bytes);
    const current = path.join(repoRoot, "data/version.json");
    if (!fs.existsSync(current)) result.missing.push("data/version.json");
    else if (!fs.readFileSync(current).equals(bytes)) result.changed.push("data/version.json");
  });
  if (options.write && !result.sourceIssues.length) applyFilePlan(repoRoot, plan);
  return result;
}

export function regenerateDataset(repoRoot: string): string[] {
  const r = generateDataset(repoRoot, { write: true });
  if (r.sourceIssues.length) throw new Error(r.sourceIssues.map(i => `${i.file}: ${i.problem}`).join("\n"));
  return [...r.changed, ...r.missing, ...r.extra];
}
