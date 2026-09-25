// Verify a published data snapshot against this repository (RFC #45,
// "External consumer verification" — the dedicated tool that
// docs/CONSUMERS.md used to describe as a manual procedure).
//
// A snapshot is a version.json plus the generated bundles it lists
// (`commit`, `sourceDigest`, `bundles[] {path, sha256, count}`). Three
// independent checks, each with an explicit outcome:
//
//   integrity  — do the bundle bytes you hold hash to what version.json
//                says?                      ok | mismatch | unable
//   reproduce  — regenerating from `commit`'s source/ gives exactly those
//                bundles and that digest?   reproduced | mismatch | unable
//   freshness  — is the snapshot's source content what `ref` has now?
//                current | historical | not-on-ref | unable
//
// "historical" means valid for its recorded commit but the sources have
// changed since; it is not a failure. Anything the tool can't inspect is
// "unable", never a pass.
//
// Git is read-only here: the commit's source/ tree is read with
// `git cat-file --batch` into a temp directory, so the caller's checkout,
// index and branches are never touched and nothing is fetched.
//
// Node-only (child_process, fs); not part of the browser bundle.

import { spawnSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SOURCE_COLLECTIONS, buildBundles, readSources, sourceDigest } from "./sources.js";

export interface SnapshotBundle {
  path: string;
  sha256: string;
  count: number;
}

export interface Snapshot {
  commit: string;
  sourceDigest?: string;
  bundles?: SnapshotBundle[];
}

export type IntegrityStatus = "ok" | "mismatch" | "unable";
export type ReproduceStatus = "reproduced" | "mismatch" | "unable";
export type FreshnessStatus = "current" | "historical" | "not-on-ref" | "unable";

export interface BundleIntegrity {
  path: string;
  status: "ok" | "mismatch" | "missing";
  expectedSha256: string;
  actualSha256?: string;
  expectedCount: number;
  actualCount?: number;
}

export interface IntegrityResult {
  status: IntegrityStatus;
  bundles: BundleIntegrity[];
  reason?: string;
}

export interface ReproduceResult {
  status: ReproduceStatus;
  commit: string;
  sourceDigest?: string;
  /** Human-readable differences; empty when reproduced. */
  differences: string[];
  reason?: string;
}

export interface FreshnessResult {
  status: FreshnessStatus;
  ref: string;
  refCommit?: string;
  refSourceDigest?: string;
  reason?: string;
}

export const sha256Hex = (bytes: Buffer | string) => crypto.createHash("sha256").update(bytes).digest("hex");

/** Root key of a bundle's envelope, from its collection directory. */
function rootKeyFor(bundlePath: string): string | undefined {
  const dir = bundlePath.split("/")[0];
  return SOURCE_COLLECTIONS.find((c) => c.name === dir)?.rootKey;
}

// --- integrity ---------------------------------------------------------------

/**
 * Hash each listed bundle as `read` returns it (the published, uncompressed
 * bytes; undefined when it can't be had) and count its records.
 */
export async function checkIntegrity(
  snapshot: Snapshot,
  read: (bundlePath: string) => Promise<Buffer | undefined>,
): Promise<IntegrityResult> {
  if (!snapshot.bundles?.length) {
    return { status: "unable", bundles: [], reason: "version.json lists no bundles (a snapshot from before RFC #45)" };
  }
  const bundles: BundleIntegrity[] = [];
  for (const b of snapshot.bundles) {
    const bytes = await read(b.path);
    const base = { path: b.path, expectedSha256: b.sha256, expectedCount: b.count };
    if (!bytes) {
      bundles.push({ ...base, status: "missing" });
      continue;
    }
    const actualSha256 = sha256Hex(bytes);
    let actualCount: number | undefined;
    try {
      const key = rootKeyFor(b.path);
      const arr = key ? (JSON.parse(bytes.toString("utf8")) as Record<string, unknown>)[key] : undefined;
      actualCount = Array.isArray(arr) ? arr.length : undefined;
    } catch {
      actualCount = undefined;
    }
    const ok = actualSha256 === b.sha256 && actualCount === b.count;
    bundles.push({ ...base, status: ok ? "ok" : "mismatch", actualSha256, actualCount });
  }
  return { status: bundles.every((b) => b.status === "ok") ? "ok" : "mismatch", bundles };
}

// --- git (read-only) ---------------------------------------------------------

function git(repo: string, args: string[], input?: string): { ok: boolean; out: Buffer } {
  const r = spawnSync("git", ["-C", repo, ...args], { input, maxBuffer: 1 << 30 });
  return { ok: r.status === 0 && !r.error, out: r.stdout ?? Buffer.alloc(0) };
}

