// Backfill Model.LaunchYear from Model.ReleaseDate when LaunchYear is empty.
// ReleaseDate may be YYYY, YYYY-MM, or YYYY-MM-DD; the leading four digits become LaunchYear.
//
// Usage: npx tsx scripts/backfill-launch-year-from-release.ts [--dry-run]

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tabletsDir = path.join(__dirname, "..", "data", "tablets");

export function yearFromReleaseDate(releaseDate: string): string | null {
	const trimmed = releaseDate.trim();
	const match = trimmed.match(/^(\d{4})(?:-\d{2}(?:-\d{2})?)?$/);
	return match ? match[1]! : null;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function main(argv: string[] = process.argv): void {
	const dryRun = argv.includes("--dry-run");
	let updated = 0;

	for (const file of fs.readdirSync(tabletsDir).filter((f) => f.endsWith("-tablets.json"))) {
		const filePath = path.join(tabletsDir, file);
		let content = fs.readFileSync(filePath, "utf-8");
		const data = JSON.parse(content) as {
			DrawingTablets: Array<{
				Meta?: { EntityId?: string };
				Model: { Id: string; LaunchYear?: string; ReleaseDate?: string };
			}>;
		};
		let fileModified = false;

		for (const tablet of data.DrawingTablets) {
			const launchYear = (tablet.Model.LaunchYear ?? "").trim();
			const releaseDate = (tablet.Model.ReleaseDate ?? "").trim();
			if (launchYear || !releaseDate) continue;

			const year = yearFromReleaseDate(releaseDate);
			if (!year) {
				console.warn(
					`  skip ${tablet.Meta?.EntityId ?? tablet.Model.Id}: cannot parse year from ReleaseDate "${releaseDate}"`,
				);
				continue;
			}

			const modelId = tablet.Model.Id;
			const pattern = new RegExp(
				`("Id":\\s*"${escapeRegExp(modelId)}",[\\s\\S]{0,400}?"LaunchYear":\\s*)""`,
			);
			if (!pattern.test(content)) {
				console.warn(
					`  skip ${tablet.Meta?.EntityId ?? modelId}: LaunchYear pattern not found in ${file}`,
				);
				continue;
			}

			content = content.replace(pattern, `$1"${year}"`);
			console.log(
				`  ${file}: ${tablet.Meta?.EntityId ?? modelId} LaunchYear -> ${year} (from ${releaseDate})`,
			);
			updated++;
			fileModified = true;
		}

		if (fileModified && !dryRun) {
			fs.writeFileSync(filePath, content);
		}
	}

	console.log(`\n${dryRun ? "Would update" : "Updated"} ${updated} tablet(s).`);
}

const isMain =
	typeof process !== "undefined" &&
	process.argv[1] &&
	path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
	main();
}
