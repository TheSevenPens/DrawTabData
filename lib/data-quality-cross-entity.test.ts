// Checks that span collections: duplicate inventory ids, orphan references
// between families / pens / tablets / pen-compat / pressure sessions, and the
// brands.json vs BRANDS drift check (#39). IncludedPen, inventory references
// and session ids have their own data-quality-*.test.ts files.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatDataJson } from "./data-json.js";
import { runDataQuality } from "./data-quality.js";
import { BRANDS } from "./loader-shared.js";

let dataDir: string;
beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dq-cross-"));
});
afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

function put(rel: string, value: unknown) {
  const abs = path.join(dataDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, formatDataJson(value));
}

/** "entityId field: issue (value)" for issues whose text matches `pattern`. */
const issues = (pattern: RegExp) =>
  runDataQuality(dataDir)
    .filter((i) => pattern.test(i.issue))
    .map((i) => `${i.entityId} ${i.field}: ${i.issue}${i.value ? ` (${i.value})` : ""}`);

// A small consistent world the tests then break one reference at a time.
function world() {
  put("tablets/WACOM-tablets.json", {
    DrawingTablets: [
      {
        Meta: { EntityId: "wacom.tablet.pth660" },
        Model: { Brand: "WACOM", Id: "PTH-660", Family: "wacom.tabletfamily.wacomintuosprogen2" },
      },
    ],
  });
  put("tablet-families/WACOM-tablet-families.json", {
    TabletFamilies: [{ EntityId: "wacom.tabletfamily.wacomintuosprogen2" }],
  });
  put("pens/WACOM-pens.json", {
    Pens: [{ EntityId: "wacom.pen.kp504e", Brand: "WACOM", PenId: "KP-504E", PenFamily: "wacom.penfamily.wacom_kpgen2" }],
  });
  put("pen-families/WACOM-pen-families.json", { PenFamilies: [{ EntityId: "wacom.penfamily.wacom_kpgen2" }] });
  put("pen-compat/WACOM-pen-compat.json", { PenCompat: [{ Brand: "WACOM", PenId: "KP-504E", TabletIds: ["PTH-660"] }] });
}

describe("runInventoryDuplicateCheck", () => {
  const dup = /duplicate InventoryId/;

  it("flags an InventoryId used twice in one collection", () => {
    put("inventory/sevenpens-pens.json", {
      InventoryPens: [
        { InventoryId: "WAP.0075", PenEntityId: "wacom.pen.kp504e" },
        { InventoryId: "WAP.0075", PenEntityId: "wacom.pen.kp503e" },
      ],
    });
    expect(issues(dup)).toEqual([
      "WAP.0075 InventoryId: duplicate InventoryId (also in sevenpens-pens.json) (wacom.pen.kp503e)",
    ]);
  });

  it("exempts UNASSIGNED, and checks pens and tablets as separate namespaces", () => {
    put("inventory/sevenpens-pens.json", {
      InventoryPens: [
        { InventoryId: "UNASSIGNED", PenEntityId: "wacom.pen.kp504e" },
        { InventoryId: "UNASSIGNED", PenEntityId: "wacom.pen.kp503e" },
        { InventoryId: "X.0001", PenEntityId: "wacom.pen.kp504e" },
      ],
    });
    put("inventory/sevenpens-tablets.json", {
      InventoryTablets: [{ InventoryId: "X.0001", TabletEntityId: "wacom.tablet.pth660" }],
    });
    expect(issues(dup)).toEqual([]);
  });
});

describe("runCrossEntityChecks orphan references", () => {
  const orphan = /references unknown/;

  it("a consistent dataset has none", () => {
    world();
    expect(issues(orphan)).toEqual([]);
  });

  it("Model.Family and PenFamily must name a family", () => {
    world();
    fs.rmSync(path.join(dataDir, "tablet-families"), { recursive: true });
    fs.rmSync(path.join(dataDir, "pen-families"), { recursive: true });
    expect(issues(orphan)).toEqual([
      "wacom.tablet.pth660 Model.Family: references unknown TabletFamily (wacom.tabletfamily.wacomintuosprogen2)",
      "wacom.pen.kp504e PenFamily: references unknown PenFamily (wacom.penfamily.wacom_kpgen2)",
    ]);
  });

  it("pen-compat must name a real PenId and real tablet Model.Ids", () => {
    world();
    put("pen-compat/WACOM-pen-compat.json", {
      PenCompat: [{ Brand: "WACOM", PenId: "KP-503E", TabletIds: ["PTH-660", "PTH-651"] }],
    });
    expect(issues(orphan)).toEqual([
      "KP-503E PenId: pen-compat references unknown pen (KP-503E)",
      "KP-503E TabletIds: pen-compat references unknown tablet (PTH-651)",
    ]);
  });

  it("a pressure session must name a real pen, tablet and pen family", () => {
    world();
    put("pressure-response/WACOM-pressure-response.json", {
      PressureResponse: [
        {
          EntityId: "wacom.session.wap.0001_2024-09-02",
          Brand: "WACOM",
          InventoryId: "WAP.0001",
          Date: "2024-09-02",
          PenEntityId: "wacom.pen.nope",
          TabletEntityId: "wacom.tablet.nope",
          PenFamily: "wacom.penfamily.nope",
        },
      ],
    });
    expect(issues(orphan)).toEqual([
      "wacom.session.wap.0001_2024-09-02 PenEntityId: references unknown Pen (wacom.pen.nope)",
      "wacom.session.wap.0001_2024-09-02 TabletEntityId: references unknown Tablet (wacom.tablet.nope)",
      "wacom.session.wap.0001_2024-09-02 PenFamily: references unknown PenFamily (wacom.penfamily.nope)",
    ]);
  });
});

describe("runBrandDriftCheck", () => {
  const drift = /BRANDS \/ BrandEnum/;
  const brandsJson = (ids: readonly string[]) => put("brands/brands.json", { Brands: ids.map((BrandId) => ({ BrandId })) });

  it("is quiet when brands.json and BRANDS agree", () => {
    brandsJson(BRANDS);
    expect(issues(drift)).toEqual([]);
  });

  it("reports a brand on either side only", () => {
    brandsJson([...BRANDS.filter((b) => b !== "VEIKK"), "NEWCO"]);
    expect(issues(drift)).toEqual([
      "NEWCO BrandId: in brands.json but missing from BRANDS / BrandEnum (add to loader-shared.ts BRANDS and schemas.ts BrandEnum)",
      "VEIKK BrandId: in BRANDS / BrandEnum but missing from brands.json (add a Brands entry or remove from loader-shared.ts)",
    ]);
  });
});
