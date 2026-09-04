// Parser for the MacHollywood "Wacom Tablets and Cintiqs with Compatible Pens"
// reference page (https://machollywood.com/blogs/news/wacom-tablets-and-cintiqs-with-compatible-pens).
//
// Two jobs, both pure:
//   extractPageText(html) -> the article body as plain text (the .txt we keep)
//   parsePageText(text)   -> a structured, LOSSLESS view of that text
//
// "Lossless" is a hard guarantee, not a goal: every segment keeps its source
// lines verbatim in `rawLines`, every separator line is kept verbatim, and
// reconstructText(dataset) must reproduce the input text byte for byte.
// machollywood.test.ts asserts that round trip against the checked-in file.
//
// Parsed fields are therefore ADDITIVE - an interpretation laid beside the
// text, never a replacement for it. Nothing here rewrites, normalises or
// "fixes" a value; entity mapping happens separately in
// scripts/annotate-machollywood-compat.ts so this stays a faithful mirror.

/** Provenance for one capture of the page. */
export interface MacHollywoodSource {
  url: string;
  site: string;
  title: string;
  /** Byline as printed on the page. */
  author?: string;
  /** Post date from the page's <time pubdate>. */
  posted?: string;
  /** The page's own "(Updated as of ...)" line, verbatim. */
  pageUpdated?: string;
  /** When we fetched it (UTC date). */
  retrievedAt: string;
  /** sha256 of the extracted .txt - changes iff the page text changed. */
  textSha256: string;
}

export type SegmentKind = "preamble" | "record" | "note" | "footer";

/** One record: a tablet/display model and the pens the page lists for it. */
export interface MacHollywoodRecord {
  /** Stable slug derived from the heading; the key annotations join on. */
  id: string;
  /** Enclosing "| ... |" section, e.g. "Pen Displays". */
  section: string | null;
  /** Sub-heading under the section, e.g. "Cintiqs". */
  group: string | null;
  /** Heading verbatim (may be two source lines, joined with " "). */
  heading: string;
  /** The "<Pen> included." line, verbatim, when present. */
  includedPen: string | null;
  /** Prose lines between the included-pen line and the SKU line. */
  description: string[];
  /** The "SKU:" / "SKUs:" line verbatim, when present. */
  skuLine: string | null;
  /** Bullet lines ("- Nibs for Included Pen: ..."), verbatim, without the dash. */
  bullets: string[];
  /** Lines under "Pen Compatibility", or the "Compatible Pen:" line, verbatim. */
  compatibility: string[];
}

/** One segment of the page: the lines between two separator rules. */
export interface MacHollywoodSegment {
  index: number;
  kind: SegmentKind;
  /** Source lines, verbatim, including blank lines. */
  rawLines: string[];
  /** The separator line that followed this segment, verbatim, or null at EOF. */
  separatorAfter: string | null;
  /** Present when kind === "record". */
  record?: MacHollywoodRecord;
}

export interface MacHollywoodDataset {
  source: MacHollywoodSource;
  segments: MacHollywoodSegment[];
}

const SEPARATOR = /^_+$/;
const SECTION = /^\|\s*(.+?)\s*\|$/;
const INCLUDED = /\bincluded\.?$/i;
const SKU_LINE = /^SKUs?:/i;
const COMPAT_HEADER = /^Pen Compatibility$/i;
const COMPAT_INLINE = /^Compatible Pens?:/i;
const BULLET = /^-\s+/;

/**
 * Pull the article body out of the page HTML and render it as plain text.
 *
 * The body is the `<div class="rte">` Shopify wraps blog content in; block
 * tags become newlines, runs of blank lines collapse to one, and lines are
 * trimmed. Deliberately hand-rolled rather than a DOM library: the output is
 * a checked-in artifact, so it must be reproducible from this code alone.
 */
export function extractPageText(html: string): string {
  const rte = html.indexOf('class="rte"');
  if (rte < 0) throw new Error('article body (<div class="rte">) not found');
  const start = html.lastIndexOf("<div", rte);

  const tag = /<(\/?)div\b/gi;
  tag.lastIndex = start;
  let depth = 0;
  let end = -1;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html)) !== null) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) {
      end = html.indexOf(">", m.index) + 1;
      break;
    }
  }
  if (end < 0) throw new Error("unterminated article body div");

  let t = html.slice(start, end);
  t = t.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n");
  t = t.replace(/<li\b[^>]*>/gi, "");
  t = t.replace(/<[^>]+>/g, "");
  t = decodeEntities(t).replace(/\u00a0/g, " ");

  const out: string[] = [];
  for (const line of t.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" && out[out.length - 1] === "") continue;
    out.push(trimmed);
  }
  return out.join("\n").trim() + "\n";
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (full, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1] === "x" || body[1] === "X"
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    // Unknown named entities are left verbatim rather than guessed at.
    return NAMED_ENTITIES[body] ?? full;
  });
}

