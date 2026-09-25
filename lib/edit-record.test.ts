import { initSources, penFixture } from "../test/fixtures.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEdit, editRecord, parseAssignments, resolvePath } from "./edit-record.js";
import { PenSchema, TabletSchema } from "./schemas.js";
import { generateBundles } from "./sources.js";

const REAL = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TABLET = "source/tablets/wacom/wacom.tablet.pth660.json";
const PEN = "source/pens/wacom/wacom.pen.kp504e.json";
const NOW = "2026-09-25T00:00:00.000Z";

let root: string;
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "edit-record-"));
  initSources(root);
  for (const rel of [TABLET, PEN]) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.copyFileSync(path.join(REAL, rel), path.join(root, rel));
  }
  generateBundles(root, { write: true });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("parseAssignments", () => {
  it("= sets a string, := parses JSON, and values may contain =", () => {
    expect(parseAssignments(["Notes=a=b", "Model.IncludedPen:=[\"x\"]", "Weight:=15"], ["Tags"])).toEqual([
      { path: "Notes", kind: "set", value: "a=b" },
      { path: "Model.IncludedPen", kind: "set", value: ["x"] },
      { path: "Weight", kind: "set", value: 15 },
      { path: "Tags", kind: "unset" },
    ]);
  });

  it("rejects malformed input", () => {
    expect(() => parseAssignments(["Notes"])).toThrow(/Field=value/);
    expect(() => parseAssignments(["Tags:=[oops"])).toThrow(/must be JSON/);
  });
});

describe("resolvePath (against the schema, not the record)", () => {
  it("finds a nested tablet field and a pen field the record doesn't have yet", () => {
    expect(resolvePath(TabletSchema, "ReleaseYear")).toBe("Model.ReleaseYear");
    expect(resolvePath(TabletSchema, "Tilt")).toBe("Digitizer.Tilt");
    expect(resolvePath(PenSchema, "Tilt")).toBe("Tilt");
    expect(resolvePath(TabletSchema, "Physical.Dimensions.Width")).toBe("Physical.Dimensions.Width");
  });

  it("refuses ambiguous and unknown names", () => {
    expect(() => resolvePath(TabletSchema, "Dimensions")).toThrow(/ambiguous.*Digitizer\.Dimensions/);
    expect(() => resolvePath(PenSchema, "Colour")).toThrow(/isn't a field/);
  });
});

describe("applyEdit", () => {
  it("returns the changes and bumps _ModifiedDate, keeping a numeric field numeric", () => {
    const r = applyEdit(root, "wacom.tablet.pth660", parseAssignments(["Audience=Professional", "Physical.Dimensions.Width=339"]), NOW);
    expect(r.changes.map((c) => c.path)).toContain("Physical.Dimensions.Width");
    expect((r.record.Physical as { Dimensions: { Width: unknown } }).Dimensions.Width).toBe(339);
    expect((r.record.Meta as { _ModifiedDate: string })._ModifiedDate).toBe(NOW);
  });

  it("refuses identity fields", () => {
    expect(() => applyEdit(root, "wacom.pen.kp504e", parseAssignments(["PenId=KP-999"]))).toThrow(/identity/);
    expect(() => applyEdit(root, "wacom.tablet.pth660", parseAssignments(["Id=PTH-661"]))).toThrow(/identity/);
  });

  it("refuses a schema violation and a no-op, and only knows editable collections", () => {
    expect(() => applyEdit(root, "wacom.pen.kp504e", parseAssignments(["PenTech=LASER"]))).toThrow(/fails its schema/);
    const year = read(PEN).ReleaseYear;
    expect(() => applyEdit(root, "wacom.pen.kp504e", parseAssignments([`ReleaseYear=${year}`]))).toThrow(/nothing to change/);
    expect(() => applyEdit(root, "wacom.driver.6.4.7-2_macos", [])).toThrow(/only tablets, pens and pressure sessions/);
  });
});

describe("editRecord", () => {
  it("writes the source and regenerates its bundle", () => {
    const out = editRecord(root, "wacom.pen.kp504e", parseAssignments(["Notes=edited"]), { now: NOW });
    expect(out.written).toBe(true);
    expect(read(PEN).Notes).toBe("edited");
    const bundle = read("data/pens/WACOM-pens.json").Pens;
    expect(bundle[0].Notes).toBe("edited");
    expect(generateBundles(root, { write: false }).changed).toEqual([]);
  });

  it("--dry-run writes nothing", () => {
    const before = fs.readFileSync(path.join(root, PEN), "utf8");
    expect(editRecord(root, "wacom.pen.kp504e", parseAssignments(["Notes=x"]), { dryRun: true }).written).toBe(false);
    expect(fs.readFileSync(path.join(root, PEN), "utf8")).toBe(before);
  });

  it("reverts an edit that breaks another record — re-dating a pen after a tablet that ships it", () => {
    const before = fs.readFileSync(path.join(root, PEN), "utf8");
    const out = editRecord(root, "wacom.pen.kp504e", parseAssignments(["ReleaseYear=2030"]));
    expect(out.written).toBe(false);
    expect(out.newIssues.map((i) => `${i.entityId} ${i.issue}`)).toEqual([
      "wacom.tablet.pth660 ships a pen introduced later than the tablet",
    ]);
    expect(fs.readFileSync(path.join(root, PEN), "utf8")).toBe(before);
    expect(generateBundles(root, { write: false }).changed).toEqual([]);
  });

  it("--force keeps it", () => {
    expect(editRecord(root, "wacom.pen.kp504e", parseAssignments(["ReleaseYear=2030"]), { force: true }).written).toBe(true);
    expect(read(PEN).ReleaseYear).toBe("2030");
  });
});
