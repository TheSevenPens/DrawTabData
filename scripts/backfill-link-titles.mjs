#!/usr/bin/env -S npx tsx
/**
 * Link checker + title backfill for data/tablets/*.json.
 *
 * For each link it fetches the URL once and records:
 *   - Title       : the page <title> (light-cleaned), only when the link has none.
 *   - ContentType : HTML | PDF | VIDEO | IMAGE | OTHER (host + extension + header).
 *   - Check       : { Status, CheckedAt, HttpStatus?, FinalUrl? } where Status is
 *                   OK | DEAD (404/410) | BLOCKED (401/403) | ERROR (timeout/5xx) |
 *                   REDIRECT (reachable but the stored URL now lands elsewhere).
 *
 * Touched files are written with writeDataJson() (lib/data-json.ts), so they
 * stay canonical and unchanged links don't churn.
 *
 * Usage: npx tsx scripts/backfill-link-titles.mjs [options]
 *   (tsx, not node: it imports lib/data-json.ts)
 *   --brand WACOM[,HUION]   only tablets of these brands
 *   --limit N               only the first N distinct URLs (staged runs)
 *   --concurrency N         parallel fetches (default 6)
 *   --recheck               re-check links that already have a Check (refresh)
 *   --dry-run               fetch + report, do not write
 *   --verbatim              keep the raw <title> (skip the site-name strip)
 *   --data-dir DIR          data directory to use (default: data/)
 *
 * Default (no --recheck) only touches links missing a Check, so re-runs are cheap.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readDataJson, writeDataJson } from "../lib/data-json.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
const dataDirOpt = getOpt("data-dir");
const TABLETS_DIR = path.join(
  typeof dataDirOpt === "string" ? path.resolve(dataDirOpt) : path.join(__dirname, "..", "data"),
  "tablets",
);

const inBrand = (t) => !brands || brands.includes(t.Model.Brand);

// ---- collect distinct URLs needing work ----
const files = fs.readdirSync(TABLETS_DIR).filter((f) => f.endsWith("-tablets.json"));
const urlInstances = new Map(); // url -> instance count
for (const f of files) {
  const j = readDataJson(path.join(TABLETS_DIR, f));
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

// Redirect key: ignore scheme (http↔https upgrade isn't "stale"), hash, trailing
// slash, and canonicalize YouTube to its video id (so youtu.be shortlinks
// expanding to youtube.com/watch aren't flagged) — REDIRECT then means a genuine
// host/path move.
const normUrl = (u) => {
  try {
    const x = new URL(u);
    const host = x.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return "yt:" + x.pathname.slice(1).split("/")[0];
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = x.searchParams.get("v");
      const seg = x.pathname.match(/\/(?:live|shorts|embed)\/([^/?#]+)/);
      if (v || seg) return "yt:" + (v || seg[1]);
    }
    return host + x.pathname.replace(/\/$/, "") + x.search;
  } catch {
    return u;
  }
};

// ---- check one URL (retries transient network errors) ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hostOf = (u) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};

// YouTube throttles page fetches; use its oembed endpoint (built for programmatic
// use) for liveness + title. ContentType is VIDEO by host, no page fetch needed.
async function checkYouTube(url, attempt = 0) {
  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) },
    );
    if (r.ok) {
      let title;
      try {
        const j = await r.json();
        if (j.title) title = cleanTitle(j.title);
      } catch {
        /* ignore */
      }
      return { status: "OK", httpStatus: 200, contentType: "VIDEO", title };
    }
    // 401/403/404/400 from oembed = video removed/private/invalid.
    return {
      status: [400, 401, 404].includes(r.status) ? "DEAD" : "BLOCKED",
      httpStatus: r.status,
      contentType: "VIDEO",
    };
  } catch (e) {
    if (attempt < 2) {
      await sleep(600 * (attempt + 1));
      return checkYouTube(url, attempt + 1);
    }
    return { status: "ERROR", contentType: "VIDEO", error: "oembed " + e.name };
  }
}

async function checkUrl(url, attempt = 0) {
  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(hostOf(url))) return checkYouTube(url);
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
    if (attempt < 2) {
      await sleep(600 * (attempt + 1)); // transient (timeout/reset) — back off and retry
      return checkUrl(url, attempt + 1);
    }
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

// ---- key order for a link object ----
// LinkSchema order, so a newly added Title lands before Author rather than at
// the end. Unknown keys (none — the schema is strict) would trail, not vanish.
const LINK_KEYS = ["Type", "URL", "Title", "Author", "PublishDate", "ContentType", "Check"];
const CHECK_KEYS = ["Status", "CheckedAt", "HttpStatus", "FinalUrl"];
const inKeyOrder = (obj, keys) =>
  Object.fromEntries([
    ...keys.filter((k) => obj[k] != null).map((k) => [k, obj[k]]),
    ...Object.entries(obj).filter(([k]) => !keys.includes(k)),
  ]);
const orderLink = (l) => {
  const o = inKeyOrder(l, LINK_KEYS);
  if (o.Check) o.Check = inKeyOrder(o.Check, CHECK_KEYS);
  return o;
};

// ---- apply to files (parse -> mutate -> writeDataJson) ----
const stats = { status: {}, contentType: {}, titled: 0, objects: 0, tablets: 0, errored: 0 };
for (const f of files) {
  const fp = path.join(TABLETS_DIR, f);
  const j = readDataJson(fp);
  let fileChanged = false;

  for (const t of j.DrawingTablets ?? []) {
    if (!inBrand(t)) continue;
    const links = t.Model.Links;
    if (!links?.length || !links.some((l) => results.has(l.URL))) continue;

    let mutated = false;
    for (const l of links) {
      const r = results.get(l.URL);
      if (!r) continue;
      // ERROR = no HTTP response (timeout/DNS/reset) — likely transient. Don't
      // persist it; leave the link unchecked so a re-run retries it.
      if (r.status === "ERROR") {
        stats.errored++;
        continue;
      }
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
      mutated = true;
    }
    if (!mutated) continue;
    stats.tablets++;
    t.Model.Links = links.map(orderLink);
    fileChanged = true;
  }
  if (fileChanged && !dryRun) writeDataJson(fp, j);
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
    : `\nWrote ${stats.objects} link checks (${stats.titled} new titles) across ${stats.tablets} tablets.` +
        (stats.errored ? ` Left ${stats.errored} ERROR link(s) unchecked (re-run to retry).` : ""),
);
