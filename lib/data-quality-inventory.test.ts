// Inventory rows must point at real models, with the tablet's own Model.Id,
// and a pen unit's WithTabletInventoryId at a real tablet unit
// (DrawTabData #44).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatDataJson } from "./data-json.js";
import { runDataQuality } from "./data-quality.js";

let dataDir: string;
beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dq-inventory-"));
  put("tablets/WACOM-tablets.json", {
    DrawingTablets: [{ Meta: { EntityId: "wacom.tablet.dtk168" }, Model: { Brand: "WACOM", Id: "DTK-168" } }],
  });
  put("pens/WACOM-pens.json", { Pens: [{ EntityId: "wacom.pen.kp504e", Brand: "WACOM", PenId: "KP-504E" }] });
});
afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

function put(rel: string, value: unknown) {
  const abs = path.join(dataDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, formatDataJson(value));
}

const INVENTORY_FIELDS = new Set(["TabletEntityId", "ModelId", "PenEntityId", "WithTabletInventoryId"]);
function inventoryIssues(tablets: object[], pens: object[] = []) {
  put("inventory/sevenpens-tablets.json", { InventoryTablets: tablets });
  put("inventory/sevenpens-pens.json", { InventoryPens: pens });
  return runDataQuality(dataDir)
    .filter((i) => i.file.startsWith("sevenpens-") && INVENTORY_FIELDS.has(i.field))
    .map((i) => `${i.entityId} ${i.field}: ${i.issue}${i.value ? ` (${i.value})` : ""}`);
}

const unit = { InventoryId: "WAT.0084", TabletEntityId: "wacom.tablet.dtk168", ModelId: "DTK-168" };

describe("inventory reference checks", () => {
  it("accepts rows that point at real models and units", () => {
    expect(
      inventoryIssues([unit], [{ InventoryId: "WAP.0001", PenEntityId: "wacom.pen.kp504e", WithTabletInventoryId: "WAT.0084" }]),
    ).toEqual([]);
  });

  it("reports a tablet unit whose TabletEntityId names no tablet", () => {
    expect(inventoryIssues([{ ...unit, TabletEntityId: "wacom.tablet.ptk851" }])).toEqual([
      "WAT.0084 TabletEntityId: references unknown Tablet (wacom.tablet.ptk851)",
    ]);
  });

  it("reports a ModelId that isn't the tablet's Model.Id — a name or other punctuation", () => {
    expect(inventoryIssues([{ ...unit, ModelId: "DTK168" }])).toEqual([
      'WAT.0084 ModelId: is not the tablet\'s Model.Id (got "DTK168", wacom.tablet.dtk168 has "DTK-168")',
    ]);
  });

  it("reports a pen unit with an unknown pen or tablet unit", () => {
    expect(
      inventoryIssues([unit], [{ InventoryId: "WAP.0001", PenEntityId: "wacom.pen.nope", WithTabletInventoryId: "WAT.9999" }]),
    ).toEqual([
      "WAP.0001 PenEntityId: references unknown Pen (wacom.pen.nope)",
      "WAP.0001 WithTabletInventoryId: references unknown tablet inventory unit (WAT.9999)",
    ]);
  });
});
