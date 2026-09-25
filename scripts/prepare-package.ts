// npm pack gets publication provenance without overwriting tracked metadata.
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDataset } from "../lib/generate-dataset.js";
import { buildVersionInfo } from "../lib/version-info.js";
import { writeDataJson } from "../lib/data-json.js";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const checked = generateDataset(root, { write: false });
if (checked.sourceIssues.length || checked.changed.length || checked.missing.length || checked.extra.length) {
  throw new Error("Package inputs are invalid or stale. Run generate --check before packing.\n" + JSON.stringify(checked));
}
const snapshot = buildVersionInfo(root);
if (snapshot.provenance.dirty && process.env.CI && process.env.CI !== "false" && process.env.CI !== "0") {
  throw new Error("Cannot package dirty data inputs in CI");
}
if (snapshot.provenance.dirty) console.warn("Packing local changes; the snapshot is marked dirty and cannot reproduce from HEAD.");
writeDataJson(path.join(root, "package-snapshot.json"), snapshot);
