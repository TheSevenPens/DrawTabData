// Backfill Model.ReleaseYear from Model.ReleaseDate when ReleaseYear is empty.
// ReleaseDate may be YYYY, YYYY-MM, or YYYY-MM-DD; the leading four digits become ReleaseYear.
//
// Usage: npx tsx scripts/backfill-release-year.ts [--dry-run] [--data-dir <dir>]

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { readDataJson, writeDataJson } from "../lib/data-json.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = path.join(__dirname, "..", "data");

export function yearFromReleaseDate(releaseDate: string): string | null {
	const trimmed = releaseDate.trim();
	const match = trimmed.match(/^(\d{4})(?:-\d{2}(?:-\d{2})?)?$/);
	return match ? match[1]! : null;
}

interface TabletsFile {
	DrawingTablets: Array<{
		Meta?: { EntityId?: string };
		Model: { Id: string; ReleaseYear?: string; ReleaseDate?: string };
	}>;
}

/** Fill empty ReleaseYear from ReleaseDate in every tablets file. Returns the number of tablets updated. */
export function backfillReleaseYear(dataDir: string, { dryRun = false } = {}): number {
	const tabletsDir = path.join(dataDir, "tablets");
	let updated = 0;

	for (const file of fs.readdirSync(tabletsDir).filter((f) => f.endsWith("-tablets.json"))) {
		const filePath = path.join(tabletsDir, file);
		const data = readDataJson<TabletsFile>(filePath);
		let fileModified = false;

		for (const tablet of data.DrawingTablets) {
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
			console.log(
				`  ${file}: ${tablet.Meta?.EntityId ?? tablet.Model.Id} ReleaseYear -> ${year} (from ${releaseDate})`,
			);
			updated++;
			fileModified = true;
		}

		if (fileModified && !dryRun) {
			writeDataJson(filePath, data);
		}
	}

	return updated;
}

export function main(argv: string[] = process.argv): void {
	const dryRun = argv.includes("--dry-run");
	const dataDirIdx = argv.indexOf("--data-dir");
	const dataDir = dataDirIdx >= 0 ? path.resolve(argv[dataDirIdx + 1] ?? ".") : defaultDataDir;
	const updated = backfillReleaseYear(dataDir, { dryRun });
	console.log(`\n${dryRun ? "Would update" : "Updated"} ${updated} tablet(s).`);
}

const isMain =
	typeof process !== "undefined" &&
	process.argv[1] &&
	path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
	main();
}
