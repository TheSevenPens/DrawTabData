import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { TABLET_FIELDS } from "./tablet-fields.js";
import { TabletSchema } from "../schemas.js";
import type { Tablet } from "../drawtab-loader.js";

const field = (key: string) => TABLET_FIELDS.find((f) => f.key === key)!;

const base = {
  Meta: {
    EntityId: "wacom.tablet.test",
    _id: "8ab0e087-96ce-41cd-aaae-95e09aec20be",
    _CreateDate: "2025-12-12T12:33:46.983Z",
    _ModifiedDate: "2025-12-12T12:33:46.983Z",
  },
  Model: { Brand: "WACOM", Id: "TEST", Name: "Test", Type: "PENDISPLAY", ReleaseYear: "2020" },
};
const parses = (Physical: unknown) => v.safeParse(TabletSchema, { ...base, Physical }).success;

describe("Physical mounting fields", () => {
  it("accepts VESA, legs and stand values and reads them through the field defs", () => {
    const Physical = { VesaMount: "YES", VesaPattern: ["75x75", "100x100"], Legs: "YES", IncludedStand: "NO" };
    expect(parses(Physical)).toBe(true);
    const t = { ...base, Physical } as unknown as Tablet;
    expect(field("PhysicalVesaMount").getValue(t)).toBe("YES");
    expect(field("PhysicalVesaPattern").getValue(t)).toBe("75x75, 100x100");
    expect(field("PhysicalLegs").getValue(t)).toBe("YES");
    expect(field("PhysicalIncludedStand").getValue(t)).toBe("NO");
    expect(field("PhysicalVesaPattern").getValue(base as unknown as Tablet)).toBe("");
  });

  it("rejects a malformed VESA pattern or a bare string", () => {
    expect(parses({ VesaPattern: ["100 x 100"] })).toBe(false);
    expect(parses({ VesaPattern: ["100mm"] })).toBe(false);
    expect(parses({ VesaPattern: "100x100" })).toBe(false);
    expect(parses({ Legs: "maybe" })).toBe(false);
  });
});
