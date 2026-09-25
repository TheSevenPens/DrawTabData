// Verify a published data snapshot (a version.json + the bundles it lists)
// against this repository. See lib/snapshot-verify.ts for what each check
// means, and docs/CONSUMERS.md "Verifying a published snapshot".
//
//   npx tsx scripts/verify-snapshot.ts <version.json path or URL>
//       [--bundles <dir or URL>]   where the bundles are (default: next to version.json)
//       [--repo <dir>]             DrawTabData checkout to verify against (default: this one)
//       [--commit <rev>]           commit for tracked deterministic metadata
//       [--ref <rev>]              freshness reference (default: <remote>/master, else HEAD)
//       [--fetch]                  git fetch the remote first, so <remote>/master is
//                                  today's upstream and a snapshot commit the clone
//                                  lacks gets pulled in
//       [--remote <name>]          the remote --fetch and the default ref use (default origin)
//       [--json]                   machine-readable result on stdout
//
// Example — the Explorer's live site:
//   npx tsx scripts/verify-snapshot.ts https://thesevenpens.github.io/DrawTabDataExplorer/version.json
//
// Exit code: 0 when the bundles are intact AND reproduce from their commit;
// 1 when anything mismatches; 2 when nothing mismatched but a check could not
// run (including a failed requested fetch). An older snapshot is
// "historical", not wrong. The checkout is never touched, and nothing is
// fetched unless --fetch asks (it updates remote-tracking refs only).

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  type Snapshot,
  checkFreshness,
  checkIntegrity,
  checkReproduction,
  fetchRemote,
  resolveCommit,
} from "../lib/snapshot-verify.js";

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv.splice(i, 2)[1] : undefined;
};
const asJson = argv.includes("--json");
const doFetch = argv.includes("--fetch");
const bundlesArg = flag("--bundles");
const repoArg = flag("--repo");
const refArg = flag("--ref");
const commitArg = flag("--commit");
const remote = flag("--remote") ?? "origin";
const target = argv.find((a) => !a.startsWith("--"));
if (!target) {
  console.error("Usage: npx tsx scripts/verify-snapshot.ts <version.json path or URL> [--bundles …] [--repo …] [--ref …] [--commit …] [--fetch] [--remote …] [--json]");
  process.exit(2);
}

const isUrl = (s: string) => /^https?:\/\//i.test(s);

async function readBytes(where: string): Promise<Buffer | undefined> {
  if (isUrl(where)) {
    try {
      const res = await fetch(where);
      return res.ok ? Buffer.from(await res.arrayBuffer()) : undefined;
    } catch {
      return undefined;
    }
  }
  return fs.existsSync(where) ? fs.readFileSync(where) : undefined;
}

const joinLoc = (base: string, rel: string) =>
  isUrl(base) ? new URL(rel, base.endsWith("/") ? base : `${base}/`).href : path.join(base, ...rel.split("/"));

const versionBytes = await readBytes(target);
if (!versionBytes) {
  console.error(`Could not read ${target}`);
  process.exit(2);
}
const snapshot = JSON.parse(versionBytes.toString("utf8")) as Snapshot;
if (!Array.isArray(snapshot.bundles) && !snapshot.commit) {
  console.error(`${target} is not a DrawTabData verification manifest`);
  process.exit(2);
}
if (commitArg) {
  if (snapshot.commit && snapshot.commit !== commitArg) {
    console.error("--commit is for deterministic metadata without publication provenance");
    process.exit(2);
  }
  snapshot.commit = commitArg;
}

const bundlesBase =
  bundlesArg ?? (isUrl(target) ? new URL(".", target).href : path.dirname(path.resolve(target)));

const here = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const top = spawnSync("git", ["-C", repoArg ?? here, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
const repo = top.status === 0 ? top.stdout.trim() : path.resolve(repoArg ?? here);
const fetched = doFetch ? fetchRemote(repo, remote) : undefined;
const ref = refArg ?? (resolveCommit(repo, `${remote}/master`) ? `${remote}/master` : "HEAD");

const integrity = await checkIntegrity(snapshot, (p) => readBytes(joinLoc(bundlesBase, p)));
const reproduction = checkReproduction(snapshot, repo);
const cached = checkFreshness(snapshot, repo, ref);
const freshness = fetched && !fetched.ok
  ? { status: "unable" as const, ref, reason: `fetch failed: ${fetched.reason}`, cached }
  : cached;

const failed = integrity.status === "mismatch" || reproduction.status === "mismatch";
const unable = integrity.status === "unable" || reproduction.status === "unable" || (doFetch && freshness.status === "unable");
const exitCode = failed ? 1 : unable ? 2 : 0;

if (asJson) {
  console.log(
    JSON.stringify(
      { snapshot: { source: target, commit: snapshot.commit, sourceDigest: snapshot.sourceDigest }, bundlesBase, repo, fetched, integrity, reproduction, freshness, exitCode },
      null,
      2,
    ),
  );
} else {
  const short = (s?: string) => (s ? s.slice(0, 12) : "—");
  console.log(`Snapshot  ${target}`);
  console.log(`          commit ${short(snapshot.commit)}, sourceDigest ${short(snapshot.sourceDigest)}`);
  console.log(`Bundles   ${bundlesBase}`);
  console.log(`Repo      ${repo}`);
  if (fetched) {
    console.log(fetched.ok ? `Fetched   ${fetched.remote}` : `Fetch     FAILED (${fetched.remote}): ${fetched.reason}`);
  }
  console.log("");

  const bad = integrity.bundles.filter((b) => b.status !== "ok");
  console.log(`integrity  ${integrity.status.toUpperCase()}  (${integrity.bundles.length - bad.length}/${integrity.bundles.length} bundles match)`);
  if (integrity.reason) console.log(`           ${integrity.reason}`);
  for (const b of bad) {
    console.log(
      `           ${b.path}: ${b.status}` +
        (b.status === "mismatch" ? ` (sha256 ${short(b.actualSha256)} vs ${short(b.expectedSha256)}, ${b.actualCount} vs ${b.expectedCount} records)` : ""),
    );
  }

  console.log(`reproduce  ${reproduction.status.toUpperCase()}  (regenerated from ${short(reproduction.commit)})`);
  if (reproduction.reason) console.log(`           ${reproduction.reason}`);
  for (const d of reproduction.differences) console.log(`           ${d}`);

  console.log(`freshness  ${freshness.status.toUpperCase()}  (vs ${freshness.ref} = ${short(freshness.refCommit)})`);
  if (freshness.reason) console.log(`           ${freshness.reason}`);
  if (freshness.cached) console.log(`cached     ${freshness.cached.status.toUpperCase()} (vs cached ${freshness.cached.ref} = ${short(freshness.cached.refCommit)})`);
  if (freshness.status === "historical") {
    console.log("           valid for its commit; source records have changed since");
  } else if (freshness.status === "not-on-ref") {
    console.log(`           the snapshot's commit is not an ancestor of ${freshness.ref}`);
  }
}
process.exit(exitCode);
