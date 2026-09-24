// Backfill Model.ReleaseYear from Model.ReleaseDate when ReleaseYear is empty.
// ReleaseDate may be YYYY, YYYY-MM, or YYYY-MM-DD; the leading four digits become ReleaseYear.
//
// Edits the tablet source files (source/tablets/<brand>/<EntityId>.json),
// then regenerates the data/tablets/ bundles once (RFC #45 — the bundles are
// generated, never edited).
//
// Usage: npx tsx scripts/backfill-release-year.ts [--dry-run] [--repo-root <dir>]
//   --repo-root  the directory holding source/ and data/ (default: this data-repo)

import * as path from "path";
import { fileURLToPath } from "url";
import { readSources, regenerate, sourceCollection, writeSourceRecord } from "../lib/sources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.join(__dirname, "..");

export function yearFromReleaseDate(releaseDate: string): string | null {
  const trimmed = releaseDate.trim();
  const match = trimmed.match(/^(\d{4})(?:-\d{2}(?:-\d{2})?)?$/);
  return match ? match[1]! : null;
}

interface TabletRecord {
  Meta?: { EntityId?: string };
  Model: { Id: string; ReleaseYear?: string; ReleaseDate?: string };
}

/**
 * Fill empty ReleaseYear from ReleaseDate in every tablet source, then
 * regenerate the bundles. Returns the number of tablets updated (or that
 * would be, on a dry run). Throws, writing nothing, if a source has problems.
 */
export function backfillReleaseYear(repoRoot: string, { dryRun = false } = {}): number {
  const tablets = sourceCollection("tablets");
  const { records, issues } = readSources(repoRoot, tablets);
  if (issues.length) {
    throw new Error(
      `tablet source problems; nothing was written:\n${issues.map((i) => `  ${i.file}: ${i.problem}`).join("\n")}`,
    );
  }

  let updated = 0;
  for (const { file, record } of records) {
    const tablet = record as unknown as TabletRecord;
    const releaseYear = (tablet.Model.ReleaseYear ?? "").trim();
    const releaseDate = (tablet.Model.ReleaseDate ?? "").trim();
    if (releaseYear || !releaseDate) continue;

    const year = yearFromReleaseDate(releaseDate);
    if (!year) {
      console.warn(
        `  skip ${tablet.Meta?.EntityId ?? tablet.Model.Id}: cannot parse year from ReleaseDate "${releaseDate}"`,
      );
      continue;
    }

    tablet.Model.ReleaseYear = year;
    console.log(`  ${file}: ReleaseYear -> ${year} (from ${releaseDate})`);
    updated++;
    if (!dryRun) writeSourceRecord(repoRoot, tablets, record);
  }

  if (!dryRun && updated > 0) {
    for (const f of regenerate(repoRoot)) console.log(`  regenerated ${f}`);
  }
  return updated;
}

export function main(argv: string[] = process.argv): void {
  const dryRun = argv.includes("--dry-run");
  const rootIdx = argv.indexOf("--repo-root");
  const repoRoot = rootIdx >= 0 ? path.resolve(argv[rootIdx + 1] ?? ".") : defaultRepoRoot;
  const updated = backfillReleaseYear(repoRoot, { dryRun });
  console.log(`\n${dryRun ? "Would update" : "Updated"} ${updated} tablet(s).`);
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
