#!/usr/bin/env node
/**
 * Link checker + title backfill for data/tablets/*.json.
 *
 * For each link it fetches the URL once and records, format-preserving:
 *   - Title       : the page <title> (light-cleaned), only when the link has none.
 *   - ContentType : HTML | PDF | VIDEO | IMAGE | OTHER (host + extension + header).
 *   - Check       : { Status, CheckedAt, HttpStatus?, FinalUrl? } where Status is
 *                   OK | DEAD (404/410) | BLOCKED (401/403) | ERROR (timeout/5xx) |
 *                   REDIRECT (reachable but the stored URL now lands elsewhere).
 *
 * The whole Links array of each touched tablet is re-rendered in the existing
 * hand-format (1-space object colons), so unchanged links don't churn.
 *
 * Usage: node scripts/backfill-link-titles.mjs [options]
 *   --brand WACOM[,HUION]   only tablets of these brands
 *   --limit N               only the first N distinct URLs (staged runs)
 *   --concurrency N         parallel fetches (default 6)
 *   --recheck               re-check links that already have a Check (refresh)
 *   --dry-run               fetch + report, do not write
 *   --verbatim              keep the raw <title> (skip the site-name strip)
 *
 * Default (no --recheck) only touches links missing a Check, so re-runs are cheap.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TABLETS_DIR = path.join(__dirname, "..", "data", "tablets");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const RUN_AT = new Date().toISOString();

// ---- args ----
const argv = process.argv.slice(2);
const getOpt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true) : undefined;
};
const brands = getOpt("brand") ? String(getOpt("brand")).toUpperCase().split(",") : null;
const limit = getOpt("limit") ? Number(getOpt("limit")) : Infinity;
const concurrency = getOpt("concurrency") ? Number(getOpt("concurrency")) : 6;
const recheck = !!getOpt("recheck");
const dryRun = !!getOpt("dry-run");
const verbatim = !!getOpt("verbatim");

const inBrand = (t) => !brands || brands.includes(t.Model.Brand);

// ---- collect distinct URLs needing work ----
const files = fs.readdirSync(TABLETS_DIR).filter((f) => f.endsWith("-tablets.json"));
const urlInstances = new Map(); // url -> instance count
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(TABLETS_DIR, f), "utf8"));
  for (const t of j.DrawingTablets ?? []) {
    if (!inBrand(t)) continue;
    for (const l of t.Model.Links ?? []) {
      if (l.Check && !recheck) continue; // already checked
      urlInstances.set(l.URL, (urlInstances.get(l.URL) ?? 0) + 1);
    }
  }
}
let urls = [...urlInstances.keys()].sort();
if (Number.isFinite(limit)) urls = urls.slice(0, limit);
console.log(
  `${urls.length} distinct URL(s) to check${brands ? " for " + brands.join(",") : ""}` +
    (Number.isFinite(limit) ? " (limited)" : "") +
    (recheck ? " (recheck)" : ""),
);

// ---- title cleaning ----
const JUNK_TITLE =
  /^(untitled|home|null|error|not found)$|product not available|page not found|access denied|forbidden|are you a robot|just a moment|attention required/i;
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—" };
const decodeEntities = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
const SITE_HINTS =
  /(wacom|huion|xp-?pen|xppen|gaomon|xencelabs|ugee|veikk|parblo|amazon|youtube|parka\s?blogs|official|store|shop|\.com|drawing\s?tablet)/i;
function cleanTitle(raw) {
  let t = decodeEntities(raw).replace(/\s+/g, " ").trim();
  if (verbatim) return t;
  for (const sep of [" | ", " — ", " – ", " - "]) {
    const idx = t.lastIndexOf(sep);
    if (idx > 8) {
      const tail = t.slice(idx + sep.length);
      if (SITE_HINTS.test(tail) && tail.length <= 40) t = t.slice(0, idx).trim();
    }
  }
  return t;
}

// ---- content-type classification (host + extension + header) ----
function classifyContentType(url, header) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* keep "" */
  }
  if (/youtube\.com|youtu\.be|vimeo\.com/i.test(host) || /^video\//i.test(header)) return "VIDEO";
  if (/\.pdf(\?|#|$)/i.test(url) || /application\/pdf/i.test(header)) return "PDF";
  if (/^image\//i.test(header) || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url)) return "IMAGE";
  if (/text\/html|application\/xhtml/i.test(header)) return "HTML";
  if (!header) return /^https?:/i.test(url) ? "HTML" : "OTHER"; // couldn't read header
  return "OTHER";
}

// Redirect key: ignore scheme (http↔https upgrade isn't "stale"), hash, and a
// trailing slash — so REDIRECT flags only a genuine host/path move.
const normUrl = (u) => {
  try {
    const x = new URL(u);
    return x.hostname.toLowerCase() + x.pathname.replace(/\/$/, "") + x.search;
  } catch {
    return u;
  }
};

// ---- check one URL ----
async function checkUrl(url) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    const header = r.headers.get("content-type") ?? "";
    const contentType = classifyContentType(url, header);
    const redirected = normUrl(r.url) !== normUrl(url);
    let status;
    if (r.ok) status = redirected ? "REDIRECT" : "OK";
    else if ([404, 410].includes(r.status)) status = "DEAD";
    else if ([401, 403].includes(r.status)) status = "BLOCKED";
    else status = "ERROR";
    let title;
    if (r.ok && contentType === "HTML") {
      const html = await r.text();
      const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i);
      const raw = (m && m[1]) || (og && og[1]);
      if (raw && raw.trim()) {
        const c = cleanTitle(raw);
        if (c && !JUNK_TITLE.test(c)) title = c;
      }
    }
    return {
      status,
      httpStatus: r.status,
      finalUrl: redirected ? r.url : undefined,
      contentType,
      title,
    };
  } catch (e) {
    return {
      status: "ERROR",
      contentType: classifyContentType(url, ""),
      error: (e.name === "TimeoutError" ? "timeout" : e.message).slice(0, 40),
    };
  }
}

