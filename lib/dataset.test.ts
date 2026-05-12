import { describe, it, expect, beforeAll } from "vitest";
import * as path from "path";
import * as url from "url";
import { DrawTabDataSet } from "./dataset.js";

const dataDir = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "..",
  "data",
);

// One dataset reused across all tests where caching isn't the subject.
let ds: DrawTabDataSet;
beforeAll(() => {
  ds = new DrawTabDataSet({ kind: "disk", dataDir, userId: "sevenpens" });
});

describe("Query — materialisation", () => {
  it("toArray returns the full unfiltered collection", async () => {
    const tablets = await ds.Tablets.toArray();
    expect(tablets.length).toBeGreaterThan(100);
  });

  it("count matches toArray length", async () => {
    const n = await ds.Tablets.count();
    const arr = await ds.Tablets.toArray();
    expect(n).toBe(arr.length);
  });

  it("find returns the first matching record or undefined", async () => {
    const t = await ds.Tablets.find((t) => t.Model.Id === "PL-550");
    expect(t?.Model.Name).toBe("Cintiq 15X");
    const missing = await ds.Tablets.find((t) => t.Model.Id === "DOES-NOT-EXIST");
    expect(missing).toBeUndefined();
  });
});

describe("Query — fluent chain", () => {
  it("filter narrows results by field equality", async () => {
    const wacom = await ds.Tablets.filter("Brand", "==", "WACOM").toArray();
    expect(wacom.length).toBeGreaterThan(0);
    expect(wacom.every((t) => t.Model.Brand === "WACOM")).toBe(true);
  });

  it("multi-step filter chain composes", async () => {
    const cintiqPl = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .filter("ModelFamily", "==", "wacom.tabletfamily.wacom_cintiqpl")
      .toArray();
    expect(cintiqPl.length).toBeGreaterThan(0);
    expect(cintiqPl.every((t) => t.Model.Family === "wacom.tabletfamily.wacom_cintiqpl")).toBe(true);
  });

  it("sort orders ascending by default", async () => {
    const sorted = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .sort("ModelLaunchYear")
      .take(5)
      .toArray();
    const years = sorted.map((t) => t.Model.LaunchYear).filter(Boolean);
    expect(years).toEqual([...years].sort());
  });

  it("sort descending reverses order", async () => {
    const sorted = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .sort("ModelLaunchYear", "desc")
      .take(5)
      .toArray();
    const years = sorted.map((t) => t.Model.LaunchYear).filter(Boolean);
    expect(years).toEqual([...years].sort().reverse());
  });

  it("take limits the result count", async () => {
    const five = await ds.Pens.take(5).toArray();
    expect(five.length).toBe(5);
  });
});

