import { describe, it, expect } from "vitest";
import { yearFromReleaseDate } from "./backfill-launch-year-from-release.js";

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
