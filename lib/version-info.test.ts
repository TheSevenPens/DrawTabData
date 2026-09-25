import { initSources, penFixture } from "../test/fixtures.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as path from "path";
import * as url from "url";
import * as v from "valibot";
import { buildVersionInfo, DATA_SCHEMA_VERSION } from "./version-info.js";
import { createDiskDataSet } from "./dataset-node.js";
import { VersionInfoSchema } from "./schemas.js";
import { loadVersionFromURL } from "./drawtab-loader.js";

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");

describe("buildVersionInfo", () => {
  const info = buildVersionInfo(repoRoot);

  it("matches VersionInfoSchema", () => {
    expect(v.safeParse(VersionInfoSchema, info).success).toBe(true);
  });

  it("uses the hand-maintained schema version", () => {
    expect(info.schemaVersion).toBe(DATA_SCHEMA_VERSION);
  });

  it("names the checked-out commit", () => {
    expect(info.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(info.shortCommit).toBe(info.commit.slice(0, 7));
    expect(info.version).toBe(info.commitDate.slice(0, 10).replace(/-/g, "."));
  });

  // The #333 bug: the counts described an old snapshot. They must equal what
  // the loaders actually return for the same checkout.
  it("counts match what the dataset loads", async () => {
    const ds = createDiskDataSet({ dataDir: path.join(repoRoot, "data") });
    expect(info.counts).toEqual({
      tablets: await ds.Tablets.count(),
      pens: await ds.Pens.count(),
      penFamilies: await ds.PenFamilies.count(),
      tabletFamilies: await ds.TabletFamilies.count(),
      drivers: await ds.Drivers.count(),
      brands: await ds.Brands.count(),
      pressureResponse: await ds.PressureResponse.count(),
    });
  });
});

describe("loadVersionFromURL", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns null on a network error instead of rejecting", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await loadVersionFromURL("/d")).toBeNull();
  });

  it("returns null on a server error or a missing file", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 503 }));
    expect(await loadVersionFromURL("/d")).toBeNull();
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }));
    expect(await loadVersionFromURL("/d")).toBeNull();
  });
});

describe("buildVersionInfo().files", () => {
  const info = buildVersionInfo(repoRoot);

  it("lists data files relative to data/, sorted, excluding version.json", () => {
    expect(info.files).toContain("pens/WACOM-pens.json");
    expect(info.files).toContain("brands/brands.json");
    expect(info.files).not.toContain("version.json");
    expect(info.files).toEqual([...(info.files ?? [])].sort());
    expect(info.files?.every((f) => !f.includes("\\"))).toBe(true);
  });

  it("omits brand files that don't exist (no LAMY pen-compat file)", () => {
    expect(info.files).not.toContain("pen-compat/LAMY-pen-compat.json");
  });
});

describe("buildVersionInfo().indexes.pressureSessionsByPen", () => {
  it("equals counting the sessions the dataset loads", async () => {
    const info = buildVersionInfo(repoRoot);
    const ds = createDiskDataSet({ dataDir: path.join(repoRoot, "data") });
    const expected: Record<string, number> = {};
    for (const s of await ds.PressureResponse.toArray()) {
      expected[s.PenEntityId] = (expected[s.PenEntityId] ?? 0) + 1;
    }
    expect(info.indexes?.pressureSessionsByPen).toEqual(expected);
  });
});

describe("verificationMetadata (RFC #45)", () => {
  it("is empty without sources, and hashes each generated bundle when there are some", async () => {
    const fsm = await import("node:fs");
    const os = await import("node:os");
    const { verificationMetadata } = await import("./version-info.js");
    const { generateBundles } = await import("./sources.js");
    const { formatDataJson } = await import("./data-json.js");
    const crypto = await import("node:crypto");
    const tmp = fsm.mkdtempSync(path.join(os.tmpdir(), "vmeta-"));
    try {
      expect(verificationMetadata(tmp)).toEqual({});
      initSources(tmp);
      const rec = penFixture("WACOM", "kp503e");
      fsm.mkdirSync(path.join(tmp, "source/pens/wacom"), { recursive: true });
      fsm.writeFileSync(path.join(tmp, "source/pens/wacom/wacom.pen.kp503e.json"), formatDataJson(rec));
      generateBundles(tmp, { write: true });
      const meta = verificationMetadata(tmp);
      const bytes = fsm.readFileSync(path.join(tmp, "data/pens/WACOM-pens.json"));
      expect(meta.sourceDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(meta.bundles).toEqual([
        { path: "pens/WACOM-pens.json", sha256: crypto.createHash("sha256").update(bytes).digest("hex"), count: 1 },
      ]);
    } finally {
      fsm.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
