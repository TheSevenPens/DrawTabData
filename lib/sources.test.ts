import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { formatDataJson } from "./data-json.js";
import {
  buildBundles,
  compareEntityIds,
  generateBundles,
  readSources,
  sourceCollection,
  sourceDigest,
  sourcePath,
} from "./sources.js";

const tablets = sourceCollection("tablets");
const pens = sourceCollection("pens");

const tablet = (brand: string, id: string, extra: Record<string, unknown> = {}) => ({
  Meta: { EntityId: `${brand.toLowerCase()}.tablet.${id}`, _id: "x" },
  Model: { Brand: brand, Id: id.toUpperCase(), Name: `Tablet ${id}`, ...extra },
});
const pen = (brand: string, id: string) => ({ EntityId: `${brand.toLowerCase()}.pen.${id}`, Brand: brand, PenId: id });

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "sources-"));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function put(rel: string, value: unknown, text = formatDataJson(value)) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}
function putTablet(t: ReturnType<typeof tablet>) {
  put(sourcePath(tablets, t.Model.Brand, t.Meta.EntityId), t);
}
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

describe("compareEntityIds", () => {
  it("orders by code units, not locale", () => {
    expect(["b", "a_2", "a", "a-2", "B"].sort(compareEntityIds)).toEqual(["B", "a", "a-2", "a_2", "b"]);
  });
});

describe("buildBundles", () => {
  it("groups by brand, sorts by EntityId, restores the envelope", () => {
    putTablet(tablet("WACOM", "ptk1240"));
    putTablet(tablet("WACOM", "ctl4100"));
    putTablet(tablet("HUION", "q640m"));
    const { records, issues } = readSources(root, tablets);
    expect(issues).toEqual([]);
    const bundles = buildBundles(tablets, records);
    expect([...bundles.keys()]).toEqual(["data/tablets/HUION-tablets.json", "data/tablets/WACOM-tablets.json"]);
    const wacom = JSON.parse(bundles.get("data/tablets/WACOM-tablets.json")!);
    expect(wacom.DrawingTablets.map((t: { Meta: { EntityId: string } }) => t.Meta.EntityId)).toEqual([
      "wacom.tablet.ctl4100",
      "wacom.tablet.ptk1240",
    ]);
  });

  it("reassembles records exactly: key order, numeric strings, sparse fields, nested arrays", () => {
    const t = tablet("WACOM", "a1", { ReleaseYear: "2020", Links: [{ URL: "u2" }, { URL: "u1" }], Width: 12.0 });
    putTablet(t);
    const { records } = readSources(root, tablets);
    const text = buildBundles(tablets, records).get("data/tablets/WACOM-tablets.json")!;
    expect(text).toBe(formatDataJson({ DrawingTablets: [t] }));
    expect(Object.keys(JSON.parse(text).DrawingTablets[0].Model)).toEqual(Object.keys(t.Model));
  });

  it("uses the pen envelope for pens", () => {
    put(sourcePath(pens, "WACOM", "wacom.pen.kp503e"), pen("WACOM", "kp503e"));
    const { records } = readSources(root, pens);
    expect(JSON.parse(buildBundles(pens, records).get("data/pens/WACOM-pens.json")!)).toEqual({
      Pens: [pen("WACOM", "kp503e")],
    });
  });
});