// ---- fetch pool ----
const results = new Map();
let cursor = 0;
async function worker() {
  while (cursor < urls.length) {
    const url = urls[cursor++];
    results.set(url, await checkUrl(url));
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) || 1 }, worker));

// ---- render a Links array body in the existing hand-format ----
function renderLinkObj(l, base) {
  const i2 = " ".repeat(base + 2),
    i4 = " ".repeat(base + 4),
    i6 = " ".repeat(base + 6);
  const props = [];
  for (const k of ["Type", "URL", "Title", "Author", "PublishDate", "ContentType"])
    if (l[k] != null) props.push(`${i4}"${k}": ${JSON.stringify(l[k])}`);
  if (l.Check) {
    const cp = [];
    for (const [k, v] of [
      ["Status", l.Check.Status],
      ["CheckedAt", l.Check.CheckedAt],
      ["HttpStatus", l.Check.HttpStatus],
      ["FinalUrl", l.Check.FinalUrl],
    ])
      if (v != null) cp.push(`${i6}"${k}": ${JSON.stringify(v)}`);
    props.push(`${i4}"Check": {\n${cp.join(",\n")}\n${i4}}`);
  }
  return `${i2}{\n${props.join(",\n")}\n${i2}}`;
}

// ---- apply to files (parse -> mutate -> re-render each touched Links array) ----
const stats = { status: {}, contentType: {}, titled: 0, objects: 0, tablets: 0 };
for (const f of files) {
  const fp = path.join(TABLETS_DIR, f);
  let text = fs.readFileSync(fp, "utf8");
  const j = JSON.parse(text);
  const mc = (text.match(/"Id":( +)"/)?.[1] ?? "  ").length;
  let fileChanged = false;

  for (const t of j.DrawingTablets ?? []) {
    if (!inBrand(t)) continue;
    const links = t.Model.Links;
    if (!links?.length || !links.some((l) => results.has(l.URL))) continue;

    for (const l of links) {
      const r = results.get(l.URL);
      if (!r) continue;
      if (r.title && !l.Title) {
        l.Title = r.title;
        stats.titled++;
      }
      l.ContentType = r.contentType;
      l.Check = {
        Status: r.status,
        CheckedAt: RUN_AT,
        ...(r.httpStatus != null ? { HttpStatus: r.httpStatus } : {}),
        ...(r.finalUrl ? { FinalUrl: r.finalUrl } : {}),
      };
      stats.status[r.status] = (stats.status[r.status] ?? 0) + 1;
      stats.contentType[r.contentType] = (stats.contentType[r.contentType] ?? 0) + 1;
      stats.objects++;
    }
    stats.tablets++;

    if (!dryRun) {
      const idKey = `"Id":${" ".repeat(mc)}"${t.Model.Id}",`;
      const idIdx = text.indexOf(idKey);
      const lineStart = text.lastIndexOf("\n", idIdx) + 1;
      const base = idIdx - lineStart;
      const openTag = `${" ".repeat(base)}"Links":${" ".repeat(mc)}[\n`;
      const ks = text.indexOf(openTag, idIdx);
      const bodyStart = ks + openTag.length;
      const bodyEnd = text.indexOf(`\n${" ".repeat(base)}]`, bodyStart);
      const body = links.map((l) => renderLinkObj(l, base)).join(",\n");
      text = text.slice(0, bodyStart) + body + text.slice(bodyEnd);
      fileChanged = true;
    }
  }
  if (fileChanged) fs.writeFileSync(fp, text);
}

// ---- report ----
const fetched = [...results.entries()];
console.log(`\n=== checked ${fetched.length} URLs ===`);
for (const [url, r] of fetched.sort((a, b) => a[1].status.localeCompare(b[1].status)))
  console.log(
    `  ${r.status.padEnd(8)} ${(r.contentType ?? "?").padEnd(6)} ${r.httpStatus ?? r.error ?? ""}` +
      `${r.title ? "  “" + r.title.slice(0, 50) + "”" : ""}\n           ${url}`,
  );
console.log(
  `\nstatus: ${JSON.stringify(stats.status)}\ncontentType: ${JSON.stringify(stats.contentType)}`,
);
console.log(
  dryRun
    ? `\nDRY RUN — no files written (${stats.objects} link objects would change).`
    : `\nWrote ${stats.objects} link checks (${stats.titled} new titles) across ${stats.tablets} tablets.`,
);