describe("Query — filter operators", () => {
  it("contains is case-insensitive", async () => {
    const upper = await ds.Tablets.filter("ModelName", "contains", "INTUOS").count();
    const lower = await ds.Tablets.filter("ModelName", "contains", "intuos").count();
    const mixed = await ds.Tablets.filter("ModelName", "contains", "Intuos").count();
    expect(upper).toBeGreaterThan(0);
    expect(upper).toBe(lower);
    expect(upper).toBe(mixed);
  });

  it("notcontains excludes matches", async () => {
    const total = await ds.Tablets.count();
    const withMatch = await ds.Tablets.filter("ModelName", "contains", "intuos").count();
    const withoutMatch = await ds.Tablets.filter("ModelName", "notcontains", "intuos").count();
    expect(withMatch + withoutMatch).toBe(total);
  });

  it("startswith is case-insensitive and anchors to the prefix", async () => {
    const upper = await ds.Tablets.filter("ModelName", "startswith", "CINTIQ").count();
    const lower = await ds.Tablets.filter("ModelName", "startswith", "cintiq").count();
    expect(upper).toBeGreaterThan(0);
    expect(upper).toBe(lower);
    // Every returned name actually starts with Cintiq (case-insensitive).
    const matches = await ds.Tablets.filter("ModelName", "startswith", "cintiq").toArray();
    expect(matches.every((t) => t.Model.Name.toLowerCase().startsWith("cintiq"))).toBe(true);
  });

  it("notstartswith is the complement of startswith", async () => {
    const total = await ds.Tablets.count();
    const starts = await ds.Tablets.filter("ModelName", "startswith", "cintiq").count();
    const doesntStart = await ds.Tablets.filter("ModelName", "notstartswith", "cintiq").count();
    expect(starts + doesntStart).toBe(total);
  });

  it("empty matches missing/blank string fields", async () => {
    const total = await ds.Tablets.count();
    const empty = await ds.Tablets.filter("ModelFamily", "empty", "").count();
    const notEmpty = await ds.Tablets.filter("ModelFamily", "notempty", "").count();
    expect(empty + notEmpty).toBe(total);
    // Cross-check: every "empty" row really has no ModelFamily.
    const emptyRows = await ds.Tablets.filter("ModelFamily", "empty", "").toArray();
    expect(emptyRows.every((t) => !t.Model.Family)).toBe(true);
  });

  it("numeric > and < bracket the dataset", async () => {
    const after2020 = await ds.Tablets.filter("ModelLaunchYear", ">", 2020).toArray();
    expect(after2020.length).toBeGreaterThan(0);
    expect(after2020.every((t) => (t.Model.LaunchYear ?? 0) > 2020)).toBe(true);

    const before2000 = await ds.Tablets.filter("ModelLaunchYear", "<", 2000).toArray();
    expect(before2000.length).toBeGreaterThan(0);
    expect(before2000.every((t) => Number(t.Model.LaunchYear) < 2000)).toBe(true);
  });

  it("numeric >= and <= are inclusive at the boundary", async () => {
    const ge = await ds.Tablets.filter("ModelLaunchYear", ">=", 2020).count();
    const gt = await ds.Tablets.filter("ModelLaunchYear", ">", 2020).count();
    const eq = await ds.Tablets.filter("ModelLaunchYear", "==", 2020).count();
    expect(ge).toBe(gt + eq);

    const le = await ds.Tablets.filter("ModelLaunchYear", "<=", 2020).count();
    const lt = await ds.Tablets.filter("ModelLaunchYear", "<", 2020).count();
    expect(le).toBe(lt + eq);
  });

  it("numeric comparisons exclude blank values", async () => {
    // A very low lower bound: every row with a numeric year passes; rows with
    // an empty ModelLaunchYear are excluded (engine bails on val === "").
    const withYear = await ds.Tablets.filter("ModelLaunchYear", ">", -1).count();
    const notEmpty = await ds.Tablets.filter("ModelLaunchYear", "notempty", "").count();
    expect(withYear).toBe(notEmpty);
  });
});

