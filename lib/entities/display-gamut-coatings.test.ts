import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { TABLET_FIELDS } from "./tablet-fields.js";
import { TabletSchema } from "../schemas.js";
import type { Tablet } from "../drawtab-loader.js";

const field = (key: string) => TABLET_FIELDS.find((f) => f.key === key)!;

const base = {
  Meta: {
    EntityId: "huion.tablet.test",
    _id: "8ab0e087-96ce-41cd-aaae-95e09aec20be",
    _CreateDate: "2025-12-12T12:33:46.983Z",
    _ModifiedDate: "2025-12-12T12:33:46.983Z",
  },
  Model: { Brand: "HUION", Id: "TEST", Name: "Test", Type: "PENDISPLAY", ReleaseYear: "2025" },
};

describe("Display gamut coverage and area", () => {
  it("keeps coverage at or under 100% and area ratios in ColorGamutAreas", () => {
    const t = { ...base, Display: { ColorGamuts: { SRGB: 99, REC709: 99 }, ColorGamutAreas: { SRGB: 120 } } };
    expect(v.safeParse(TabletSchema, t).success).toBe(true);
    const tablet = t as unknown as Tablet;
    expect(field("DisplayGamutSRGB").getValue(tablet)).toBe("99");
    expect(field("DisplayGamutAreaSRGB").getValue(tablet)).toBe("120");
    expect(field("DisplayColorGamuts").getValue(tablet)).toBe("sRGB 99% · Rec. 709 99%");
    expect(field("DisplayColorGamutAreas").getValue(tablet)).toBe("sRGB 120%");
  });

  it("rejects coverage above 100%", () => {
    expect(v.safeParse(TabletSchema, { ...base, Display: { ColorGamuts: { SRGB: 120 } } }).success).toBe(false);
  });
});

describe("Display coatings", () => {
  it("records anti-fingerprint and anti-reflection next to the anti-glare type", () => {
    const t = { ...base, Display: { AntiGlare: "ETCHEDGLASS", AntiFingerprint: "YES", AntiReflection: "NO" } };
    expect(v.safeParse(TabletSchema, t).success).toBe(true);
    expect(field("DisplayAntiFingerprint").getValue(t as unknown as Tablet)).toBe("YES");
    expect(field("DisplayAntiReflection").getValue(t as unknown as Tablet)).toBe("NO");
    expect(v.safeParse(TabletSchema, { ...base, Display: { AntiFingerprint: "AF" } }).success).toBe(false);
  });
});
