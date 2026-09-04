// Captures the MacHollywood "Wacom Tablets and Cintiqs with Compatible Pens"
// page into data/machollywood/ as two artifacts:
//
//   machollywood-pen-compat.txt   the article body as plain text, verbatim
//   machollywood-pen-compat.json  a structured, lossless view of that text
//
// The .txt is the source of truth; the .json is derived from it and must
// round-trip back to it exactly (asserted here and in the parser's tests).
// Neither file is edited by hand - re-run this script to refresh, and let
// git diff show what the page changed. Entity mapping lives in the separate
// annotations file (see annotate-machollywood-compat.ts) so this stays a
// faithful mirror of someone else's page.
//
// Usage:
//   tsx scripts/extract-machollywood-compat.ts              # fetch and rewrite
//   tsx scripts/extract-machollywood-compat.ts --html p.html # parse a saved copy
//   tsx scripts/extract-machollywood-compat.ts --check       # verify, write nothing

import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  extractPageText,
  parsePageText,
  reconstructText,
  records,
  type MacHollywoodSource,
} from "../lib/reference/machollywood.js";

const URL_DEFAULT =
  "https://machollywood.com/blogs/news/wacom-tablets-and-cintiqs-with-compatible-pens";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "data", "machollywood");
const txtPath = path.join(outDir, "machollywood-pen-compat.txt");
const jsonPath = path.join(outDir, "machollywood-pen-compat.json");

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const htmlPath = flag("--html");
const url = flag("--url") ?? URL_DEFAULT;
const checkOnly = args.includes("--check");

const html = htmlPath
  ? readFileSync(htmlPath, "utf-8")
  : await fetchPage(url);

const text = extractPageText(html);
const source: MacHollywoodSource = {
  url,
  site: "machollywood.com",
  title: "Wacom Tablets and Cintiqs with Compatible Pens",
  ...pageMeta(html),
  pageUpdated: /\(Updated as of ([^)]+)\)/.exec(text)?.[1],
  retrievedAt: new Date().toISOString().slice(0, 10),
  textSha256: createHash("sha256").update(text, "utf-8").digest("hex"),
};

const dataset = parsePageText(text, source);

// The whole point of the format: if this ever fails, the JSON is lying about
// what the page says and must not be written.
const roundTrip = reconstructText(dataset);
if (roundTrip !== text) {
  const at = firstDifference(roundTrip, text);
  throw new Error(`lossless round trip failed at offset ${at}; refusing to write`);
}

const parsed = records(dataset);
console.log(`text:     ${text.length} bytes, ${text.split("\n").length} lines`);
console.log(`segments: ${dataset.segments.length}`);
console.log(`records:  ${parsed.length}`);
for (const section of new Set(parsed.map((r) => r.section))) {
  const n = parsed.filter((r) => r.section === section).length;
  console.log(`          ${n} in ${section}`);
}
const noCompat = parsed.filter((r) => r.compatibility.length === 0);
if (noCompat.length > 0) {
  console.log(`note:     ${noCompat.length} record(s) with no compatibility lines:`);
  for (const r of noCompat) console.log(`          ${r.id}`);
}

if (checkOnly) {
  const onDisk = readFileSync(txtPath, "utf-8");
  if (onDisk === text) {
    console.log("\ncheck: page text unchanged since last capture.");
  } else {
    console.log("\ncheck: PAGE TEXT HAS CHANGED - re-run without --check to update.");
    process.exitCode = 1;
  }
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(txtPath, text, "utf-8");
  writeFileSync(jsonPath, JSON.stringify(dataset, null, 2) + "\n", "utf-8");
  console.log(`\nwrote ${path.relative(process.cwd(), txtPath)}`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
}

async function fetchPage(target: string): Promise<string> {
  const res = await fetch(target, {
    headers: { "User-Agent": "DrawTabData reference capture (github.com/TheSevenPens/DrawTabData)" },
  });
  if (!res.ok) throw new Error(`GET ${target} -> ${res.status} ${res.statusText}`);
  return res.text();
}

/** Byline and post date, straight out of the article header markup. */
function pageMeta(source: string): { author?: string; posted?: string } {
  return {
    author: /Posted by <strong>([^<]+)<\/strong>/.exec(source)?.[1],
    posted: /<time pubdate datetime="([^"]+)"/.exec(source)?.[1],
  };
}

function firstDifference(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
}