/** Split the page text into segments on its horizontal `______` rules. */
function splitSegments(text: string): { lines: string[]; separatorAfter: string | null }[] {
  const segments: { lines: string[]; separatorAfter: string | null }[] = [];
  let current: string[] = [];
  // The trailing "" from the file's final newline is dropped here and restored
  // by reconstructText, which re-adds the newline.
  const lines = text.replace(/\n$/, "").split("\n");
  for (const line of lines) {
    if (SEPARATOR.test(line)) {
      segments.push({ lines: current, separatorAfter: line });
      current = [];
    } else {
      current.push(line);
    }
  }
  segments.push({ lines: current, separatorAfter: null });
  return segments;
}

/** Reassemble the source text from a parsed dataset. Must be an exact round trip. */
export function reconstructText(dataset: MacHollywoodDataset): string {
  const parts: string[] = [];
  for (const seg of dataset.segments) {
    parts.push(...seg.rawLines);
    if (seg.separatorAfter !== null) parts.push(seg.separatorAfter);
  }
  return parts.join("\n") + "\n";
}

/**
 * Parse the extracted page text into segments, classifying each and pulling
 * structured fields out of the record ones.
 */
export function parsePageText(text: string, source: MacHollywoodSource): MacHollywoodDataset {
  const raw = splitSegments(text);
  const segments: MacHollywoodSegment[] = [];

  let section: string | null = null;
  let group: string | null = null;
  let seenSection = false;
  // Everything from the closing prose on is chrome: store links, "Back to Top".
  let inFooter = false;
  const seenIds = new Set<string>();

  raw.forEach((seg, index) => {
    const content = seg.lines.filter((l) => l.trim() !== "");

    const sectionLine = content.find((l) => SECTION.test(l) && !/back to top/i.test(l));
    if (sectionLine) {
      section = SECTION.exec(sectionLine)![1];
      group = null;
      seenSection = true;
    }

    if (content.some((l) => /^Many of the older tablets/i.test(l))) inFooter = true;

    const record = seenSection && !inFooter ? parseRecord(seg.lines) : null;
    if (record) {
      record.section = section;
      if (record.group) group = record.group;
      else record.group = group;
      record.id = uniqueId(record.id, seenIds);
    }

    let kind: SegmentKind;
    if (record) kind = "record";
    else if (inFooter) kind = "footer";
    else if (seenSection) kind = "note";
    else kind = "preamble";

    segments.push({
      index,
      kind,
      rawLines: seg.lines,
      separatorAfter: seg.separatorAfter,
      ...(record ? { record } : {}),
    });
  });

  return { source, segments };
}

/**
 * Parse one segment as a record, or return null if it isn't one.
 *
 * Two shapes appear on the page:
 *   full  - heading / "<Pen> included." / prose / SKU line / "Pen Compatibility" + lines
 *   short - heading / "Compatible Pen: ..."   (the "Tablets Not Shown Above" list)
 * The heading may span two source lines (name on one, SKU pattern on the next).
 */
function parseRecord(lines: string[]): MacHollywoodRecord | null {
  const includedAt = lines.findIndex((l) => l.trim() !== "" && INCLUDED.test(l.trim()));
  const inlineAt = lines.findIndex((l) => COMPAT_INLINE.test(l.trim()));
  const isFull = includedAt >= 0;
  const anchor = isFull ? includedAt : inlineAt;
  if (anchor < 0) return null;

  // Heading: the contiguous non-blank lines directly above the anchor.
  let i = anchor - 1;
  while (i >= 0 && lines[i].trim() === "") i--;
  const headingLines: string[] = [];
  while (i >= 0 && lines[i].trim() !== "") {
    headingLines.unshift(lines[i].trim());
    i--;
  }
  if (headingLines.length === 0) return null;

  // A group label ("Cintiqs") sits above the heading, separated by a blank
  // line, in the same segment as the section marker.
  let detectedGroup: string | null = null;
  while (i >= 0 && lines[i].trim() === "") i--;
  if (i >= 0) {
    const candidate = lines[i].trim();
    if (candidate !== "" && !SECTION.test(candidate)) detectedGroup = candidate;
  }

  const heading = headingLines.join(" ");
  const record: MacHollywoodRecord = {
    id: slugify(heading),
    section: null,
    group: detectedGroup,
    heading,
    includedPen: isFull ? lines[includedAt].trim() : null,
    description: [],
    skuLine: null,
    bullets: [],
    // A short record's anchor line is itself the compatibility statement.
    compatibility: isFull ? [] : [lines[anchor].trim()],
  };

  let inCompat = false;
  for (let j = anchor + 1; j < lines.length; j++) {
    const line = lines[j].trim();
    if (line === "") continue;
    if (COMPAT_HEADER.test(line)) {
      inCompat = true;
      continue;
    }
    if (COMPAT_INLINE.test(line)) {
      record.compatibility.push(line);
      continue;
    }
    if (inCompat) {
      record.compatibility.push(line);
      continue;
    }
    if (SKU_LINE.test(line)) {
      record.skuLine = line;
      continue;
    }
    if (BULLET.test(line)) {
      record.bullets.push(line.replace(BULLET, ""));
      continue;
    }
    record.description.push(line);
  }

  return record;
}

