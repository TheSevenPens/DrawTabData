import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { TABLET_FIELDS, TABLET_FIELD_GROUPS } from "./tablet-fields.js";
import { TabletSchema } from "../schemas.js";
import type { Tablet } from "../drawtab-loader.js";

const field = (key: string) => TABLET_FIELDS.find((f) => f.key === key)!;

const base = {
  Meta: {
    EntityId: "xppen.tablet.test",
    _id: "8ab0e087-96ce-41cd-aaae-95e09aec20be",
    _CreateDate: "2025-12-12T12:33:46.983Z",
    _ModifiedDate: "2025-12-12T12:33:46.983Z",
  },
  Model: { Brand: "XPPEN", Id: "TEST", Name: "Test", Type: "PENDISPLAY", ReleaseYear: "2025" },
};

describe("Power group", () => {
  it("is allowed on any tablet type and read by the Power fields", () => {
    const t = { ...base, Power: { InputVoltage: "12", InputCurrent: "1.5", ConsumptionWatts: "10", OutputWatts: "65" } };
    expect(v.safeParse(TabletSchema, t).success).toBe(true);
    const pentablet = { ...t, Model: { ...base.Model, Type: "PENTABLET" } };
    expect(v.safeParse(TabletSchema, pentablet).success).toBe(true);
    const tablet = t as unknown as Tablet;
    expect(field("PowerInputVoltage").getValue(tablet)).toBe("12");
    expect(field("PowerInputCurrent").getValue(tablet)).toBe("1.5");
    expect(field("PowerConsumptionWatts").getValue(tablet)).toBe("10");
    expect(field("PowerOutputWatts").getValue(tablet)).toBe("65");
    expect(field("PowerAdapterWatts").getValue(tablet)).toBe("");
    expect(TABLET_FIELDS.filter((f) => f.key.startsWith("Power")).every((f) => f.group === "Power")).toBe(true);
    expect(TABLET_FIELD_GROUPS).toContain("Power");
  });

  it("rejects non-numeric values and unknown keys", () => {
    expect(v.safeParse(TabletSchema, { ...base, Power: { InputWatts: "18W" } }).success).toBe(false);
    expect(v.safeParse(TabletSchema, { ...base, Power: { Watts: "18" } }).success).toBe(false);
  });
});