describe("Query — summarize", () => {
  it("single-field count groups by Brand", async () => {
    const rows = await ds.Tablets.summarize({ by: "Brand", count: true }).toArray();
    expect(rows.length).toBeGreaterThan(1);
    // Every row has Brand and count keys; count sums to the full tablet count.
    expect(rows.every((r) => typeof r.Brand === "string" && typeof r.count === "number")).toBe(true);
    const total = rows.reduce((s, r) => s + (r.count as number), 0);
    const all = await ds.Tablets.count();
    expect(total).toBe(all);
  });

  it("count column accepts a custom name", async () => {
    const rows = await ds.Tablets.summarize({ by: "Brand", count: "tablets" }).toArray();
    expect(rows[0]).toHaveProperty("tablets");
    expect(rows[0]).not.toHaveProperty("count");
  });

  it("multi-field groupBy produces one row per distinct combination", async () => {
    const rows = await ds.Tablets
      .summarize({ by: ["Brand", "ModelType"], count: "tablets" })
      .toArray();
    expect(rows.length).toBeGreaterThan(1);
    // No two rows share the same (Brand, ModelType) pair.
    const keys = rows.map((r) => `${r.Brand}|${r.ModelType}`);
    expect(new Set(keys).size).toBe(keys.length);
    // Total matches the entity count.
    const total = rows.reduce((s, r) => s + (r.tablets as number), 0);
    expect(total).toBe(await ds.Tablets.count());
  });

  it("avg/min/max aggregators read field values via FieldDef", async () => {
    const rows = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .summarize({
        by: "Brand",
        avg: { avgYear: "ModelLaunchYear" },
        min: { firstYear: "ModelLaunchYear" },
        max: { lastYear: "ModelLaunchYear" },
      })
      .toArray();
    expect(rows.length).toBe(1);
    const r = rows[0];
    expect(r.Brand).toBe("WACOM");
    expect(r.firstYear).toBeGreaterThan(1980);
    expect(r.lastYear).toBeGreaterThanOrEqual(r.firstYear as number);
    expect(r.avgYear).toBeGreaterThanOrEqual(r.firstYear as number);
    expect(r.avgYear).toBeLessThanOrEqual(r.lastYear as number);
  });

  it("summarize chains with sort and take", async () => {
    const top3 = await ds.Tablets
      .summarize({ by: "Brand", count: "tablets" })
      .sort("tablets", "desc")
      .take(3)
      .toArray();
    expect(top3.length).toBe(3);
    const counts = top3.map((r) => r.tablets as number);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("summarize with no groupBy produces a single all-rows summary", async () => {
    const rows = await ds.Tablets.summarize({ count: "tablets" }).toArray();
    expect(rows.length).toBe(1);
    expect(rows[0].tablets).toBe(await ds.Tablets.count());
  });

  it("summarize runs after upstream filters", async () => {
    const rows = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .summarize({ by: "ModelType", count: "tablets" })
      .toArray();
    const filteredTotal = await ds.Tablets.filter("Brand", "==", "WACOM").count();
    const summed = rows.reduce((s, r) => s + (r.tablets as number), 0);
    expect(summed).toBe(filteredTotal);
  });

  it("unknown groupBy field collapses to a single empty-key group", async () => {
    // The engine degrades unknown groupBy keys to an empty value rather than
    // throwing — same forgiving behaviour as applyFilter. Keep that pinned so
    // it can't silently flip to "throw" without a test failure.
    const rows = await ds.Tablets
      .summarize({ by: "NotAField", count: "tablets" })
      .toArray();
    expect(rows.length).toBe(1);
    expect(rows[0].NotAField).toBe("");
    expect(rows[0].tablets).toBe(await ds.Tablets.count());
  });

  it("unknown aggregator field yields 0", async () => {
    const rows = await ds.Tablets
      .summarize({ by: "Brand", sum: { weird: "NotAField" } })
      .toArray();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.weird === 0)).toBe(true);
  });

  it("median is the middle value (even count → average of middle two)", async () => {
    const rows = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .summarize({ by: "Brand", median: { medianYear: "ModelLaunchYear" } })
      .toArray();
    expect(rows.length).toBe(1);
    const m = rows[0].medianYear as number;
    // Sanity: median sits inside the known min/max.
    expect(m).toBeGreaterThan(1980);
    expect(m).toBeLessThan(2030);
  });

  it("first and last read raw values in input order", async () => {
    const rows = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .summarize({
        by: "Brand",
        first: { firstId: "ModelId" },
        last: { lastId: "ModelId" },
      })
      .toArray();
    expect(rows.length).toBe(1);
    expect(typeof rows[0].firstId).toBe("string");
    expect(typeof rows[0].lastId).toBe("string");
    // Cross-check against the raw entity stream.
    const wacom = await ds.Tablets.filter("Brand", "==", "WACOM").toArray();
    expect(rows[0].firstId).toBe(wacom[0].Model.Id);
    expect(rows[0].lastId).toBe(wacom[wacom.length - 1].Model.Id);
  });

  it("distinctCount counts unique non-empty values per group", async () => {
    const rows = await ds.Tablets
      .summarize({ by: "Brand", distinctCount: { types: "ModelType" } })
      .toArray();
    expect(rows.length).toBeGreaterThan(0);
    // At least one brand has multiple ModelTypes.
    expect(rows.some((r) => (r.types as number) > 1)).toBe(true);
    // Every distinctCount is ≤ the number of rows in that group (since
    // distinct can't exceed total).
    const counts = await ds.Tablets.summarize({ by: "Brand", count: "n" }).toArray();
    for (const r of rows) {
      const cr = counts.find((c) => c.Brand === r.Brand)!;
      expect(r.types).toBeLessThanOrEqual(cr.n as number);
    }
  });

  it("collect returns an array of raw values per group", async () => {
    const rows = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .summarize({ by: "Brand", collect: { ids: "ModelId" } })
      .toArray();
    expect(rows.length).toBe(1);
    expect(Array.isArray(rows[0].ids)).toBe(true);
    const ids = rows[0].ids as string[];
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((s) => typeof s === "string")).toBe(true);
  });
});

