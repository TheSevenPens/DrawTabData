// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildDriverIndex, driverVersionKey, resolveDriver, UNRECORDED_DRIVERS } from "./driver-lookup.js";

const drivers = [
  { EntityId: "wacom.driver.6.3.46.2_windows", Brand: "WACOM", DriverVersion: "6.3.46.2", OSFamily: "WINDOWS" },
  { EntityId: "wacom.driver.6.2.0w5_windows", Brand: "WACOM", DriverVersion: "6.2.0w5", OSFamily: "WINDOWS" },
  { EntityId: "wacom.driver.5.3.7-6_macos", Brand: "WACOM", DriverVersion: "5.3.7-6", OSFamily: "MACOS" },
];
const index = buildDriverIndex(drivers);

it("requires removing exemptions once the real dataset supplies that driver", () => {
  const actual = JSON.parse(readFileSync(new URL("../data/drivers/WACOM-drivers.json", import.meta.url), "utf8"));
  const realIndex = buildDriverIndex(actual.Drivers);
  for (const key of UNRECORDED_DRIVERS) {
    const [platform, version] = key.split("|");
    expect(resolveDriver(realIndex, "WACOM", platform as "MACOS", version), `Remove stale exemption ${key}`).toBeUndefined();
  }
});

describe("driverVersionKey", () => {
  it("treats - and . before the build number as the same", () => {
    expect(driverVersionKey("6.3.46-2")).toBe(driverVersionKey("6.3.46.2"));
    expect(driverVersionKey(" 6.4.10.3 ")).toBe("6.4.10-3");
  });

  it("leaves the rest of the version alone", () => {
    expect(driverVersionKey("6.3.46-2")).not.toBe(driverVersionKey("6.3.4-62"));
  });
});

describe("resolveDriver", () => {
  it("matches exactly, or across the build-number separator", () => {
    expect(resolveDriver(index, "WACOM", "MACOS", "5.3.7-6")).toBe("wacom.driver.5.3.7-6_macos");
    expect(resolveDriver(index, "WACOM", "WINDOWS", "6.3.46-2")).toBe("wacom.driver.6.3.46.2_windows");
    expect(resolveDriver(index, "WACOM", "WINDOWS", "6.2.0w5")).toBe("wacom.driver.6.2.0w5_windows");
  });

  it("respects platform and brand", () => {
    expect(resolveDriver(index, "WACOM", "MACOS", "6.3.46-2")).toBeUndefined();
    expect(resolveDriver(index, "HUION", "WINDOWS", "6.3.46-2")).toBeUndefined();
  });

  it("the unrecorded macOS builds really are unresolvable here", () => {
    for (const key of UNRECORDED_DRIVERS) {
      const [platform, version] = key.split("|");
      expect(resolveDriver(index, "WACOM", platform as "MACOS", version)).toBeUndefined();
    }
  });
});
