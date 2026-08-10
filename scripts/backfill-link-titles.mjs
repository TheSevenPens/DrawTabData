#!/usr/bin/env node
/**
 * Backfill Link.Title from the linked page's HTML <title>.
 *
 * Many links in data/tablets/*.json have only Type/URL/Author (no Title), so the
 * UI falls back to showing the domain. This fetches each distinct titleless URL,
 * extracts + light-cleans its page title, and writes it as Link.Title on every
 * instance of that URL — format-preserving (inserts a "Title" line after "URL").
 *
 * Usage:
 *   node scripts/backfill-link-titles.mjs [options]
 *     --brand WACOM        only links on tablets of this brand (repeatable via comma: WACOM,HUION)
 *     --limit N            only process the first N distinct URLs (for staged runs)
 *     --concurrency N      parallel fetches (default 6)
 *     --dry-run            fetch + report, do not write files
 *     --verbatim           keep the raw <title> (skip the light-clean site-name strip)
 *
 * Idempotent: only links WITHOUT a Title are touched; re-running skips titled ones.
 * Skips: PDF URLs, and any fetch that fails / returns non-HTML / has no usable title
 * (all reported at the end so dead links surface).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TABLETS_DIR = path.join(__dirname, "..", "data", "tablets");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ---- args ----
const argv = process.argv.slice(2);
const getOpt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true) : undefined;
};
const brands = getOpt("brand") ? String(getOpt("brand")).toUpperCase().split(",") : null;
const limit = getOpt("limit") ? Number(getOpt("limit")) : Infinity;
const concurrency = getOpt("concurrency") ? Number(getOpt("concurrency")) : 6;
const dryRun = !!getOpt("dry-run");
const verbatim = !!getOpt("verbatim");

// ---- collect titleless URLs (brand-filtered) ----
const files = fs.readdirSync(TABLETS_DIR).filter((f) => f.endsWith("-tablets.json"));
const urlInstances = new Map(); // url -> count of titleless instances
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(TABLETS_DIR, f), "utf8"));
  for (const t of j.DrawingTablets ?? []) {
    if (brands && !brands.includes(t.Model.Brand)) continue;
    for (const l of t.Model.Links ?? []) {
      if (l.Title) continue;
      urlInstances.set(l.URL, (urlInstances.get(l.URL) ?? 0) + 1);
    }
  }
}
let urls = [...urlInstances.keys()];
urls.sort();
if (Number.isFinite(limit)) urls = urls.slice(0, limit);
console.log(
  `${urls.length} distinct titleless URL(s)${brands ? " for " + brands.join(",") : ""}` +
    (Number.isFinite(limit) ? ` (limited)` : ""),
);

// ---- helpers ----
const isPdf = (u) => /\.pdf(\?|#|$)/i.test(u);

// Placeholder/error titles that some live pages return (discontinued products,
// soft 404s, consent walls). Rejected so we never store them. Tweak as needed.
const JUNK_TITLE =
  /^(untitled|home|null|error|not found)$|product not available|page not found|access denied|forbidden|are you a robot|just a moment|attention required/i;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—" };
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

// Light clean: strip a trailing " | X" / " - X" / " — X" when X looks like a site
// name (brand/store/"official"/a bare hostname). Tweak SITE_HINTS to taste.
const SITE_HINTS =
  /(wacom|huion|xp-?pen|xppen|gaomon|xencelabs|ugee|veikk|parblo|amazon|youtube|parka\s?blogs|official|store|shop|\.com|drawing\s?tablet)/i;
function clean(raw) {
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

async function fetchTitle(url) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    const ct = r.headers.get("content-type") ?? "";
    if (!/html/i.test(ct)) return { ok: false, reason: `non-html (${ct.split(";")[0] || "?"})` };
    const html = await r.text();
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i);
    const rawTitle = (m && m[1]) || (og && og[1]);
    if (!rawTitle || !rawTitle.trim()) return { ok: false, reason: "no <title>" };
    const title = clean(rawTitle);
    // Placeholder / error page titles are worse than nothing — reject them.
    if (!title || JUNK_TITLE.test(title)) return { ok: false, reason: `junk ("${title}")` };
    return { ok: true, title };
  } catch (e) {
    return { ok: false, reason: (e.name === "TimeoutError" ? "timeout" : e.message).slice(0, 40) };
  }
}

// ---- fetch with a small concurrency pool ----
const results = new Map(); // url -> {ok,title|reason}
let cursor = 0;
async function worker() {
  while (cursor < urls.length) {
    const url = urls[cursor++];
    results.set(url, isPdf(url) ? { ok: false, reason: "pdf (skipped)" } : await fetchTitle(url));
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));

// ---- write titles back (format-preserving) ----
function insertTitle(text, url, title) {
  const esc = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // URL line (optional trailing comma) that is NOT already followed by a Title.
  const re = new RegExp(`^([ \\t]*)"URL": "${esc}"(,?)\\n(?!\\1"Title":)`, "gm");
  let n = 0;
  const out = text.replace(re, (_m, indent, comma) => {
    n++;
    const tval = JSON.stringify(title);
    return comma === ","
      ? `${indent}"URL": "${url}",\n${indent}"Title": ${tval},\n` // a field (Author/Date) follows
      : `${indent}"URL": "${url}",\n${indent}"Title": ${tval}\n`; // URL was last -> Title becomes last
  });
  return { out, n };
}

let titled = 0,
  objectsTitled = 0;
const okList = [],
  skipList = [];
for (const url of urls) {
  const r = results.get(url);
  if (!r.ok) {
    skipList.push([url, r.reason]);
    continue;
  }
  okList.push([url, r.title, urlInstances.get(url)]);
  titled++;
  if (!dryRun) {
    for (const f of files) {
      const fp = path.join(TABLETS_DIR, f);
      const { out, n } = insertTitle(fs.readFileSync(fp, "utf8"), url, r.title);
      if (n) {
        fs.writeFileSync(fp, out);
        objectsTitled += n;
      }
    }
  }
}

// ---- report ----
console.log(`\n=== titled (${okList.length} URLs${dryRun ? ", DRY RUN" : `, ${objectsTitled} link objects`}) ===`);
for (const [url, title, n] of okList) console.log(`  ${String(n).padStart(2)}×  ${title}\n       ${url}`);
console.log(`\n=== skipped (${skipList.length}) ===`);
for (const [url, reason] of skipList) console.log(`  [${reason}] ${url}`);
console.log(
  `\n${dryRun ? "DRY RUN — no files written." : `Wrote ${objectsTitled} titles across ${okList.length} URLs.`}`,
);
