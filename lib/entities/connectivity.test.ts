import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { formatConnectors, TABLET_FIELDS } from "./tablet-fields.js";
import { PORT_TYPES, PORT_TYPE_LABELS, TabletSchema } from "../schemas.js";
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

describe("formatConnectors", () => {
  it("labels one entry per port, with Detail in parentheses", () => {
    expect(formatConnectors([{ Type: "USB_C" }, { Type: "USB_C" }, { Type: "HDMI" }])).toBe("USB-C, USB-C, HDMI");
    expect(formatConnectors([{ Type: "USB_C", Detail: "Thunderbolt 4" }])).toBe("USB-C (Thunderbolt 4)");
    expect(formatConnectors(["USB_A", "HDMI"])).toBe("USB-A, HDMI");
  });

  it("distinguishes explicitly none from unknown", () => {
    expect(formatConnectors([])).toBe("None");
    expect(formatConnectors(undefined)).toBe("");
  });

  it("has a label for every port type", () => {
    for (const t of PORT_TYPES) expect(PORT_TYPE_LABELS[t]).toBeTruthy();
  });
});

describe("Connectivity group", () => {
  it("is allowed on a PENTABLET and read by the Connectivity fields", () => {
    const t = { ...base, Connectivity: { Ports: [{ Type: "USB_C" }], AttachedCable: [], Bluetooth: "YES", BluetoothVersion: "5.1" } };
    expect(v.safeParse(TabletSchema, t).success).toBe(true);
    const tablet = t as unknown as Tablet;
    expect(field("ConnectivityPorts").getValue(tablet)).toBe("USB-C");
    expect(field("ConnectivityAttachedCable").getValue(tablet)).toBe("None");
    expect(field("ConnectivityBluetooth").getValue(tablet)).toBe("YES");
    expect(field("ConnectivityBluetoothVersion").getValue(tablet)).toBe("5.1");
    expect(field("ConnectivityWifi").getValue(tablet)).toBe("");
    expect(TABLET_FIELDS.filter((f) => f.key.startsWith("Connectivity")).every((f) => f.group === "Connectivity")).toBe(true);
  });

  it("rejects unknown port types, non-numeric versions and the old Standalone fields", () => {
    expect(v.safeParse(TabletSchema, { ...base, Connectivity: { Ports: [{ Type: "USB-C" }] } }).success).toBe(false);
    expect(v.safeParse(TabletSchema, { ...base, Connectivity: { BluetoothVersion: "five" } }).success).toBe(false);
    const standalone = { ...base, Model: { ...base.Model, Type: "STANDALONE" } };
    expect(v.safeParse(TabletSchema, { ...standalone, Standalone: { USB: "USB-C" } }).success).toBe(false);
  });
});
