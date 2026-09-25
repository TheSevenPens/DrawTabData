import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatDataJson } from "./data-json.js";
import { type Snapshot, checkFreshness, checkIntegrity, checkReproduction, fetchRemote } from "./snapshot-verify.js";
import { generateBundles, sourceCollection, sourcePath } from "./sources.js";
import { verificationMetadata } from "./version-info.js";

const pens = sourceCollection("pens");
let repo: string;

function git(...args: string[]): string {
  const r = spawnSync(
    "git",
    ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "core.autocrlf=false", ...args],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}
function addPen(id: string) {
  const abs = path.join(repo, sourcePath(pens, "WACOM", `wacom.pen.${id}`));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, formatDataJson({ EntityId: `wacom.pen.${id}`, Brand: "WACOM", PenId: id }));
  generateBundles(repo, { write: true });
}
function commit(msg: string): string {
  git("add", "-A");
  git("commit", "-q", "-m", msg);
  return git("rev-parse", "HEAD");
}
const snapshotAt = (c: string): Snapshot => ({ commit: c, ...verificationMetadata(repo) });
const readFromRepo = async (p: string) => {
  const abs = path.join(repo, "data", ...p.split("/"));
  return fs.existsSync(abs) ? fs.readFileSync(abs) : undefined;
};

let base: string;
let c1: string;
beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "snapverify-"));
  git("init", "-q", "-b", "master");
  fs.writeFileSync(path.join(repo, "README.md"), "x\n");
  base = commit("base");
  addPen("kp503e");
  addPen("kp504e");
  c1 = commit("two pens");
});
afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

describe("checkIntegrity", () => {
  it("ok when every listed bundle hashes and counts as recorded", async () => {
    const r = await checkIntegrity(snapshotAt(c1), readFromRepo);
    expect(r.status).toBe("ok");
    expect(r.bundles).toEqual([expect.objectContaining({ path: "pens/WACOM-pens.json", status: "ok", actualCount: 2 })]);
  });

  it("reports a tampered bundle and a missing one", async () => {
    const snap = snapshotAt(c1);
    const r = await checkIntegrity(snap, async (p) => Buffer.from((await readFromRepo(p))!.toString("utf8").replace("kp503e", "kp503f")));
    expect(r.status).toBe("mismatch");
    expect(r.bundles[0].status).toBe("mismatch");
    const missing = await checkIntegrity(snap, async () => undefined);
    expect(missing.bundles[0].status).toBe("missing");
  });

  it("is unable, not ok, for a version.json without bundles", async () => {
    expect((await checkIntegrity({ commit: c1 }, readFromRepo)).status).toBe("unable");
  });
});

describe("checkReproduction", () => {
  it("regenerates the recorded bundles from the commit, leaving the checkout alone", () => {
    const snap = snapshotAt(c1);
    addPen("zz1"); // uncommitted work in progress must not leak into the check
    const r = checkReproduction(snap, repo);
    expect(r).toMatchObject({ status: "reproduced", commit: c1, differences: [] });
    expect(git("status", "--porcelain")).not.toBe("");
    expect(git("rev-parse", "HEAD")).toBe(c1);
  });

  it("names every difference", () => {
    const snap = snapshotAt(c1);
    snap.bundles![0].sha256 = "0".repeat(64);
    snap.bundles!.push({ path: "pens/HUION-pens.json", sha256: "1".repeat(64), count: 1 });
    snap.sourceDigest = "f".repeat(64);
    const r = checkReproduction(snap, repo);
    expect(r.status).toBe("mismatch");
    expect(r.differences).toEqual([
      expect.stringMatching(/^sourceDigest: /),
      expect.stringMatching(/^pens\/WACOM-pens\.json: regenerated sha256/),
      expect.stringMatching(/^pens\/HUION-pens\.json: listed in version\.json but the sources don't produce it/),
    ]);
  });

  it("is unable when the commit isn't in the repo", () => {
    const r = checkReproduction({ ...snapshotAt(c1), commit: "0123456789abcdef0123456789abcdef01234567" }, repo);
    expect(r.status).toBe("unable");
  });
});

describe("checkFreshness", () => {
  it("current at the same sources — a docs-only commit doesn't change that", () => {
    const snap = snapshotAt(c1);
    fs.writeFileSync(path.join(repo, "README.md"), "docs only\n");
    const c2 = commit("docs");
    expect(checkFreshness(snap, repo, "master")).toMatchObject({ status: "current", refCommit: c2 });
  });

  it("historical once a source record changes after the snapshot", () => {
    const snap = snapshotAt(c1);
    addPen("kp505e");
    commit("third pen");
    expect(checkFreshness(snap, repo, "master").status).toBe("historical");
  });

  it("not-on-ref when the snapshot's commit isn't an ancestor of the ref", () => {
    const snap = snapshotAt(c1);
    git("checkout", "-q", "-b", "other", base);
    addPen("xx1");
    commit("elsewhere");
    expect(checkFreshness(snap, repo, "other").status).toBe("not-on-ref");
  });

  it("is unable for a ref that doesn't resolve", () => {
    expect(checkFreshness(snapshotAt(c1), repo, "no-such-branch").status).toBe("unable");
  });
});

describe("fetchRemote (--fetch)", () => {
  // Plain git in any directory — the suite's git() helper is bound to `repo`.
  const gitIn = (dir: string, ...args: string[]) => {
    const r = spawnSync(
      "git",
      ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "core.autocrlf=false", ...args],
      { encoding: "utf8" },
    );
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  };

  it("updates origin/master so freshness sees upstream changes; touches no local branch", () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "snapverify-origin-"));
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "snapverify-other-"));
    try {
      gitIn(bare, "init", "-q", "--bare");
      git("remote", "add", "origin", bare);
      git("push", "-q", "origin", "master");
      git("fetch", "-q", "origin");
      const snap = snapshotAt(c1);
      expect(checkFreshness(snap, repo, "origin/master").status).toBe("current");

      // Someone else adds a pen upstream.
      gitIn(other, "clone", "-q", bare, ".");
      const abs = path.join(other, sourcePath(pens, "WACOM", "wacom.pen.upstream"));
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, formatDataJson({ EntityId: "wacom.pen.upstream", Brand: "WACOM", PenId: "upstream" }));
      gitIn(other, "add", "-A");
      gitIn(other, "commit", "-q", "-m", "upstream pen");
      gitIn(other, "push", "-q", "origin", "HEAD:master");

      expect(checkFreshness(snap, repo, "origin/master").status).toBe("current"); // not fetched yet
      expect(fetchRemote(repo)).toEqual({ ok: true, remote: "origin" });
      expect(checkFreshness(snap, repo, "origin/master").status).toBe("historical");
      expect(git("rev-parse", "master")).toBe(c1); // local branch untouched
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it("reports a remote it can't fetch instead of throwing", () => {
    const r = fetchRemote(repo, "nosuch");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/nosuch/);
  });
});