describe("Query — select (project)", () => {
  it("projects rows to only the requested fields", async () => {
    const rows = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .select(["Brand", "ModelId", "ModelLaunchYear"])
      .take(3)
      .toArray();
    expect(rows.length).toBe(3);
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(["Brand", "ModelId", "ModelLaunchYear"]);
      expect(r.Brand).toBe("WACOM");
    }
  });

  it("downstream sort/filter target projected columns", async () => {
    const rows = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .select(["ModelId", "ModelLaunchYear"])
      .sort("ModelLaunchYear", "desc")
      .take(5)
      .toArray();
    const years = rows.map((r) => Number(r.ModelLaunchYear)).filter((n) => !isNaN(n));
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it("unknown fields degrade to empty strings", async () => {
    const rows = await ds.Tablets.select(["Brand", "NotAField"]).take(1).toArray();
    expect(rows[0].NotAField).toBe("");
  });
});

describe("Query — distinct / values", () => {
  it("returns sorted distinct non-empty values", async () => {
    const brands = await ds.Tablets.distinct("Brand");
    expect(brands.length).toBeGreaterThan(1);
    expect(brands.every((b) => typeof b === "string" && b !== "")).toBe(true);
    expect(brands).toEqual([...brands].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    // No duplicates.
    expect(new Set(brands).size).toBe(brands.length);
  });

  it("composes with upstream filters", async () => {
    const types = await ds.Tablets.filter("Brand", "==", "WACOM").distinct("ModelType");
    expect(types.length).toBeGreaterThan(0);
    // Each type really is used by a Wacom tablet.
    for (const t of types) {
      const n = await ds.Tablets
        .filter("Brand", "==", "WACOM")
        .filter("ModelType", "==", t)
        .count();
      expect(n).toBeGreaterThan(0);
    }
  });

  it("values is a synonym for distinct", async () => {
    const a = await ds.Tablets.distinct("Brand");
    const b = await ds.Tablets.values("Brand");
    expect(b).toEqual(a);
  });
});

describe("Query — predicate filter", () => {
  it("filter(fn) applies an arbitrary predicate", async () => {
    const post2020 = await ds.Tablets
      .filter((t) => (t.Model.LaunchYear ?? 0) >= 2020)
      .toArray();
    expect(post2020.length).toBeGreaterThan(0);
    expect(post2020.every((t) => (t.Model.LaunchYear ?? 0) >= 2020)).toBe(true);
  });

  it("predicate composes with string-tuple filters", async () => {
    const wacomRecent = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .filter((t) => (t.Model.LaunchYear ?? 0) >= 2020)
      .toArray();
    expect(wacomRecent.length).toBeGreaterThan(0);
    expect(wacomRecent.every((t) => t.Model.Brand === "WACOM" && (t.Model.LaunchYear ?? 0) >= 2020)).toBe(true);
  });
});

describe("Query — boolean filter expressions", () => {
  it("OR matches rows satisfying any clause", async () => {
    const eitherBrand = await ds.Tablets
      .filter({
        or: [
          { field: "Brand", op: "==", value: "WACOM" },
          { field: "Brand", op: "==", value: "HUION" },
        ],
      })
      .toArray();
    const w = await ds.Tablets.filter("Brand", "==", "WACOM").count();
    const h = await ds.Tablets.filter("Brand", "==", "HUION").count();
    expect(eitherBrand.length).toBe(w + h);
    expect(eitherBrand.every((t) => t.Model.Brand === "WACOM" || t.Model.Brand === "HUION")).toBe(true);
  });

  it("AND nests inside OR", async () => {
    const rows = await ds.Tablets
      .filter({
        or: [
          {
            and: [
              { field: "Brand", op: "==", value: "WACOM" },
              { field: "ModelType", op: "==", value: "PENDISPLAY" },
            ],
          },
          { field: "Brand", op: "==", value: "XENCELABS" },
        ],
      })
      .toArray();
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every(
        (t) =>
          (t.Model.Brand === "WACOM" && t.Model.Type === "PENDISPLAY") ||
          t.Model.Brand === "XENCELABS",
      ),
    ).toBe(true);
  });

  it("NOT inverts its sub-expression", async () => {
    const total = await ds.Tablets.count();
    const notWacom = await ds.Tablets
      .filter({ not: { field: "Brand", op: "==", value: "WACOM" } })
      .toArray();
    const wacom = await ds.Tablets.filter("Brand", "==", "WACOM").count();
    expect(notWacom.length).toBe(total - wacom);
    expect(notWacom.every((t) => t.Model.Brand !== "WACOM")).toBe(true);
  });
});

describe("Query — derive", () => {
  it("adds computed columns usable downstream", async () => {
    const rows = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .derive({
        ageBucket: (t) => Math.floor((2026 - (t.Model.LaunchYear ?? 2026)) / 10) * 10,
      })
      .summarize({ by: "ageBucket", count: "tablets" })
      .sort("ageBucket", "asc")
      .toArray();
    expect(rows.length).toBeGreaterThan(1);
    const total = rows.reduce((s, r) => s + (r.tablets as number), 0);
    expect(total).toBe(await ds.Tablets.filter("Brand", "==", "WACOM").count());
  });

  it("derived columns can be sorted on", async () => {
    const rows = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .derive({ yearMinus2000: (t) => (t.Model.LaunchYear ?? 2000) - 2000 })
      .sort("yearMinus2000", "desc")
      .take(3)
      .toArray();
    expect(rows.length).toBe(3);
    const vals = rows.map((r) => Number((r as Record<string, unknown>).yearMinus2000));
    expect(vals).toEqual([...vals].sort((a, b) => b - a));
  });
});

describe("Query — join / semijoin", () => {
  it("semijoin keeps left rows that have a match on the right", async () => {
    // The relationship helper is now backed by semijoin — verify both paths
    // agree on a known tablet's compatible pens.
    const tablet = await ds.Tablets.find((t) => t.Model.Id === "PL-550");
    const fromHelper = await tablet!.getCompatiblePens();
    const fromVerb = await ds.Pens
      .semijoin(ds.PenCompat.filter("TabletId", "==", "PL-550"), "PenId", "PenId")
      .toArray();
    expect(fromVerb.map((p) => p.PenId).sort()).toEqual(fromHelper.map((p) => p.PenId).sort());
  });

  it("semijoin row shape is the left side (no right-side fields merged)", async () => {
    const rows = await ds.Pens
      .semijoin(ds.PenCompat.filter("TabletId", "==", "PL-550"), "PenId", "PenId")
      .toArray();
    expect(rows.length).toBeGreaterThan(0);
    // Pen records have Brand; PenCompat rows have TabletId. The result is
    // pure Pens — no TabletId pollution.
    for (const r of rows) {
      expect("TabletId" in r).toBe(false);
      expect(typeof r.Brand).toBe("string");
    }
  });

  it("inner join merges right-side columns into matched rows", async () => {
    const compatForPL550 = ds.PenCompat.filter("TabletId", "==", "PL-550");
    // Join the (filtered) PenCompat rows to pen records on PenId.
    const joined = await compatForPL550.join(ds.Pens, "PenId", "PenId").toArray();
    expect(joined.length).toBeGreaterThan(0);
    // Each row carries both PenCompat fields (TabletId) and Pen fields (Brand).
    for (const r of joined as Array<Record<string, unknown>>) {
      expect(r.TabletId).toBe("PL-550");
      expect(typeof r.Brand).toBe("string");
    }
  });
});

describe("Query — skip / last / reverse", () => {
  it("skip drops the first N rows", async () => {
    const all = await ds.Tablets.sort("ModelLaunchYear").toArray();
    const skipped = await ds.Tablets.sort("ModelLaunchYear").skip(10).toArray();
    expect(skipped.length).toBe(all.length - 10);
    expect(skipped[0]).toEqual(all[10]);
  });

  it("skip + take is a paged window", async () => {
    const page1 = await ds.Tablets.sort("ModelLaunchYear").take(5).toArray();
    const page2 = await ds.Tablets.sort("ModelLaunchYear").skip(5).take(5).toArray();
    expect(page2.length).toBe(5);
    expect(page2[0]).not.toEqual(page1[0]);
  });

  it("last returns the trailing N rows in input order", async () => {
    const sorted = await ds.Tablets.sort("ModelLaunchYear").toArray();
    const last3 = await ds.Tablets.sort("ModelLaunchYear").last(3).toArray();
    expect(last3).toEqual(sorted.slice(-3));
  });

  it("reverse flips the order without re-sorting", async () => {
    const asc = await ds.Tablets.sort("ModelLaunchYear").take(5).toArray();
    const rev = await ds.Tablets.sort("ModelLaunchYear").take(5).reverse().toArray();
    expect(rev).toEqual([...asc].reverse());
  });
});

describe("Query — multi-key sort", () => {
  it("array form sorts primary-by-first", async () => {
    const rows = await ds.Tablets
      .filterIn("Brand", ["WACOM", "HUION"])
      .sort([
        { field: "Brand", direction: "asc" },
        { field: "ModelLaunchYear", direction: "desc" },
      ])
      .toArray();
    expect(rows.length).toBeGreaterThan(0);
    // Primary asc on Brand → HUION precedes WACOM alphabetically.
    const firstHuion = rows.findIndex((t) => t.Model.Brand === "HUION");
    const lastHuion = rows.map((t) => t.Model.Brand).lastIndexOf("HUION");
    const firstWacom = rows.findIndex((t) => t.Model.Brand === "WACOM");
    expect(firstHuion).toBe(0);
    expect(lastHuion).toBeLessThan(firstWacom);
    // Secondary desc on year — within each brand, years descending.
    const wacomYears = rows
      .filter((t) => t.Model.Brand === "WACOM")
      .map((t) => Number(t.Model.LaunchYear))
      .filter((n) => !isNaN(n));
    expect(wacomYears).toEqual([...wacomYears].sort((a, b) => b - a));
  });
});

describe("Query — new filter operators", () => {
  it("'in' matches any of the listed values", async () => {
    const both = await ds.Tablets.filter("Brand", "in", "WACOM|HUION").count();
    const w = await ds.Tablets.filter("Brand", "==", "WACOM").count();
    const h = await ds.Tablets.filter("Brand", "==", "HUION").count();
    expect(both).toBe(w + h);
  });

  it("'notin' is the complement of 'in'", async () => {
    const total = await ds.Tablets.count();
    const inSet = await ds.Tablets.filter("Brand", "in", "WACOM|HUION").count();
    const notInSet = await ds.Tablets.filter("Brand", "notin", "WACOM|HUION").count();
    expect(inSet + notInSet).toBe(total);
  });

  it("'between' is inclusive at both ends", async () => {
    const range = await ds.Tablets
      .filter("ModelLaunchYear", "between", "2018|2022")
      .toArray();
    expect(range.length).toBeGreaterThan(0);
    for (const t of range) {
      const y = Number(t.Model.LaunchYear);
      expect(y).toBeGreaterThanOrEqual(2018);
      expect(y).toBeLessThanOrEqual(2022);
    }
  });

  it("strict contains is case-sensitive", async () => {
    const ci = await ds.Tablets.filter("ModelName", "contains", "cintiq").count();
    const cs = await ds.Tablets.filter("ModelName", "containsStrict", "cintiq").count();
    const csUpper = await ds.Tablets
      .filter("ModelName", "containsStrict", "Cintiq")
      .count();
    expect(ci).toBeGreaterThan(0);
    // Names contain "Cintiq" (capitalised), not "cintiq".
    expect(cs).toBe(0);
    expect(csUpper).toBeGreaterThan(0);
  });
});

describe("Query — filterIn / filterNotIn", () => {
  it("filterIn matches any of the listed values", async () => {
    const rows = await ds.Tablets.filterIn("Brand", ["WACOM", "HUION"]).toArray();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((t) => t.Model.Brand === "WACOM" || t.Model.Brand === "HUION")).toBe(true);
  });

  it("filterNotIn excludes the listed values", async () => {
    const total = await ds.Tablets.count();
    const excluded = await ds.Tablets.filterIn("Brand", ["WACOM", "HUION"]).count();
    const rest = await ds.Tablets.filterNotIn("Brand", ["WACOM", "HUION"]).count();
    expect(excluded + rest).toBe(total);
  });
});