/** Heading -> lowercase slug, e.g. "Cintiq Pro 24 (DTK/H-2420K0)" -> "cintiq-pro-24-dtk-h-2420k0". */
export function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Two Cintiq 21UX and two Cintiq 17SX records share a name on the page, so
 * their slugs collide; suffix later ones rather than silently overwriting.
 */
function uniqueId(id: string, seen: Set<string>): string {
  let candidate = id;
  let n = 2;
  while (seen.has(candidate)) candidate = `${id}-${n++}`;
  seen.add(candidate);
  return candidate;
}

/** All record segments, in page order. */
export function records(dataset: MacHollywoodDataset): MacHollywoodRecord[] {
  return dataset.segments.flatMap((s) => (s.record ? [s.record] : []));
}

// ---------------------------------------------------------------------------
// Token extraction
//
// Pulling model/pen codes out of the prose is where interpretation starts, so
// it is deliberately dumb: find things shaped like a Wacom code, keep them
// verbatim alongside the line they came from, and let the annotation step
// decide what (if anything) they map to. No normalisation, no de-duping of
// variants, no expansion of ranges like "EP150E to EP155E" - the raw token
// and its context line always travel together.
// ---------------------------------------------------------------------------

/** A code found in the page text, with where it was found. */
export interface CodeToken {
  /** The code exactly as printed. */
  token: string;
  /** Which record field it came from. */
  from: "heading" | "skuLine" | "includedPen" | "compatibility" | "bullets";
  /** The whole line it appeared in, verbatim. */
  context: string;
}

// Tablet SKUs: 2-4 letters then digits, e.g. CTL4100, DTHW1321HK0A, ET-0405A.
const SKU_TOKEN = /\b[A-Z]{2,4}-?\d[A-Z0-9]*(?:-[A-Z0-9]+)*\b/g;
// Pen codes: a two-letter family then digits, e.g. KP504E, LP1100K, ZP501E.
// The trailing (?:\/[A-Z]+)* keeps multi-variant forms like LP170G/K/ES whole.
const PEN_TOKEN = /\b(?:KP|LP|ZP|XP|GP|EP|UP|FP|CP|SP|MP|DP)-?\d[A-Z0-9]*(?:-\d[A-Z0-9]*)?(?:\/[A-Z0-9]+)*\b/g;

/**
 * Tablet SKUs for a record: from the "SKU:"/"SKUs:" line when there is one,
 * otherwise from the heading (the short "Tablets Not Shown Above" entries
 * print their SKU in the heading and nowhere else).
 */
export function extractSkuTokens(record: MacHollywoodRecord): CodeToken[] {
  if (record.skuLine) return matchAll(record.skuLine, SKU_TOKEN, "skuLine");
  return matchAll(record.heading, SKU_TOKEN, "heading");
}

/**
 * Pen codes for a record: every code in the compatibility lines, plus any in
 * the included-pen line. A code repeated across lines is returned once per
 * occurrence, since each occurrence has its own context.
 */
export function extractPenTokens(record: MacHollywoodRecord): CodeToken[] {
  const out: CodeToken[] = [];
  if (record.includedPen) out.push(...matchAll(record.includedPen, PEN_TOKEN, "includedPen"));
  for (const line of record.compatibility) out.push(...matchAll(line, PEN_TOKEN, "compatibility"));
  return out;
}

function matchAll(line: string, re: RegExp, from: CodeToken["from"]): CodeToken[] {
  return [...line.matchAll(new RegExp(re.source, re.flags))].map((m) => ({
    token: m[0],
    from,
    context: line,
  }));
}

/**
 * Strip everything but letters and digits, and upper-case.
 *
 * The page writes "DTH3220K0" where we write "DTH-3220"; comparing on this
 * form is the only liberty the matcher takes. It never edits stored data -
 * both the page token and our EntityId are kept as they are.
 */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