describe("readSources diagnostics name the source file", () => {
  const problems = () => readSources(root, tablets).issues.map((i) => `${i.file}: ${i.problem}`);

  it("file name must equal the EntityId", () => {
    put("source/tablets/wacom/wrong.json", tablet("WACOM", "ctl4100"));
    expect(problems()).toContainEqual(expect.stringMatching(/wrong\.json: file name must equal the EntityId/));
  });

  it("record must sit in its brand's directory", () => {
    const t = tablet("HUION", "q640m");
    put(`source/tablets/wacom/${t.Meta.EntityId}.json`, t);
    expect(problems()).toContainEqual(expect.stringMatching(/belongs in tablets\/huion\//));
  });

  it("duplicate EntityIds are reported, case-insensitively", () => {
    // Two files that differ only in case would be ONE file on Windows or
    // macOS, so build the duplicates in ways every filesystem keeps apart:
    // the same record in a second directory, and an EntityId differing
    // only in case.
    putTablet(tablet("WACOM", "ctl4100"));
    put("source/tablets/huion/wacom.tablet.ctl4100.json", tablet("WACOM", "ctl4100"));
    const upper = tablet("WACOM", "b1");
    upper.Meta.EntityId = "WACOM.TABLET.CTL4100";
    put("source/tablets/wacom/wacom.tablet.b1.json", upper);
    const dups = problems().filter((p) => p.includes("duplicate EntityId"));
    expect(dups).toHaveLength(2);
  });

  it("duplicate JSON keys, invalid JSON, CRLF and non-canonical formatting", () => {
    const t = tablet("WACOM", "a1");
    put(sourcePath(tablets, "WACOM", t.Meta.EntityId), null, '{"Meta":{"EntityId":"x","EntityId":"y"}}');
    put("source/tablets/wacom/wacom.tablet.b1.json", null, "{");
    put("source/tablets/wacom/wacom.tablet.c1.json", null, formatDataJson(tablet("WACOM", "c1")).replace(/\n/g, "\r\n"));
    put("source/tablets/wacom/wacom.tablet.d1.json", null, JSON.stringify(tablet("WACOM", "d1")));
    const p = problems().join("\n");
    expect(p).toMatch(/a1\.json: duplicate-keys/);
    expect(p).toMatch(/b1\.json: invalid-json/);
    expect(p).toMatch(/c1\.json: crlf/);
    expect(p).toMatch(/d1\.json: not-canonical/);
  });

  it("a stray file directly under the collection is reported", () => {
    put("source/tablets/loose.json", tablet("WACOM", "x"));
    expect(problems()).toContainEqual(expect.stringMatching(/loose\.json: unexpected file/));
  });
});

describe("generateBundles", () => {
  beforeEach(() => {
    putTablet(tablet("WACOM", "ctl4100"));
    putTablet(tablet("HUION", "q640m"));
  });

  it("does nothing for collections without a source/ directory", () => {
    put("data/pens/WACOM-pens.json", { Pens: [] });
    const r = generateBundles(root, { write: false });
    expect(r.collections).toEqual(["tablets"]);
  });

  it("check mode reports missing bundles and writes nothing", () => {
    const r = generateBundles(root, { write: false });
    expect(r.missing).toEqual(["data/tablets/HUION-tablets.json", "data/tablets/WACOM-tablets.json"]);
    expect(fs.existsSync(path.join(root, "data"))).toBe(false);
  });

  it("write mode creates bundles; a second check is clean and a second write is a no-op", () => {
    generateBundles(root, { write: true });
    const before = read("data/tablets/WACOM-tablets.json");
    expect(generateBundles(root, { write: false })).toMatchObject({ changed: [], missing: [], extra: [] });
    generateBundles(root, { write: true });
    expect(read("data/tablets/WACOM-tablets.json")).toBe(before);
  });

  it("a stale committed bundle fails the check and is left untouched", () => {
    generateBundles(root, { write: true });
    const stale = read("data/tablets/WACOM-tablets.json").replace("Tablet ctl4100", "Hand-edited");
    put("data/tablets/WACOM-tablets.json", null, stale);
    const r = generateBundles(root, { write: false });
    expect(r.changed).toEqual(["data/tablets/WACOM-tablets.json"]);
    expect(read("data/tablets/WACOM-tablets.json")).toBe(stale);
  });

  it("deleting a brand's last source reports, then removes, the orphaned bundle", () => {
    generateBundles(root, { write: true });
    fs.rmSync(path.join(root, "source/tablets/huion"), { recursive: true });
    expect(generateBundles(root, { write: false }).extra).toEqual(["data/tablets/HUION-tablets.json"]);
    generateBundles(root, { write: true });
    expect(fs.existsSync(path.join(root, "data/tablets/HUION-tablets.json"))).toBe(false);
  });

  it("refuses to write anything while a source has problems", () => {
    put("source/tablets/wacom/bad.json", null, "{");
    const r = generateBundles(root, { write: true });
    expect(r.sourceIssues.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(root, "data"))).toBe(false);
  });
});

describe("sourceDigest", () => {
  it("is null without sources, stable, and changes with content or file set", () => {
    expect(sourceDigest(root)).toBeNull();
    putTablet(tablet("WACOM", "a1"));
    const d1 = sourceDigest(root);
    expect(d1).toMatch(/^[0-9a-f]{64}$/);
    expect(sourceDigest(root)).toBe(d1);
    putTablet(tablet("WACOM", "a1", { Name: "renamed" }));
    const d2 = sourceDigest(root);
    expect(d2).not.toBe(d1);
    putTablet(tablet("WACOM", "b1"));
    expect(sourceDigest(root)).not.toBe(d2);
  });

  it("ignores CRLF vs LF, so it's the same on every platform", () => {
    const t = tablet("WACOM", "a1");
    putTablet(t);
    const lf = sourceDigest(root);
    put(sourcePath(tablets, "WACOM", t.Meta.EntityId), null, formatDataJson(t).replace(/\n/g, "\r\n"));
    expect(sourceDigest(root)).toBe(lf);
  });

  it("does not change when files outside source/ change (a docs-only commit)", () => {
    putTablet(tablet("WACOM", "a1"));
    const d = sourceDigest(root);
    put("docs/README.json", { any: 1 });
    expect(sourceDigest(root)).toBe(d);
  });
});

describe("editing helpers", () => {
  it("write → read → regenerate round-trips one record", async () => {
    const { writeSourceRecord, readSourceRecord, regenerate, sourcePathForEntityId } = await import("./sources.js");
    const t = tablet("WACOM", "ctl4100");
    expect(writeSourceRecord(root, tablets, t)).toBe("source/tablets/wacom/wacom.tablet.ctl4100.json");
    expect(sourcePathForEntityId(tablets, "wacom.tablet.ctl4100")).toBe("source/tablets/wacom/wacom.tablet.ctl4100.json");
    expect(readSourceRecord(root, tablets, "wacom.tablet.ctl4100")).toEqual(t);
    expect(readSourceRecord(root, tablets, "wacom.tablet.nope")).toBeUndefined();
    expect(regenerate(root)).toEqual(["data/tablets/WACOM-tablets.json"]);
    expect(regenerate(root)).toEqual([]);
  });

  it("writeSourceRecord refuses a record without EntityId or Brand", async () => {
    const { writeSourceRecord } = await import("./sources.js");
    expect(() => writeSourceRecord(root, pens, { Brand: "WACOM" })).toThrow(/no EntityId/);
    expect(() => writeSourceRecord(root, pens, { EntityId: "x.pen.y" })).toThrow(/no Brand/);
  });

  it("regenerate throws, and writes nothing, when a source is bad", async () => {
    const { regenerate } = await import("./sources.js");
    put("source/tablets/wacom/bad.json", null, "{");
    expect(() => regenerate(root)).toThrow(/bad\.json: invalid-json/);
    expect(fs.existsSync(path.join(root, "data"))).toBe(false);
  });
});
