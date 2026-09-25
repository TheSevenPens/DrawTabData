// Model.IncludedPen must name a real pen, and a tablet can't ship a pen
// introduced after it (#312).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatDataJson } from "./data-json.js";
import { runDataQuality } from "./data-quality.js";

let dataDir: string;
beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dq-includedpen-"));
});
afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

const put = (rel: string, value: unknown) => {
  const abs = path.join(dataDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, formatDataJson(value));
};

const tablet = (model: Record<string, unknown>) => ({
  Meta: { EntityId: "wacom.tablet.t1" },
  Model: { Brand: "WACOM", Id: "T1", ...model },
});

function includedPenIssues(tablets: unknown[], penYear: string | null = "2016") {
  put("tablets/WACOM-tablets.json", { DrawingTablets: tablets });
  put("pens/WACOM-pens.json", {
    Pens: [{ EntityId: "wacom.pen.kp504e", Brand: "WACOM", PenId: "KP-504E", ...(penYear ? { ReleaseYear: penYear } : {}) }],
  });
  return runDataQuality(dataDir)
    .filter((i) => i.field === "Model.IncludedPen")
    .map((i) => `${i.issue}${i.value ? `: ${i.value}` : ""}`);
}

describe("IncludedPen checks", () => {
  it("accepts a tablet the same year as, or newer than, its pen", () => {
    expect(includedPenIssues([tablet({ ReleaseYear: "2016", IncludedPen: ["wacom.pen.kp504e"] })])).toEqual([]);
    expect(includedPenIssues([tablet({ ReleaseYear: "2019", IncludedPen: ["wacom.pen.kp504e"] })])).toEqual([]);
  });

  it("reports a tablet older than a pen it ships", () => {
    expect(includedPenIssues([tablet({ ReleaseYear: "2015", IncludedPen: ["wacom.pen.kp504e"] })])).toEqual([
      "ships a pen introduced later than the tablet: tablet 2015 vs wacom.pen.kp504e 2016",
    ]);
  });

  it("ReleaseDate outranks ReleaseYear — the same year the Age fields use", () => {
    const t = tablet({ ReleaseYear: "2016", ReleaseDate: "2015-11-02", IncludedPen: ["wacom.pen.kp504e"] });
    expect(includedPenIssues([t])).toEqual([
      "ships a pen introduced later than the tablet: tablet 2015 vs wacom.pen.kp504e 2016",
    ]);
  });

  it("skips a pen without a year", () => {
    expect(includedPenIssues([tablet({ ReleaseYear: "2010", IncludedPen: ["wacom.pen.kp504e"] })], null)).toEqual([]);
  });

  it("reports an IncludedPen that names no pen", () => {
    expect(includedPenIssues([tablet({ ReleaseYear: "2016", IncludedPen: ["wacom.pen.nope"] })])).toEqual([
      "references unknown Pen: wacom.pen.nope",
    ]);
  });
});
