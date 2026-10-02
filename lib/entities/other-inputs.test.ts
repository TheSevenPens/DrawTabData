import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { OTHER_INPUTS_GROUP, TABLET_FIELDS, TABLET_FIELD_GROUPS } from "./tablet-fields.js";
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
  Model: { Brand: "WACOM", Id: "TEST", Name: "Test", Type: "PENTABLET", ReleaseYear: "2017" },
};

describe("OtherInputs group", () => {
  it("is allowed on a PENTABLET and read by the Other Inputs fields", () => {
    const t = { ...base, OtherInputs: { Buttons: "8", Dials: "0", TouchRings: "1", Touch: "YES" } };
    expect(v.safeParse(TabletSchema, t).success).toBe(true);
    const tablet = t as unknown as Tablet;
    expect(field("OtherInputsButtons").getValue(tablet)).toBe("8");
    expect(field("OtherInputsDials").getValue(tablet)).toBe("0");
    expect(field("OtherInputsTouchRings").getValue(tablet)).toBe("1");
    expect(field("OtherInputsTouchStrips").getValue(tablet)).toBe("");
    expect(field("OtherInputsTouch").getValue(tablet)).toBe("YES");
  });

  it("puts every OtherInputs field in the one named group, between Physical and Connectivity", () => {
    const keys = TABLET_FIELDS.filter((f) => f.group === OTHER_INPUTS_GROUP).map((f) => f.key);
    expect(keys).toEqual([
      "OtherInputsButtons",
      "OtherInputsDials",
      "OtherInputsMultimediaKeys",
      "OtherInputsScrollers",
      "OtherInputsSwitcherKeys",
      "OtherInputsTouchRings",
      "OtherInputsTouchStrips",
      "OtherInputsTouch",
    ]);
    const i = TABLET_FIELD_GROUPS.indexOf(OTHER_INPUTS_GROUP);
    expect(TABLET_FIELD_GROUPS[i - 1]).toBe("Physical");
    expect(TABLET_FIELD_GROUPS[i + 1]).toBe("Connectivity");
  });

  it("rejects non-numeric counts and the old Digitizer.SupportsTouch", () => {
    expect(v.safeParse(TabletSchema, { ...base, OtherInputs: { Buttons: "eight" } }).success).toBe(false);
    expect(v.safeParse(TabletSchema, { ...base, Digitizer: { SupportsTouch: "YES" } }).success).toBe(false);
    expect(TABLET_FIELDS.some((f) => f.key === "DigitizerSupportsTouch")).toBe(false);
  });
});