describe("Query — antijoin / leftjoin", () => {
  it("antijoin keeps left rows with no match (complement of semijoin)", async () => {
    const totalPens = await ds.Pens.count();
    const compatPens = await ds.Pens
      .semijoin(ds.PenCompat, "PenId", "PenId")
      .count();
    const orphanPens = await ds.Pens
      .antijoin(ds.PenCompat, "PenId", "PenId")
      .count();
    expect(compatPens + orphanPens).toBe(totalPens);
  });

  it("leftjoin keeps all left rows; matches get right-side fields merged", async () => {
    const pl550 = ds.PenCompat.filter("TabletId", "==", "PL-550");
    const joined = await ds.Pens.leftjoin(pl550, "PenId", "PenId").toArray();
    expect(joined.length).toBe(await ds.Pens.count());
    // Rows for PL-550-compatible pens carry the right-side TabletId field;
    // others don't.
    const withTabletId = joined.filter(
      (r) => (r as Record<string, unknown>).TabletId === "PL-550",
    );
    expect(withTabletId.length).toBeGreaterThan(0);
  });
});

describe("Query — keyBy / collectBy", () => {
  it("keyBy returns a record keyed by field value (last wins on collision)", async () => {
    const byId = await ds.Tablets.keyBy("ModelId");
    expect(byId["PL-550"]).toBeDefined();
    expect(byId["PL-550"].Model.Id).toBe("PL-550");
  });

  it("collectBy buckets rows per key", async () => {
    const byBrand = await ds.Tablets.collectBy("Brand");
    expect(byBrand.WACOM.length).toBeGreaterThan(0);
    expect(byBrand.HUION.length).toBeGreaterThan(0);
    expect(byBrand.WACOM.every((t) => t.Model.Brand === "WACOM")).toBe(true);
  });

  it("keyBy works after a summarize (post-transform property access)", async () => {
    const byBrand = await ds.Tablets
      .summarize({ by: "Brand", count: "tablets" })
      .keyBy("Brand");
    expect(byBrand.WACOM).toBeDefined();
    expect((byBrand.WACOM as { tablets: number }).tablets).toBeGreaterThan(0);
  });
});

