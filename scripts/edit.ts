// Edit one tablet, pen or pressure session by EntityId (RFC #45).
//
//   npx tsx scripts/edit.ts <EntityId> Field=value [Field:=json ...] [--unset Field] [--dry-run] [--force]
//
//   npx tsx scripts/edit.ts wacom.pen.kp504e ReleaseYear=2016
//   npx tsx scripts/edit.ts xppen.tablet.g430s Digitizer.PressureLevels=8192 Digitizer.Tilt=60
//   npx tsx scripts/edit.ts ugee.tablet.m708 'Model.IncludedPen:=["ugee.pen.p50s"]'
//   npx tsx scripts/edit.ts wacom.tablet.fb630 --unset Model.IncludedPen
//
// Field=value sets a string (a number where the field already holds one);
// Field:=json sets any JSON value. Bare names resolve when unambiguous
// (ReleaseYear on a tablet is Model.ReleaseYear). The record must pass its
// schema before anything is written; identity fields are refused. After
// writing it regenerates the bundles and runs data-quality — if the edit
// introduced an issue (here or on a record that references it), the file
// is put back (--force keeps it). See lib/edit-record.ts.
//
//   --repo-root <dir>   edit a copy of the data-repo instead of this one

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { editRecord, parseAssignments } from "../lib/edit-record.js";

const argv = process.argv.slice(2);
const take = (flag: string): string[] => {
  const out: string[] = [];
  for (let i = argv.indexOf(flag); i >= 0; i = argv.indexOf(flag)) out.push(...argv.splice(i, 2).slice(1));
  return out;
};
const unset = take("--unset");
const [repoRootArg] = take("--repo-root");
const dryRun = argv.includes("--dry-run");
const force = argv.includes("--force");
const [entityId, ...rest] = argv.filter((a) => a !== "--dry-run" && a !== "--force");

if (!entityId || (rest.length === 0 && unset.length === 0)) {
  console.error("Usage: npx tsx scripts/edit.ts <EntityId> Field=value [Field:=json ...] [--unset Field] [--dry-run] [--force]");
  process.exit(2);
}

const repoRoot = repoRootArg
  ? path.resolve(repoRootArg)
  : path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const show = (x: unknown) => (x === undefined ? "(unset)" : JSON.stringify(x));

try {
  const out = editRecord(repoRoot, entityId, parseAssignments(rest, unset), { dryRun, force });
  console.log(`${entityId} (${out.collection.name})`);
  for (const c of out.changes) console.log(`  ${c.path}: ${show(c.before)} -> ${show(c.after)}`);
  if (out.newIssues.length) {
    console.log(`\nData quality — new issue(s) this edit would cause:`);
    for (const i of out.newIssues) {
      console.log(`  ${i.entityId} ${i.field}: ${i.issue}${i.value ? ` (${i.value})` : ""}`);
    }
  }
  if (dryRun) console.log("\n--dry-run: nothing written.");
  else if (!out.written) {
    console.log("\nReverted: the source file is back as it was. Fix the data, or rerun with --force to keep it.");
    process.exit(1);
  } else console.log("\nWritten; bundles regenerated. Commit the source file and its bundle together.");
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
