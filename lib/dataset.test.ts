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
