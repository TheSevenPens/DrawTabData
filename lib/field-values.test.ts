// getValue is what queries, filters and sorts see, so it must be the stored
// value — never a display label, and never something that changes when a UI
// lookup is initialised. Display text belongs in getDisplayValue.
// (TheSevenPens/DrawTabDataExplorer#332)

import { describe, expect, it, beforeAll } from "vitest";
import * as path from "path";
import * as url from "url";
import type { AnyFieldDef } from "@thesevenpens/queriton";
import { createDiskDataSet } from "./dataset-node.js";
import type { DrawTabDataSet } from "./dataset.js";
import { BRAND_FIELDS } from "./entities/brand-fields.js";
import { TABLET_FIELDS } from "./entities/tablet-fields.js";
import { TABLET_FAMILY_FIELDS } from "./entities/tablet-family-fields.js";
import { PEN_FIELDS } from "./entities/pen-fields.js";
import { PEN_FAMILY_FIELDS } from "./entities/pen-family-fields.js";
import { DRIVER_FIELDS } from "./entities/driver-fields.js";
import { PEN_COMPAT_FIELDS } from "./entities/pen-compat-fields.js";
import { PRESSURE_RESPONSE_FIELDS } from "./entities/pressure-response-fields.js";
import { PRESSURE_RANGE_FIELDS } from "./entities/pressure-range-fields.js";
import { INVENTORY_PEN_FIELDS } from "./entities/inventory-pen-fields.js";
import { INVENTORY_TABLET_FIELDS } from "./entities/inventory-tablet-fields.js";

const dataDir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "data");

let ds: DrawTabDataSet;
beforeAll(() => {
  ds = createDiskDataSet({ dataDir, userId: "sevenpens" });
});

const COLLECTIONS: [string, readonly unknown[]][] = [
  ["Brands", BRAND_FIELDS],
  ["Tablets", TABLET_FIELDS],
  ["TabletFamilies", TABLET_FAMILY_FIELDS],
  ["Pens", PEN_FIELDS],
  ["PenFamilies", PEN_FAMILY_FIELDS],
  ["Drivers", DRIVER_FIELDS],
  ["PenCompat", PEN_COMPAT_FIELDS],
  ["PressureResponse", PRESSURE_RESPONSE_FIELDS],
  ["PressureRange", PRESSURE_RANGE_FIELDS],
  ["InventoryPens", INVENTORY_PEN_FIELDS],
  ["InventoryTablets", INVENTORY_TABLET_FIELDS],
];

describe("enum fields: getValue returns one of the field's own enumValues", () => {
  for (const [collection, fields] of COLLECTIONS) {
    const enums = (fields as AnyFieldDef[]).filter((f) => f.type === "enum" && f.enumValues);
    if (enums.length === 0) continue;
    it(collection, async () => {
      const rows = await ds.get(collection).toArray();
      const offenders: string[] = [];
      for (const f of enums) {
        const allowed = new Set(f.enumValues);
        const bad = new Set<string>();
        for (const row of rows) {
          const v = f.getValue(row);
          // "-" is the codebase-wide "not applicable" placeholder (display
          // fields on pen tablets); the UI already treats it as empty.
          if (v == null || v === "" || v === "-") continue;
          if (!allowed.has(String(v))) bad.add(String(v));
        }
        if (bad.size) offenders.push(`${f.key}: ${[...bad].slice(0, 5).join(", ")}`);
      }
      expect(offenders).toEqual([]);
    });
  }
});

describe("pen fields: queries don't depend on display lookups", () => {
  it("Brand filters by code", async () => {
    const wacom = await ds.Pens.filter("Brand", "==", "WACOM").count();
    expect(wacom).toBeGreaterThan(0);
    expect(await ds.Pens.filter("Brand", "==", "Wacom").count()).toBe(0);
  });

  it("PenFamily filters by EntityId; the name is display-only", async () => {
    const id = "apple.penfamily.applepencil";
    const pens = await ds.Pens.filter("PenFamily", "==", id).toArray();
    expect(pens.length).toBeGreaterThan(0);
    const field = PEN_FIELDS.find((f) => f.key === "PenFamily")!;
    expect(field.getValue(pens[0])).toBe(id);
    expect(field.getDisplayValue?.(pens[0])).toBe("Apple Pencil pen series");
  });
});
