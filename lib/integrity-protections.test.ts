// @vitest-environment node
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initSources, penFixture, tabletFixture } from "../test/fixtures.js";
import { readDataJson, writeDataJson } from "./data-json.js";
import { sourceCollection, writeSourceRecord, generateBundles, planBundles, readSources } from "./sources.js";
import { generateDataset } from "./generate-dataset.js";
import { applyEdit, editRecord, parseAssignments } from "./edit-record.js";
import * as quality from "./data-quality.js";
import { buildContentInfo, buildVersionInfo, GENERATOR_VERSION } from "./version-info.js";
import { checkReproduction } from "./snapshot-verify.js";

let root: string;
const tabletId = "wacom.tablet.t1";
const penId = "wacom.pen.p1";
const tabletPath = "source/tablets/wacom/wacom.tablet.t1.json";
const penPath = "source/pens/wacom/wacom.pen.p1.json";
const read = (file: string) => readDataJson<Record<string, any>>(path.join(root, file));
const bytes = () => {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel); else out[rel] = fs.readFileSync(path.join(root, rel)).toString("base64");
    }
  };
  walk("source"); walk("data"); return out;
};
const git = (...args: string[]) => execFileSync("git", ["-C", root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
function commit() { git("init", "-q", "-b", "master"); git("add", "source", "data"); git("commit", "-qm", "fixture"); return git("rev-parse", "HEAD"); }
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "integrity-")); initSources(root);
  writeSourceRecord(root, sourceCollection("tablets"), tabletFixture("WACOM", "t1"));
  writeSourceRecord(root, sourceCollection("pens"), penFixture("WACOM", "p1"));
  expect(generateDataset(root, { write: true }).sourceIssues).toEqual([]);
});
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

