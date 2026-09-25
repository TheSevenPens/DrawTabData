// Verify a published data snapshot (a version.json + the bundles it lists)
// against this repository. See lib/snapshot-verify.ts for what each check
// means, and docs/CONSUMERS.md "Verifying a published snapshot".
//
//   npx tsx scripts/verify-snapshot.ts <version.json path or URL>
//       [--bundles <dir or URL>]   where the bundles are (default: next to version.json)
//       [--repo <dir>]             DrawTabData checkout to verify against (default: this one)
//       [--ref <rev>]              freshness reference (default: origin/master, else HEAD)
//       [--json]                   machine-readable result on stdout
//
// Example — the Explorer's live site:
//   npx tsx scripts/verify-snapshot.ts https://thesevenpens.github.io/DrawTabDataExplorer/version.json
//
// Exit code: 0 when the bundles are intact AND reproduce from their commit;
// 1 when anything mismatches; 2 when nothing mismatched but a check could not
// run. Freshness is reported, never an exit failure — an older snapshot is
// "historical", not wrong. Nothing is fetched and the checkout isn't touched.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  type Snapshot,
  checkFreshness,
  checkIntegrity,
  checkReproduction,
  resolveCommit,
} from "../lib/snapshot-verify.js";

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv.splice(i, 2)[1] : undefined;
};
const asJson = argv.includes("--json");
const bundlesArg = flag("--bundles");
const repoArg = flag("--repo");
const refArg = flag("--ref");
const target = argv.find((a) => !a.startsWith("--"));
if (!target) {
  console.error("Usage: npx tsx scripts/verify-snapshot.ts <version.json path or URL> [--bundles …] [--repo …] [--ref …] [--json]");
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
if (typeof snapshot.commit !== "string" || !snapshot.commit) {
  console.error(`${target} has no "commit" — not a DrawTabData version.json`);
  process.exit(2);
}

const bundlesBase =
  bundlesArg ?? (isUrl(target) ? new URL(".", target).href : path.dirname(path.resolve(target)));

const here = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const top = spawnSync("git", ["-C", repoArg ?? here, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
const repo = top.status === 0 ? top.stdout.trim() : path.resolve(repoArg ?? here);
const ref = refArg ?? (resolveCommit(repo, "origin/master") ? "origin/master" : "HEAD");

const integrity = await checkIntegrity(snapshot, (p) => readBytes(joinLoc(bundlesBase, p)));
const reproduction = checkReproduction(snapshot, repo);
const freshness = checkFreshness(snapshot, repo, ref);

const failed = integrity.status === "mismatch" || reproduction.status === "mismatch";
const unable = integrity.status === "unable" || reproduction.status === "unable";
const exitCode = failed ? 1 : unable ? 2 : 0;

if (asJson) {
  console.log(
    JSON.stringify(
      { snapshot: { source: target, commit: snapshot.commit, sourceDigest: snapshot.sourceDigest }, bundlesBase, repo, integrity, reproduction, freshness, exitCode },
      null,
      2,
    ),
  );
} else {
  const short = (s?: string) => (s ? s.slice(0, 12) : "—");
  console.log(`Snapshot  ${target}`);
  console.log(`          commit ${short(snapshot.commit)}, sourceDigest ${short(snapshot.sourceDigest)}`);
  console.log(`Bundles   ${bundlesBase}`);
  console.log(`Repo      ${repo}\n`);

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
  if (freshness.status === "historical") {
    console.log("           valid for its commit; source records have changed since");
  } else if (freshness.status === "not-on-ref") {
    console.log(`           the snapshot's commit is not an ancestor of ${freshness.ref}`);
  }
}
process.exit(exitCode);
