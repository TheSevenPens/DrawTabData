// The one way to read and write the dataset's JSON files (RFC #45 phase 1,
// fixes #43).
//
// Every tool that edits data/ used to serialise in its own way: some
// round-tripped the whole file through Windows PowerShell ConvertTo-Json
// (which read BOM-less UTF-8 as ANSI and double-encoded every non-ASCII
// character, escaped & and ' as & / ', and re-indented records
// written by other tools), some spliced text at hard-coded wide
// indentation, some used JSON.stringify. One added record could produce a
// 4,500-line diff.
//
// Canonical form, for every managed file:
//   - UTF-8, no BOM
//   - LF line endings, one trailing newline
//   - JSON.stringify(value, null, 2): two-space indent, key order as read,
//     non-ASCII / & / ' written literally, numbers in shortest form
//
// Readers stay tolerant (a BOM is skipped); the writer and checkFile() are
// strict so nothing non-canonical comes back.
//
// Only Node builtins and the file-plan helper on purpose — plain .mjs scripts can load this file
// through tsx without pulling in the rest of the library.

import * as fs from "node:fs";
import { atomicWriteFile } from "./file-plan.js";
import * as path from "node:path";

/**
 * Directories under data/ whose files are authored/edited by this project's
 * tools and must stay canonical. Third-party captures (otd/, machollywood/,
 * wacom-update/, links/) and version.json keep the format their own
 * extract scripts produce.
 */
export const MANAGED_DATA_DIRS = [
  "brands",
  "tablets",
  "pens",
  "pen-families",
  "tablet-families",
  "pen-compat",
  "drivers",
  "pressure-response",
  "pressure-range",
  "inventory",
  "reference",
] as const;

/** Canonical text for a value. */
export function formatDataJson(value: unknown): string {
  const keys = findIntegerLikeKeys(value);
  if (keys.length) {
    // JSON.parse moves integer-like keys to the front of an object, so
    // a round trip would silently reorder them.
    throw new Error(`integer-like object keys would be reordered: ${keys.slice(0, 5).join(", ")}`);
  }
  return JSON.stringify(value, null, 2) + "\n";
}

/**
 * Object keys that appear more than once in the same object, found by
 * scanning the text (JSON.parse silently keeps only the last one).
 * Returns "path: key" strings; empty when there are none.
 */
export function findDuplicateKeys(text: string): string[] {
  const out: string[] = [];
  const stack: { keys: Set<string> | null }[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      const raw = text.slice(i + 1, j);
      j++;
      let k = j;
      while (k < text.length && /\s/.test(text[k])) k++;
      const top = stack[stack.length - 1];
      if (text[k] === ":" && top?.keys) {
        const key = JSON.parse(`"${raw}"`) as string;
        if (top.keys.has(key)) out.push(key);
        top.keys.add(key);
      }
      i = j;
      continue;
    }
    if (c === "{") stack.push({ keys: new Set() });
    else if (c === "[") stack.push({ keys: null });
    else if (c === "}" || c === "]") stack.pop();
    i++;
  }
  return out;
}

/** Keys like "0" or "12" anywhere in the value (see formatDataJson). */
export function findIntegerLikeKeys(value: unknown, at = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findIntegerLikeKeys(v, `${at}[${i}]`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => [
    ...(/^(0|[1-9]\d*)$/.test(k) ? [`${at}.${k}`] : []),
    ...findIntegerLikeKeys(v, `${at}.${k}`),
  ]);
}

/** Parse dataset JSON: skips a BOM, rejects duplicate keys. */
export function parseDataJson(text: string, where = "input"): unknown {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const dups = findDuplicateKeys(body);
  if (dups.length) {
    throw new Error(`${where}: duplicate object keys (the last would silently win): ${[...new Set(dups)].join(", ")}`);
  }
  return JSON.parse(body);
}

export function readDataJson<T = unknown>(file: string): T {
  return parseDataJson(fs.readFileSync(file, "utf8"), file) as T;
}

/**
 * Write `value` to `file` in canonical form. Writes a sibling temp file and
 * renames it over the target, so an interrupted write can't leave a
 * half-written dataset file. Returns true when the bytes changed.
 */
export function writeDataJson(file: string, value: unknown): boolean {
  const text = formatDataJson(value);
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === text) return false;
  atomicWriteFile(file, text);
  return true;
}

export type FormatProblem = "invalid-json" | "bom" | "crlf" | "duplicate-keys" | "not-canonical";

export interface FormatIssue {
  file: string;
  problem: FormatProblem;
  detail?: string;
}

/** What's wrong with one file's text, if anything. Never modifies it. */
export function checkDataJsonText(text: string, file: string): FormatIssue[] {
  const issues: FormatIssue[] = [];
  if (text.charCodeAt(0) === 0xfeff) issues.push({ file, problem: "bom" });
  const crlf = (text.match(/\r\n/g) ?? []).length;
  if (crlf) {
    const lf = (text.match(/\n/g) ?? []).length;
    issues.push({ file, problem: "crlf", detail: crlf === lf ? "CRLF" : `mixed (${crlf} of ${lf} lines CRLF)` });
  }
  let value: unknown;
  try {
    value = parseDataJson(text, file);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    issues.push({ file, problem: msg.includes("duplicate") ? "duplicate-keys" : "invalid-json", detail: msg });
    return issues;
  }
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (formatDataJson(value) !== body.replace(/\r\n/g, "\n")) {
    issues.push({ file, problem: "not-canonical", detail: "formatting differs from formatDataJson()" });
  }
  return issues;
}

/** Managed data files under `dataDir`, sorted, as absolute paths. */
export function listManagedDataFiles(dataDir: string): string[] {
  return MANAGED_DATA_DIRS.flatMap((dir) => {
    const full = path.join(dataDir, dir);
    if (!fs.existsSync(full)) return [];
    return fs
      .readdirSync(full)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(full, f));
  }).sort();
}

/** Check every managed file (reads raw bytes, so the check itself is exact). */
export function checkManagedDataFiles(dataDir: string): FormatIssue[] {
  return listManagedDataFiles(dataDir).flatMap((file) =>
    checkDataJsonText(fs.readFileSync(file, "utf8"), path.relative(dataDir, file).replace(/\\/g, "/")),
  );
}
