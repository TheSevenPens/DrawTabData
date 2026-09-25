// ONE-TIME migration per collection (RFC #45): split a collection's brand
// bundles into one source file per record, then regenerate the bundles
// from those sources. Kept in the repo as the record of how each split
// was made; it refuses a collection whose source/<collection>/ exists.
//
//   npx tsx scripts/split-sources.ts <collection> [<collection> ...]
//
// Done so far: tablets + pens (e3cf06e, phase 3), pressure-response
// (phase 5). Afterwards source/<collection> is the editable copy and
// data/<collection>/* is generated (scripts/generate.ts).
//
// Proof it's a pure re-layout: after generation, each bundle is compared
// against the ORIGINAL records re-sorted by EntityId (deepStrictEqual,
// then key order). The only change the split may make is record order
// within a brand file.

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { readDataJson, writeDataJson } from "../lib/data-json.js";
import {
  SOURCE_COLLECTIONS,
  compareEntityIds,
  existingBundles,
  generateBundles,
  sourceCollection,
  sourcePath,
} from "../lib/sources.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error(`Usage: npx tsx scripts/split-sources.ts <${SOURCE_COLLECTIONS.map((c) => c.name).join("|")}> ...`);
  process.exit(1);
}
const toSplit = names.map(sourceCollection);
for (const c of toSplit) {
  if (fs.existsSync(path.join(repoRoot, "source", c.name))) {
    console.error(`source/${c.name}/ already exists — that split has been done. Edit source/ and run scripts/generate.ts.`);
    process.exit(1);
  }
}

type Rec = Record<string, unknown>;
const originals = new Map<string, Rec[]>(); // bundle path -> records as they were

for (const c of toSplit) {
  let written = 0;
  for (const rel of existingBundles(repoRoot, c)) {
    const records = readDataJson<Record<string, Rec[]>>(path.join(repoRoot, rel))[c.rootKey];
    assert.ok(Array.isArray(records), `${rel}: no ${c.rootKey} array`);
    originals.set(rel, records);
    const fileBrand = path.basename(rel).slice(0, -`-${c.name}.json`.length);
    for (const rec of records) {
      const entityId = c.entityId(rec);
      const brand = c.brand(rec);
      assert.ok(typeof entityId === "string" && entityId, `${rel}: record without EntityId`);
      assert.ok(typeof brand === "string" && brand, `${rel}: ${entityId} has no Brand`);
      assert.strictEqual(brand, fileBrand, `${rel}: ${entityId} has Brand ${brand}`);
      const target = path.join(repoRoot, sourcePath(c, brand, entityId));
      assert.ok(!fs.existsSync(target), `duplicate EntityId ${entityId}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      writeDataJson(target, rec);
      written++;
    }
  }
  console.log(`${c.name}: ${written} source files written`);
}

const result = generateBundles(repoRoot, { write: true });
if (result.sourceIssues.length) {
  for (const i of result.sourceIssues) console.error(`${i.file}: ${i.problem}`);
  throw new Error("source problems after split — nothing regenerated");
}

const keyOrder = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(keyOrder) : v && typeof v === "object" ? Object.entries(v).map(([k, x]) => [k, keyOrder(x)]) : v;

let reordered = 0;
for (const c of toSplit) {
  for (const rel of existingBundles(repoRoot, c)) {
    const before = originals.get(rel);
    assert.ok(before, `${rel}: generated a bundle that didn't exist before`);
    const expected = [...before].sort((a, b) => compareEntityIds(String(c.entityId(a)), String(c.entityId(b))));
    const after = readDataJson<Record<string, Rec[]>>(path.join(repoRoot, rel))[c.rootKey];
    assert.deepStrictEqual(after, expected, `${rel}: content differs beyond record order`);
    assert.deepStrictEqual(keyOrder(after), keyOrder(expected), `${rel}: key order differs`);
    if (before.some((r, i) => r !== expected[i])) reordered++;
  }
}
assert.strictEqual(
  [...originals.keys()].length,
  toSplit.flatMap((c) => existingBundles(repoRoot, c)).length,
  "bundle set changed",
);
console.log(`Verified: every bundle equals its original records sorted by EntityId (${reordered} bundle(s) reordered).`);
