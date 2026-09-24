import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { backfillReleaseYear, yearFromReleaseDate } from "./backfill-release-year.js";
import { formatDataJson } from "../lib/data-json.js";

describe("yearFromReleaseDate", () => {
	it("parses YYYY-MM-DD", () => {
		expect(yearFromReleaseDate("2024-06-24")).toBe("2024");
	});

	it("parses YYYY-MM", () => {
		expect(yearFromReleaseDate("2023-10")).toBe("2023");
	});

	it("parses YYYY", () => {
		expect(yearFromReleaseDate("2014")).toBe("2014");
	});

	it("rejects invalid values", () => {
		expect(yearFromReleaseDate("")).toBeNull();
		expect(yearFromReleaseDate("20")).toBeNull();
	});
});

describe("backfillReleaseYear", () => {
	let dir: string;
	const tablet = (id: string, model: Record<string, string>) => ({
		Meta: { EntityId: `acme.tablet.${id.toLowerCase()}` },
		Model: { Brand: "ACME", Id: id, Name: `Café “${id}” & Co`, ReleaseYear: "", ...model },
		Physical: { Weight: 5, Depth: 92.3 },
	});
	const fixture = {
		DrawingTablets: [
			tablet("A1", { ReleaseDate: "2024-06-24" }),
			tablet("B2", { ReleaseYear: "2019", ReleaseDate: "2020-01" }),
			tablet("C3", {}),
			tablet("D4", { ReleaseDate: "soon" }),
		],
	};
	const file = () => path.join(dir, "tablets", "ACME-tablets.json");

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "backfill-release-year-"));
		fs.mkdirSync(path.join(dir, "tablets"));
		fs.writeFileSync(file(), formatDataJson(fixture));
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("fills only empty years it can parse and writes canonical JSON", () => {
		expect(backfillReleaseYear(dir)).toBe(1);
		const expected = structuredClone(fixture);
		expected.DrawingTablets[0].Model.ReleaseYear = "2024";
		expect(fs.readFileSync(file(), "utf8")).toBe(formatDataJson(expected));
	});

	it("leaves the file untouched on --dry-run", () => {
		const before = fs.readFileSync(file(), "utf8");
		expect(backfillReleaseYear(dir, { dryRun: true })).toBe(1);
		expect(fs.readFileSync(file(), "utf8")).toBe(before);
	});
});