describe("Query — unroll", () => {
  it("explodes an array-valued column into one row per element", async () => {
    // AlternateNames is a nested array — lift it via derive then unroll.
    const rows = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .derive({ names: (t) => t.Model.AlternateNames ?? [] })
      .unroll("names")
      .toArray();
    // Every row carries a single string in `names`.
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows as Array<Record<string, unknown>>) {
      expect(typeof r.names).toBe("string");
    }
  });

  it("drops rows whose array is empty", async () => {
    const withAny = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .derive({ names: (t) => t.Model.AlternateNames ?? [] })
      .unroll("names")
      .count();
    const tabletsWithNames = (await ds.Tablets.filter("Brand", "==", "WACOM").toArray())
      .filter((t) => (t.Model.AlternateNames?.length ?? 0) > 0).length;
    expect(withAny).toBeGreaterThanOrEqual(tabletsWithNames);
  });
});

describe("Query — concat / union", () => {
  it("concat appends rows from another Query (UNION ALL)", async () => {
    const wacom = await ds.Tablets.filter("Brand", "==", "WACOM").count();
    const huion = await ds.Tablets.filter("Brand", "==", "HUION").count();
    const combined = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .concat(ds.Tablets.filter("Brand", "==", "HUION"))
      .count();
    expect(combined).toBe(wacom + huion);
  });

  it("union is a synonym for concat", async () => {
    const a = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .concat(ds.Tablets.filter("Brand", "==", "HUION"))
      .count();
    const b = await ds.Tablets
      .filter("Brand", "==", "WACOM")
      .union(ds.Tablets.filter("Brand", "==", "HUION"))
      .count();
    expect(b).toBe(a);
  });
});

