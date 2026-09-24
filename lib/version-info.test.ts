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
