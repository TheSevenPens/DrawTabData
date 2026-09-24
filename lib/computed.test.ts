// Computed FieldDef values are owned by the DrawTabDataSet (#346): each
// collection loads what it needs and attaches the results to its rows, so
// no app-level setup (the old set*() hooks) is required.

import { describe, expect, it, beforeAll } from "vitest";
import * as path from "path";
import * as url from "url";
import { createDiskDataSet } from "./dataset-node.js";
import type { DrawTabDataSet } from "./dataset.js";
import { attachComputed, computedOf } from "./computed.js";
import { PEN_FIELDS } from "./entities/pen-fields.js";
import { TABLET_FIELDS } from "./entities/tablet-fields.js";
import { PEN_FAMILY_FIELDS } from "./entities/pen-family-fields.js";
import { PRESSURE_RESPONSE_FIELDS } from "./entities/pressure-response-fields.js";

const dataDir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "data");
const field = (fields: readonly { key: string }[], key: string) =>
  fields.find((f) => f.key === key) as { getValue: (r: unknown) => unknown };

let ds: DrawTabDataSet;
beforeAll(() => {
  ds = createDiskDataSet({ dataDir, userId: "sevenpens" });
});

describe("computed values match their source collections", () => {
  it("Pen.UnitsInInventory and Pen.PressureSessionCount", async () => {
    const [pens, units, sessions] = await Promise.all([
      ds.Pens.toArray(),
      ds.InventoryPens.toArray(),
      ds.PressureResponse.toArray(),
    ]);
    const owned = pens.find((p) => units.some((u) => u.PenEntityId === p.EntityId))!;
    expect(owned).toBeDefined();
    expect(field(PEN_FIELDS, "UnitsInInventory").getValue(owned)).toBe(
      String(units.filter((u) => u.PenEntityId === owned.EntityId).length),
    );
    const measured = pens.find((p) => sessions.some((s) => s.PenEntityId === p.EntityId))!;
    expect(field(PEN_FIELDS, "PressureSessionCount").getValue(measured)).toBe(
      String(sessions.filter((s) => s.PenEntityId === measured.EntityId).length),
    );
  });

  it("Tablet.UnitsInInventory", async () => {
    const [tablets, units] = await Promise.all([ds.Tablets.toArray(), ds.InventoryTablets.toArray()]);
    const owned = tablets.find((t) => units.some((u) => u.TabletEntityId === t.Meta.EntityId))!;
    expect(field(TABLET_FIELDS, "UnitsInInventory").getValue(owned)).toBe(
      String(units.filter((u) => u.TabletEntityId === owned.Meta.EntityId).length),
    );
  });

  it("PenFamily.PenCount / ModelIds — no /pen-families page setup needed", async () => {
    const [families, pens] = await Promise.all([ds.PenFamilies.toArray(), ds.Pens.toArray()]);
    for (const f of families) {
      const members = pens.filter((p) => p.PenFamily === f.EntityId);
      expect(field(PEN_FAMILY_FIELDS, "PenCount").getValue(f)).toBe(String(members.length));
      expect(field(PEN_FAMILY_FIELDS, "ModelIds").getValue(f)).toBe(
        members.map((p) => p.PenId).sort((a, b) => a.localeCompare(b)).join(", "),
      );
    }
  });

  it("PressureResponse.IsDefective follows the inventory unit's defects", async () => {
    const [sessions, units] = await Promise.all([ds.PressureResponse.toArray(), ds.InventoryPens.toArray()]);
    const defective = new Set(units.filter((u) => (u.Defects?.length ?? 0) > 0).map((u) => u.InventoryId));
    const isDefective = field(PRESSURE_RESPONSE_FIELDS, "IsDefective");
    for (const s of sessions) {
      expect(isDefective.getValue(s)).toBe(defective.has(s.InventoryId) ? "YES" : "NO");
    }
    expect(sessions.some((s) => defective.has(s.InventoryId))).toBe(true);
  });

  it("a filter on a computed field works through the query engine", async () => {
    const owned = await ds.Pens.filter("UnitsInInventory", ">", "0").count();
    expect(owned).toBeGreaterThan(0);
  });
});

describe("without a userId", () => {
  it("loads Pens and Tablets with 0 inventory instead of failing", async () => {
    const anon = createDiskDataSet({ dataDir });
    const pens = await anon.Pens.toArray();
    expect(pens.length).toBeGreaterThan(0);
    expect(pens.every((p) => computedOf(p).UnitsInInventory === 0)).toBe(true);
    expect(await anon.Tablets.count()).toBeGreaterThan(0);
  });
});

describe("the Symbol-keyed storage", () => {
  it("survives a spread copy (queriton derive / join) but not JSON or Object.keys", () => {
    const row = attachComputed({ EntityId: "x" }, { UnitsInInventory: 3 });
    expect(computedOf({ ...row }).UnitsInInventory).toBe(3);
    expect(JSON.stringify(row)).toBe('{"EntityId":"x"}');
    expect(Object.keys(row)).toEqual(["EntityId"]);
  });

  it("a row that didn't come from a dataset reads empty values", () => {
    expect(computedOf({ EntityId: "x" })).toEqual({});
    expect(field(PEN_FIELDS, "UnitsInInventory").getValue({ EntityId: "x" })).toBe("0");
  });
});