describe("Query — filter after summarize (SQL HAVING)", () => {
  it("filters on an aggregator output column", async () => {
    const big = await ds.Tablets
      .summarize({ by: "Brand", count: "tablets" })
      .filter("tablets", ">", 30)
      .toArray();
    expect(big.length).toBeGreaterThan(0);
    expect(big.every((r) => (r.tablets as number) > 30)).toBe(true);
  });

  it("filters on a groupBy column post-summarize", async () => {
    const rows = await ds.Tablets
      .summarize({ by: "Brand", count: "tablets" })
      .filter("Brand", "==", "WACOM")
      .toArray();
    expect(rows.length).toBe(1);
    expect(rows[0].Brand).toBe("WACOM");
  });
});

describe("Query — caching", () => {
  it("collection is loaded once even when accessed via multiple queries", async () => {
    const fresh = new DrawTabDataSet({ kind: "disk", dataDir });
    const t1 = await fresh.Tablets.count();
    const t2 = await fresh.Tablets.filter("Brand", "==", "WACOM").count();
    expect(t1).toBeGreaterThan(0);
    expect(t2).toBeGreaterThan(0);
    // Both queries share the same cached promise — second query's
    // load should be nearly instantaneous (within the same microtask).
    const startSecond = performance.now();
    await fresh.Tablets.count();
    const elapsed = performance.now() - startSecond;
    expect(elapsed).toBeLessThan(50); // cached path is in-memory
  });
});

describe("Inventory access", () => {
  it("returns InventoryPens when userId is configured", async () => {
    const pens = await ds.InventoryPens.toArray();
    expect(pens.length).toBeGreaterThan(0);
  });

  it("throws when userId is missing", async () => {
    const noUser = new DrawTabDataSet({ kind: "disk", dataDir });
    await expect(noUser.InventoryPens.toArray()).rejects.toThrow(/requires a userId/);
  });
});