/** Full commit id for `rev`, or undefined when the repo doesn't have it. */
export function resolveCommit(repo: string, rev: string): string | undefined {
  const r = git(repo, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
  return r.ok ? r.out.toString("utf8").trim() : undefined;
}

/**
 * Materialize `commit`'s source/ tree into a fresh temp directory (the
 * caller removes it). Returns undefined when git can't read it.
 */
export function extractSources(repo: string, commit: string): string | undefined {
  const ls = git(repo, ["ls-tree", "-r", "-z", commit, "--", "source"]);
  if (!ls.ok) return undefined;
  const entries = ls.out
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const [meta, file] = line.split("\t");
      return { sha: meta.split(" ")[2], file };
    });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-"));
  if (entries.length === 0) return dir;
  const batch = git(repo, ["cat-file", "--batch"], entries.map((e) => e.sha).join("\n") + "\n");
  if (!batch.ok) {
    fs.rmSync(dir, { recursive: true, force: true });
    return undefined;
  }
  // Output per object: "<sha> blob <size>\n<bytes>\n", in request order.
  let at = 0;
  for (const e of entries) {
    const nl = batch.out.indexOf(0x0a, at);
    const size = Number(batch.out.subarray(at, nl).toString("utf8").split(" ")[2]);
    const body = batch.out.subarray(nl + 1, nl + 1 + size);
    at = nl + 1 + size + 1;
    const abs = path.join(dir, ...e.file.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

function withSources<T>(repo: string, commit: string, fn: (dir: string) => T): T | undefined {
  const dir = extractSources(repo, commit);
  if (!dir) return undefined;
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- reproduce ---------------------------------------------------------------

/** Regenerate the bundles from the snapshot's commit and compare. */
export function checkReproduction(snapshot: Snapshot, repo: string): ReproduceResult {
  const base = { commit: snapshot.commit, differences: [] as string[] };
  const commit = resolveCommit(repo, snapshot.commit);
  if (!commit) {
    return { ...base, status: "unable", reason: `commit ${snapshot.commit} is not in ${repo} (git fetch first?)` };
  }
  const out = withSources(repo, commit, (dir) => {
    const differences: string[] = [];
    const digest = sourceDigest(dir) ?? undefined;
    if (digest !== snapshot.sourceDigest) {
      differences.push(`sourceDigest: version.json has ${snapshot.sourceDigest ?? "none"}, the commit's sources give ${digest ?? "none"}`);
    }
    const generated = new Map<string, { sha256: string; count: number }>();
    for (const c of SOURCE_COLLECTIONS) {
      const { records, issues } = readSources(dir, c);
      for (const i of issues) differences.push(`source problem at that commit: ${i.file}: ${i.problem}`);
      for (const [rel, text] of buildBundles(c, records)) {
        const key = rel.slice("data/".length);
        const n = (JSON.parse(text) as Record<string, unknown[]>)[c.rootKey].length;
        generated.set(key, { sha256: sha256Hex(Buffer.from(text, "utf8")), count: n });
      }
    }
    const listed = new Map((snapshot.bundles ?? []).map((b) => [b.path, b]));
    for (const [p, g] of generated) {
      const b = listed.get(p);
      if (!b) differences.push(`${p}: generated from the sources but not listed in version.json`);
      else if (b.sha256 !== g.sha256) differences.push(`${p}: regenerated sha256 ${g.sha256} ≠ listed ${b.sha256}`);
      else if (b.count !== g.count) differences.push(`${p}: ${g.count} records ≠ listed ${b.count}`);
    }
    for (const p of listed.keys()) {
      if (!generated.has(p)) differences.push(`${p}: listed in version.json but the sources don't produce it`);
    }
    return { digest, differences };
  });
  if (!out) return { ...base, status: "unable", reason: `could not read source/ at ${commit}` };
  return {
    commit,
    sourceDigest: out.digest,
    differences: out.differences,
    status: out.differences.length === 0 ? "reproduced" : "mismatch",
  };
}

// --- freshness ---------------------------------------------------------------

/**
 * Compare the snapshot's sourceDigest with `ref`'s sources. `ref` is
 * resolved to one commit first (a moving branch is only meaningful as a
 * point in time); nothing is fetched, so a stale local ref gives a stale
 * answer — the result names the commit it compared against.
 */
export function checkFreshness(snapshot: Snapshot, repo: string, ref: string): FreshnessResult {
  const refCommit = resolveCommit(repo, ref);
  if (!refCommit) return { status: "unable", ref, reason: `${ref} does not resolve in ${repo}` };
  if (!snapshot.sourceDigest) {
    return { status: "unable", ref, refCommit, reason: "version.json has no sourceDigest" };
  }
  const refSourceDigest = withSources(repo, refCommit, (dir) => sourceDigest(dir) ?? undefined);
  if (refSourceDigest === undefined) {
    return { status: "unable", ref, refCommit, reason: `could not read source/ at ${refCommit}` };
  }
  if (refSourceDigest === snapshot.sourceDigest) return { status: "current", ref, refCommit, refSourceDigest };
  const snapCommit = resolveCommit(repo, snapshot.commit);
  if (!snapCommit) {
    return { status: "unable", ref, refCommit, refSourceDigest, reason: `commit ${snapshot.commit} is not in ${repo}` };
  }
  const isAncestor = spawnSync("git", ["-C", repo, "merge-base", "--is-ancestor", snapCommit, refCommit]).status === 0;
  return { status: isAncestor ? "historical" : "not-on-ref", ref, refCommit, refSourceDigest };
}
