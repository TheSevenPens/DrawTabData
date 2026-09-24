import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { backfillReleaseYear, yearFromReleaseDate } from "./backfill-release-year.js";
import { formatDataJson } from "../lib/data-json.js";
import { generateBundles, regenerate, sourceCollection, writeSourceRecord } from "../lib/sources.js";

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
  // A temp data-repo root: source/tablets/acme/<EntityId>.json plus the
  // generated data/tablets/ACME-tablets.json bundle.
  let root: string;
  const tablet = (id: string, model: Record<string, string>) => ({
    Meta: { EntityId: `acme.tablet.${id.toLowerCase()}` },
    Model: { Brand: "ACME", Id: id, Name: `Café “${id}” & Co`, ReleaseYear: "", ...model },
    Physical: { Weight: 5, Depth: 92.3 },
  });
  const fixture = [
    tablet("A1", { ReleaseDate: "2024-06-24" }),
    tablet("B2", { ReleaseYear: "2019", ReleaseDate: "2020-01" }),
    tablet("C3", {}),
    tablet("D4", { ReleaseDate: "soon" }),
  ];
  const source = (id: string) => path.join(root, "source", "tablets", "acme", `acme.tablet.${id}.json`);
  const bundle = () => path.join(root, "data", "tablets", "ACME-tablets.json");
  const snapshot = () =>
    Object.fromEntries(
      [...["a1", "b2", "c3", "d4"].map(source), bundle()].map((f) => [f, fs.readFileSync(f, "utf8")]),
    );

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "backfill-release-year-"));
    for (const t of fixture) writeSourceRecord(root, sourceCollection("tablets"), structuredClone(t));
    regenerate(root);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("fills only empty years it can parse, in the source, and regenerates the bundle", () => {
    const before = snapshot();
    expect(backfillReleaseYear(root)).toBe(1);

    const a1 = structuredClone(fixture[0]);
    a1.Model.ReleaseYear = "2024";
    expect(fs.readFileSync(source("a1"), "utf8")).toBe(formatDataJson(a1));
    for (const id of ["b2", "c3", "d4"]) {
      expect(fs.readFileSync(source(id), "utf8")).toBe(before[source(id)]);
    }
    expect(fs.readFileSync(bundle(), "utf8")).toBe(formatDataJson({ DrawingTablets: [a1, ...fixture.slice(1)] }));
    const check = generateBundles(root, { write: false });
    expect([...check.changed, ...check.missing, ...check.extra, ...check.sourceIssues]).toEqual([]);
  });

  it("leaves sources and bundle untouched on --dry-run", () => {
    const before = snapshot();
    expect(backfillReleaseYear(root, { dryRun: true })).toBe(1);
    expect(snapshot()).toEqual(before);
  });

  it("refuses, writing nothing, when a source has problems", () => {
    fs.writeFileSync(path.join(root, "source", "tablets", "acme", "stray.txt"), "x");
    const before = snapshot();
    expect(() => backfillReleaseYear(root)).toThrow(/stray\.txt/);
    expect(snapshot()).toEqual(before);
  });
});