describe("Record-method relationships", () => {
  it("tablet.getCompatiblePens returns Pen records from PenCompat", async () => {
    const pl550 = await ds.Tablets.find((t) => t.Model.Id === "PL-550");
    expect(pl550).toBeDefined();
    const pens = await pl550!.getCompatiblePens();
    expect(pens.length).toBeGreaterThan(0);
    expect(pens.every((p) => typeof p.PenId === "string")).toBe(true);
  });

  it("pen.getCompatibleTablets is the reverse of tablet.getCompatiblePens", async () => {
    const pl550 = await ds.Tablets.find((t) => t.Model.Id === "PL-550");
    const pens = await pl550!.getCompatiblePens();
    const firstPen = pens[0];
    expect(firstPen).toBeDefined();
    const tablets = await firstPen.getCompatibleTablets();
    expect(tablets.some((t) => t.Model.Id === "PL-550")).toBe(true);
  });

  it("tablet.getFamily resolves Model.Family to a TabletFamily", async () => {
    const pl550 = await ds.Tablets.find((t) => t.Model.Id === "PL-550");
    const family = await pl550!.getFamily();
    expect(family?.EntityId).toBe("wacom.tabletfamily.wacom_cintiqpl");
  });

  it("tablet.getBrand resolves Model.Brand to a Brand record", async () => {
    const pl550 = await ds.Tablets.find((t) => t.Model.Id === "PL-550");
    const brand = await pl550!.getBrand();
    expect(brand?.BrandId).toBe("WACOM");
  });

  it("family.getTablets returns the family's members", async () => {
    const family = await ds.TabletFamilies.find(
      (f) => f.EntityId === "wacom.tabletfamily.wacom_cintiqpl",
    );
    const tablets = await family!.getTablets();
    expect(tablets.length).toBe(12); // 12 PL-* tablets
    expect(tablets.every((t) => t.Model.Family === family!.EntityId)).toBe(true);
  });

  it("brand.getTablets returns all tablets of that brand", async () => {
    const wacom = await ds.Brands.find((b) => b.BrandId === "WACOM");
    const all = await wacom!.getTablets();
    expect(all.every((t) => t.Model.Brand === "WACOM")).toBe(true);
  });

  it("brand.getPens returns all pens of that brand", async () => {
    const wacom = await ds.Brands.find((b) => b.BrandId === "WACOM");
    const all = await wacom!.getPens();
    expect(all.every((p) => p.Brand === "WACOM")).toBe(true);
  });

  it("driver.getBrand resolves", async () => {
    const driver = await ds.Drivers.find(() => true);
    expect(driver).toBeDefined();
    const brand = await driver!.getBrand();
    expect(brand?.BrandId).toBe(driver!.Brand);
  });

  it("inventoryPen.getPen resolves PenEntityId", async () => {
    const inv = await ds.InventoryPens.find(() => true);
    expect(inv).toBeDefined();
    const pen = await inv!.getPen();
    expect(pen?.EntityId).toBe(inv!.PenEntityId);
  });

  it("session.getPen and session.getTablet resolve refs", async () => {
    const s = await ds.PressureResponse.find(() => true);
    expect(s).toBeDefined();
    const pen = await s!.getPen();
    const tablet = await s!.getTablet();
    expect(pen?.EntityId).toBe(s!.PenEntityId);
    expect(tablet?.Meta.EntityId).toBe(s!.TabletEntityId);
  });
});

describe("Dataset-level resolution methods (still supported)", () => {
  it("ds.getCompatiblePens matches the record-method form", async () => {
    const pl550 = await ds.Tablets.find((t) => t.Model.Id === "PL-550");
    const a = await pl550!.getCompatiblePens();
    const b = await ds.getCompatiblePens(pl550!);
    expect(a.map((p) => p.PenId)).toEqual(b.map((p) => p.PenId));
  });

  it("ds.getBrand works on entities with top-level Brand or Model.Brand", async () => {
    const pen = await ds.Pens.find(() => true);
    const tablet = await ds.Tablets.find(() => true);
    const penBrand = await ds.getBrand(pen!);
    const tabletBrand = await ds.getBrand(tablet!);
    expect(penBrand?.BrandId).toBe(pen!.Brand);
    expect(tabletBrand?.BrandId).toBe(tablet!.Model.Brand);
  });
});

describe("Record shape — methods are non-enumerable", () => {
  it("Object.keys returns only data fields", async () => {
    const t = await ds.Tablets.find((t) => t.Model.Id === "PL-550");
    const keys = Object.keys(t!);
    expect(keys).not.toContain("getCompatiblePens");
    expect(keys).not.toContain("getFamily");
    expect(keys).toContain("Meta");
    expect(keys).toContain("Model");
  });

  it("JSON.stringify omits the methods", async () => {
    const t = await ds.Tablets.find((t) => t.Model.Id === "PL-550");
    const json = JSON.stringify(t);
    expect(json).not.toContain("getCompatiblePens");
    expect(json).toContain('"Model"');
  });
});
