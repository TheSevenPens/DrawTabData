// JSON stdin bridge for importers written in other languages. All writes
// still use the same TypeScript validation and transaction boundary.
import * as fs from "node:fs";
import * as path from "node:path";
import { commitDatasetUpdate, type RecordUpdate } from "../lib/update-dataset.js";
import { sourceCollection } from "../lib/sources.js";
const at = process.argv.indexOf("--repo-root");
if (at < 0 || !process.argv[at + 1]) throw new Error("--repo-root is required");
const root = path.resolve(process.argv[at + 1]);
const input: unknown = JSON.parse(fs.readFileSync(0, "utf8"));
if (!Array.isArray(input)) throw new Error("Expected an array of record updates on stdin");
const updates: RecordUpdate[] = input.map(item => {
  if (!item || typeof item.collection !== "string" || !item.record || typeof item.record !== "object" || Array.isArray(item.record)) {
    throw new Error("Each update needs a collection and record object");
  }
  return { collection: sourceCollection(item.collection).name, record: item.record };
});
const result = commitDatasetUpdate(root, updates, { dryRun: process.argv.includes("--dry-run") });
console.log(JSON.stringify(result));