describe("protected edits and failed transactions", () => {
  it.each(["EntityId", "_id", "_CreateDate", "_ModifiedDate"])("rejects a protected Meta.%s changed through the parent", field => {
    const before = bytes(); const record = read(tabletPath);
    expect(() => editRecord(root, tabletId, [{ path: "Meta", kind: "set", value: { ...record.Meta, [field]: "changed" } }])).toThrow(/identity\/tracking/);
    expect(bytes()).toEqual(before);
  });
  it.each(["Brand", "Id", "IdSuffix"])("rejects a protected Model.%s changed through the parent", field => {
    const record = read(tabletPath), before = bytes();
    expect(() => editRecord(root, tabletId, [{ path: "Model", kind: "set", value: { ...record.Model, [field]: "changed" } }])).toThrow(/identity\/tracking/);
    expect(bytes()).toEqual(before);
  });
  it("accepts a parent replacement preserving identity", () => {
    const record = read(tabletPath);
    expect(editRecord(root, tabletId, [{ path: "Model", kind: "set", value: { ...record.Model, Name: "Renamed" } }]).written).toBe(true);
    expect(read(tabletPath).Model.Name).toBe("Renamed");
    expect(generateDataset(root, { write: false })).toMatchObject({ sourceIssues: [], changed: [], missing: [], extra: [] });
  });
  it("rejects direct creation-date changes and unsafe object paths", () => {
    expect(() => applyEdit(root, penId, parseAssignments(["_CreateDate=changed"]))).toThrow(/identity/);
    expect(() => applyEdit(root, tabletId, parseAssignments(["Model.__proto__.polluted:=true"]))).toThrow(/Unsafe/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("preflights another collection before writing the requested record", () => {
    const p = path.join(root, tabletPath); fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/\n/g, "\r\n"));
    const before = bytes();
    expect(() => editRecord(root, penId, parseAssignments(["Notes=changed"]))).toThrow(/crlf/);
    expect(bytes()).toEqual(before);
  });
  it("keeps the exact tree after a new graph error or a validator exception", () => {
    const before = bytes();
    const result = editRecord(root, tabletId, parseAssignments(['Model.IncludedPen:=["wacom.pen.missing"]']));
    expect(result.written).toBe(false); expect(result.newIssues.length).toBeGreaterThan(0); expect(bytes()).toEqual(before);
    const original = quality.runDataQuality;
    vi.spyOn(quality, "runDataQuality").mockImplementationOnce(original).mockImplementationOnce(() => { throw new Error("validator failed"); });
    expect(() => editRecord(root, penId, parseAssignments(["Notes=changed"]))).toThrow("validator failed");
    expect(bytes()).toEqual(before);
  });
});

describe("source and graph gates", () => {
  it("rejects schema-invalid sources without replacing any bundle", () => {
    writeDataJson(path.join(root, penPath), { ...read(penPath), PenTech: "LASER" });
    const before = bytes();
    expect(generateBundles(root, { write: true }).sourceIssues.some(i => i.problem.includes("PenTech"))).toBe(true);
    expect(bytes()).toEqual(before);
  });
  it("names both source files for duplicate UUIDs within and across collections", () => {
    const pen = read(penPath);
    writeSourceRecord(root, sourceCollection("pens"), { ...penFixture("WACOM", "p2"), _id: pen._id });
    expect(readSources(root, sourceCollection("pens")).issues).toContainEqual(expect.objectContaining({ problem: expect.stringContaining(penPath) }));
    const tablet = read(tabletPath); tablet.Meta._id = pen._id; writeDataJson(path.join(root, tabletPath), tablet);
    expect(planBundles(root).result.sourceIssues.some(i => i.problem.includes(tabletPath))).toBe(true);
  });
  it("finds UUID collisions between generated and grouped collections", () => {
    writeDataJson(path.join(root, "data/pen-families/WACOM-pen-families.json"), { PenFamilies: [{ EntityId: "wacom.penfamily.test", _id: read(penPath)._id }] });
    expect(quality.runUuidChecks(path.join(root, "data"))).toContainEqual(expect.objectContaining({ issue: expect.stringContaining("duplicate UUID") }));
  });
  it("fails missing collections in check and write mode without deleting old bundles", () => {
    fs.renameSync(path.join(root, "source/pens"), path.join(root, "removed-pens"));
    const before = bytes();
    for (const write of [false, true]) {
      expect(generateDataset(root, { write }).sourceIssues).toContainEqual({ file: "source/pens", problem: "required source collection is missing" });
      expect(bytes()).toEqual(before);
    }
  });
  it("rejects loss of the entire source tree without changing bundled data", () => {
    const manifest = fs.readFileSync(path.join(root, "data/version.json"));
    const bundle = fs.readFileSync(path.join(root, "data/pens/WACOM-pens.json"));
    fs.renameSync(path.join(root, "source"), path.join(root, "removed-source"));
    for (const write of [false, true]) {
      expect(generateDataset(root, { write }).sourceIssues).toHaveLength(3);
      expect(fs.readFileSync(path.join(root, "data/version.json"))).toEqual(manifest);
      expect(fs.readFileSync(path.join(root, "data/pens/WACOM-pens.json"))).toEqual(bundle);
    }
  });
});

describe("deterministic metadata and publication provenance", () => {
  it("checks metadata drift without repair and keeps deterministic content free of commits/dates", () => {
    const info = read("data/version.json");
    expect(info.commit).toBeUndefined(); expect(info.version).toBeUndefined(); expect(info.provenance).toBeUndefined();
    expect(info.verification.covers).toEqual(["source/tablets", "source/pens", "source/pressure-response"]);
    expect(info.generatorVersion).toBe(GENERATOR_VERSION);
    expect(info).toEqual(buildContentInfo(root));
    info.counts.pens = 900; writeDataJson(path.join(root, "data/version.json"), info);
    const before = bytes(); expect(generateDataset(root, { write: false }).changed).toContain("data/version.json"); expect(bytes()).toEqual(before);
  });
  it("records clean provenance, then detects modified, untracked and generator inputs", () => {
    commit(); expect(buildVersionInfo(root).provenance.dirty).toBe(false);
    fs.writeFileSync(path.join(root, "README.md"), "docs only\n"); expect(buildVersionInfo(root).provenance.dirty).toBe(false);
    writeDataJson(path.join(root, penPath), { ...read(penPath), Notes: "edited" });
    writeSourceRecord(root, sourceCollection("pens"), penFixture("WACOM", "p2"));
    fs.mkdirSync(path.join(root, "lib")); fs.writeFileSync(path.join(root, "lib/generator.ts"), "// local change\n");
    const info = buildVersionInfo(root);
    expect(info.provenance.dirtyPaths).toEqual(expect.arrayContaining([penPath, "source/pens/wacom/wacom.pen.p2.json", "lib/generator.ts"]));
    expect(checkReproduction(info, root)).toMatchObject({ status: "unable", reason: expect.stringContaining("dirty") });
  });
  it("reports an unsupported generator as unable; reproduces deterministic metadata with an explicit commit", () => {
    const sha = commit(); const snapshot = { ...buildContentInfo(root), commit: sha };
    expect(checkReproduction(snapshot, root).status).toBe("reproduced");
    expect(checkReproduction({ ...snapshot, generatorVersion: GENERATOR_VERSION + 1 }, root).status).toBe("unable");
    expect(checkReproduction({ ...snapshot, verification: { ...snapshot.verification!, covers: ["source/unknown"] } }, root).status).toBe("unable");
    expect(checkReproduction(buildContentInfo(root), root).status).toBe("unable");
  });
  it.each(["current", "historical"])("failed fetch leaves cached %s separately labelled and returns exit 2", cached => {
    const sha = commit();
    const manifest = path.join(root, "snapshot.json");
    fs.copyFileSync(path.join(root, "data/version.json"), manifest);
    // Keep a copy of the downloaded bundle bytes while the local ref advances.
    fs.cpSync(path.join(root, "data"), path.join(root, "published"), { recursive: true });
    if (cached === "historical") {
      writeSourceRecord(root, sourceCollection("pens"), penFixture("WACOM", "p2"));
      generateDataset(root, { write: true });
      git("add", "source", "data"); git("commit", "-qm", "later source change");
    }
    git("update-ref", "refs/remotes/origin/master", git("rev-parse", "HEAD")); git("remote", "add", "origin", path.join(root, "nonexistent.git"));
    const script = fileURLToPath(new URL("../scripts/verify-snapshot.ts", import.meta.url));
    const run = spawnSync(process.execPath, ["--import", "tsx", script, manifest, "--bundles", path.join(root, "published"), "--repo", root, "--commit", sha, "--fetch", "--json"], { encoding: "utf8" });
    expect(run.status, run.stderr).toBe(2);
    const result = JSON.parse(run.stdout);
    expect(result).toMatchObject({ integrity: { status: "ok" }, reproduction: { status: "reproduced" }, freshness: { status: "unable", cached: { status: cached } } });
  });
});
