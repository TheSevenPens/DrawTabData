import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DataLoadError,
  ShardedURLLoader,
  fetchDataFile,
  loadBrandPartitionedDataFromURL,
  loadBrandsFromURL,
} from "./drawtab-loader.js";

// Each test serves a small map of path -> response. Anything not listed is
// a 404, like a brand with no file for that entity.
type Serve =
  | { json: unknown; delayMs?: number }
  | { status: number }
  | { html: string }
  | { text: string; contentType: string }
  | { networkError: true };

function serve(routes: Record<string, Serve>) {
  vi.stubGlobal("fetch", async (url: string) => {
    const r = routes[url];
    if (!r) return new Response("not found", { status: 404 });
    if ("networkError" in r) throw new TypeError("Failed to fetch");
    if ("status" in r) return new Response("oops", { status: r.status });
    if ("html" in r) {
      return new Response(r.html, { status: 200, headers: { "content-type": "text/html" } });
    }
    if ("text" in r) {
      return new Response(r.text, { status: 200, headers: { "content-type": r.contentType } });
    }
    if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
    return new Response(JSON.stringify(r.json), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

afterEach(() => vi.unstubAllGlobals());

const pens = (shards: string[]) =>
  new ShardedURLLoader<{ Id: string }>("/d", {
    shards,
    filePath: (s) => `pens/${s}-pens.json`,
    rootKey: "Pens",
  });

describe("fetchDataFile", () => {
  it("returns undefined for a 404 (absent file)", async () => {
    serve({});
    expect(await fetchDataFile("/d/x.json")).toBeUndefined();
  });

  it("returns undefined for an HTML page served in place of the file", async () => {
    serve({ "/d/x.json": { html: "<!doctype html>" } });
    expect(await fetchDataFile("/d/x.json")).toBeUndefined();
  });

  it("throws on HTTP 503", async () => {
    serve({ "/d/x.json": { status: 503 } });
    await expect(fetchDataFile("/d/x.json")).rejects.toThrow("Couldn't load /d/x.json: HTTP 503");
  });

  it("throws on a network error", async () => {
    serve({ "/d/x.json": { networkError: true } });
    await expect(fetchDataFile("/d/x.json")).rejects.toBeInstanceOf(DataLoadError);
  });

  it("throws on invalid JSON", async () => {
    serve({ "/d/x.json": { text: "{ truncated", contentType: "application/json" } });
    await expect(fetchDataFile("/d/x.json")).rejects.toThrow("invalid JSON");
  });

  it("parses JSON even when the server labels it text/plain", async () => {
    serve({ "/d/x.json": { text: '{"a":1}', contentType: "text/plain" } });
    expect(await fetchDataFile("/d/x.json")).toEqual({ a: 1 });
  });
});

describe("ShardedURLLoader", () => {
  it("skips absent shards and keeps the rest", async () => {
    serve({ "/d/pens/WACOM-pens.json": { json: { Pens: [{ Id: "KP-503E" }] } } });
    expect(await pens(["HUION", "WACOM"]).load()).toEqual([{ Id: "KP-503E" }]);
  });

  it("fails the whole load when one shard returns 503 (the #331 case)", async () => {
    serve({
      "/d/pens/HUION-pens.json": { json: { Pens: [{ Id: "PW517" }] } },
      "/d/pens/WACOM-pens.json": { status: 503 },
    });
    await expect(pens(["HUION", "WACOM"]).load()).rejects.toThrow(
      "Couldn't load /d/pens/WACOM-pens.json: HTTP 503",
    );
  });

  it("fails on a network error for one shard", async () => {
    serve({ "/d/pens/WACOM-pens.json": { networkError: true } });
    await expect(pens(["WACOM"]).load()).rejects.toThrow("network error");
  });

  it("fails when the root key is missing or not an array", async () => {
    serve({ "/d/pens/WACOM-pens.json": { json: { Pen: [] } } });
    await expect(pens(["WACOM"]).load()).rejects.toThrow('expected an array under "Pens"');
  });

  it("fails when the array holds a non-record", async () => {
    serve({ "/d/pens/WACOM-pens.json": { json: { Pens: [{ Id: "A" }, null] } } });
    await expect(pens(["WACOM"]).load()).rejects.toThrow('"Pens"[1] is not a record');
  });

  it("returns rows in shard order, not response order", async () => {
    serve({
      "/d/pens/HUION-pens.json": { json: { Pens: [{ Id: "H" }] }, delayMs: 20 },
      "/d/pens/WACOM-pens.json": { json: { Pens: [{ Id: "W" }] } },
    });
    expect(await pens(["HUION", "WACOM"]).load()).toEqual([{ Id: "H" }, { Id: "W" }]);
  });

  it("applies the transform to the concatenated rows", async () => {
    serve({ "/d/pens/WACOM-pens.json": { json: { Pens: [{ Id: "A" }, { Id: "B" }] } } });
    const loader = new ShardedURLLoader<number, { Id: string }>("/d", {
      shards: ["WACOM"],
      filePath: (s) => `pens/${s}-pens.json`,
      rootKey: "Pens",
      transform: (raw) => [raw.length],
    });
    expect(await loader.load()).toEqual([2]);
  });
});

describe("free-function loaders share the same policy", () => {
  it("loadBrandPartitionedDataFromURL throws on a failed shard", async () => {
    serve({ "/d/pens/WACOM-pens.json": { status: 500 } });
    await expect(
      loadBrandPartitionedDataFromURL("/d", "pens", "Pens", ["WACOM"]),
    ).rejects.toThrow("HTTP 500");
  });

  it("single-file loaders return their empty value when the file is absent", async () => {
    serve({});
    expect(await loadBrandsFromURL("/d")).toEqual([]);
  });

  it("single-file loaders throw when the file fails", async () => {
    serve({ "/d/brands/brands.json": { status: 503 } });
    await expect(loadBrandsFromURL("/d")).rejects.toThrow("HTTP 503");
  });
});

describe("ShardedURLLoader with a file manifest (#346)", () => {
  function trackingServe(routes: Record<string, unknown>) {
    const requested: string[] = [];
    vi.stubGlobal("fetch", async (u: string) => {
      requested.push(u);
      if (!(u in routes)) return new Response("", { status: 404 });
      return Response.json(routes[u]);
    });
    return requested;
  }
  const withManifest = (files: string[] | null) =>
    new ShardedURLLoader<{ Id: string }>("/d", {
      shards: ["HUION", "WACOM", "XPPEN"],
      filePath: (s) => `pens/${s}-pens.json`,
      rootKey: "Pens",
      manifest: async () => (files ? new Set(files) : null),
    });

  it("fetches only the shards the manifest lists", async () => {
    const requested = trackingServe({ "/d/pens/WACOM-pens.json": { Pens: [{ Id: "W" }] } });
    expect(await withManifest(["pens/WACOM-pens.json"]).load()).toEqual([{ Id: "W" }]);
    expect(requested).toEqual(["/d/pens/WACOM-pens.json"]);
  });

  it("treats a listed file that is missing as an error, not an empty shard", async () => {
    trackingServe({});
    await expect(withManifest(["pens/WACOM-pens.json"]).load()).rejects.toThrow(
      "listed in the file manifest but not found",
    );
  });

  it("probes every shard when there is no manifest", async () => {
    const requested = trackingServe({ "/d/pens/WACOM-pens.json": { Pens: [] } });
    await withManifest(null).load();
    expect(requested).toHaveLength(3);
  });
});
