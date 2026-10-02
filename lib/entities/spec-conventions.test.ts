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
  Model: { Brand: "HUION", Id: "TEST", Name: "Test", Type: "PENTABLET", ReleaseYear: "2025" },
};

describe("spec conventions (#54)", () => {
  it("stores a depth range as DepthMin and Depth (max) on the body only", () => {
    const t = { ...base, Physical: { Dimensions: { Width: 546, Height: 323, Depth: 26.7, DepthMin: 19 } } };
    expect(v.safeParse(TabletSchema, t).success).toBe(true);
    expect(field("PhysicalDimensions").getValue(t as unknown as Tablet)).toBe("546 x 323 x 19-26.7");
    expect(v.safeParse(TabletSchema, { ...base, Digitizer: { Dimensions: { Width: 1, Height: 1, DepthMin: 1 } } }).success).toBe(false);
  });

  it("keeps a separate Bluetooth report rate", () => {
    const t = { ...base, Digitizer: { ReportRate: "300", ReportRateBluetooth: "133" } };
    expect(v.safeParse(TabletSchema, t).success).toBe(true);
    expect(field("DigitizerReportRateBluetooth").getValue(t as unknown as Tablet)).toBe("133");
  });

  it("counts multimedia keys and scrollers apart from programmable buttons", () => {
    const t = { ...base, OtherInputs: { Buttons: "10", MultimediaKeys: "8", Scrollers: "1" } };
    expect(v.safeParse(TabletSchema, t).success).toBe(true);
    expect(field("OtherInputsMultimediaKeys").getValue(t as unknown as Tablet)).toBe("8");
    expect(field("OtherInputsScrollers").getValue(t as unknown as Tablet)).toBe("1");
  });
});
