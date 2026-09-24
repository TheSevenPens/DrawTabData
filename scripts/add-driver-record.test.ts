import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { insertDriverRecords, main, type DriverRecord } from "./add-driver-record.js";
import { formatDataJson } from "../lib/data-json.js";

function driver(version: string, os: "WINDOWS" | "MACOS", releaseDate = ""): DriverRecord {
  return {
    DriverVersion: version,
    OSFamily: os,
    ReleaseDate: releaseDate,
    DriverURLWacom: `https://cdn.wacom.com/u/productsupport/drivers/win/professional/WacomTablet_${version}.exe`,
    DriverURLArchiveDotOrg: "",
    ReleaseNotesURL: "",
    DriverUID: `${version}_${os}`,
    Brand: "WACOM",
    EntityId: `wacom.driver.${version}_${os}`.toLowerCase(),
    _id: "9d5e9b18-5e9c-4c22-929e-2bda35d60d5f",
    _CreateDate: "2026-04-01T08:52:45.000Z",
    _ModifiedDate: "2026-04-01T08:52:45.000Z",
  };
}

const existing = [
  driver("6.4.12-3", "WINDOWS", "2026-01-06"),
  driver("6.4.12-3", "MACOS", "2026-01-06"),
  driver("4.95-6", "WINDOWS"),
];

describe("insertDriverRecords", () => {
  it("inserts after the last entry matching the version prefix", () => {
    const added = [driver("6.4.13-1", "WINDOWS"), driver("6.4.13-1", "MACOS")];
    const out = insertDriverRecords(existing, added, "6.4.");
    expect(out.map((d) => d.DriverUID)).toEqual([
      "6.4.12-3_WINDOWS",
      "6.4.12-3_MACOS",
      "6.4.13-1_WINDOWS",
      "6.4.13-1_MACOS",
      "4.95-6_WINDOWS",
    ]);
    expect(existing).toHaveLength(3); // input not mutated
  });

  it("appends when no prefix is given", () => {
    const out = insertDriverRecords(existing, [driver("7.0.0-1", "MACOS")]);
    expect(out.at(-1)?.DriverUID).toBe("7.0.0-1_MACOS");
  });

  it("rejects a DriverUID or EntityId that already exists", () => {
    expect(() => insertDriverRecords(existing, [driver("6.4.12-3", "MACOS")], "6.4.")).toThrow(
      /Duplicate entries already exist: 6.4.12-3_MACOS/,
    );
    const sameEid = { ...driver("9.9", "MACOS"), EntityId: existing[0].EntityId };
    expect(() => insertDriverRecords(existing, [sameEid])).toThrow(/Duplicate/);
  });

  it("rejects duplicates within the new records", () => {
    const d = driver("6.4.13-1", "WINDOWS");
    expect(() => insertDriverRecords(existing, [d, d])).toThrow(/Duplicate/);
  });

  it("fails when the prefix anchors nothing", () => {
    expect(() => insertDriverRecords(existing, [driver("8.0.0-1", "MACOS")], "8.0.")).toThrow(/anchor/);
  });
});

describe("main", () => {
  let dir: string;
  const driversFile = () => path.join(dir, "drivers", "WACOM-drivers.json");

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "add-driver-record-"));
    fs.mkdirSync(path.join(dir, "drivers"));
    fs.writeFileSync(driversFile(), formatDataJson({ Drivers: existing }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("writes the file in canonical form with the records in place", () => {
    const added = [driver("6.4.13-1", "WINDOWS", "2026-06-15")];
    const recordsFile = path.join(dir, "records.json");
    // A single object (not an array), with a BOM as Windows PowerShell 5.1 might write.
    fs.writeFileSync(recordsFile, "﻿" + JSON.stringify(added[0]));
    expect(main([recordsFile, "--after-version-prefix", "6.4.", "--data-dir", dir])).toBe(0);
    expect(fs.readFileSync(driversFile(), "utf8")).toBe(
      formatDataJson({ Drivers: [existing[0], existing[1], added[0], existing[2]] }),
    );
  });

  it("leaves the file untouched on a duplicate or an invalid record", () => {
    const before = fs.readFileSync(driversFile(), "utf8");
    const recordsFile = path.join(dir, "records.json");
    fs.writeFileSync(recordsFile, JSON.stringify([existing[0]]));
    expect(main([recordsFile, "--data-dir", dir])).toBe(1);
    fs.writeFileSync(recordsFile, JSON.stringify([{ ...driver("7.0", "MACOS"), _id: "nope" }]));
    expect(main([recordsFile, "--data-dir", dir])).toBe(1);
    expect(fs.readFileSync(driversFile(), "utf8")).toBe(before);
  });
});
