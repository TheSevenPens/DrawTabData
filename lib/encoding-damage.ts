// Detection of text that survived a broken encoding round-trip.
//
// Two failures reach the dataset through the same door — extraction from
// vendor pages, which populates Links[].Title and the inventory ModelName
// fields:
//
//   * cp1252 mojibake — UTF-8 bytes decoded as cp1252 and re-encoded, so
//     XPPen's non-breaking space (C2 A0) became "Â" + NBSP. Lossless, and
//     therefore repairable: run the round-trip backwards.
//   * U+FFFD REPLACEMENT CHARACTER — the bytes are already gone. Nothing
//     here can recover the original; it has to come from the source again.
//
// The hard part is NOT finding damage, it's staying quiet about the 15
// legitimate non-ASCII characters in this dataset: en dashes in Wacom and
// Xencelabs link titles, the fullwidth bar ASUS uses in its own page title,
// Apple's non-breaking hyphen in "iPad Pro 11-inch", one deliberate em dash.
// A rule that flags non-ASCII reports 15 false positives to catch one real
// fault and gets switched off within a week.
//
// So the test is a round-trip rather than a character blocklist: text is
// mojibake only if every character maps back to a cp1252 byte AND those
// bytes are valid UTF-8 AND decoding them yields something different. That
// rejects the legitimate characters for structural reasons, not by listing
// them — an en dash becomes byte 0x96, a lone UTF-8 continuation byte that
// cannot start a sequence, so the decode fails and nothing is reported.

/** The replacement character, U+FFFD. */
const REPLACEMENT = "�";

/**
 * cp1252's 0x80-0x9F range, where it differs from latin-1. Every other
 * cp1252 byte equals its Unicode codepoint, so only these need a table.
 */
const CP1252_HIGH = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

export type EncodingDamageKind = "cp1252-mojibake" | "replacement-character";

export interface EncodingDamage {
  kind: EncodingDamageKind;
  /** Index of the first damaged character in the string. */
  index: number;
  /** Short window around the damage, for a report a human can act on. */
  excerpt: string;
  /** The original text, when the damage is reversible. Absent for U+FFFD. */
  repaired?: string;
}

/**
 * Encode `s` as cp1252 bytes, or null when any character has no cp1252
 * representation — which is itself proof the text is not mojibake, since
 * mojibake by construction consists only of characters cp1252 can express.
 */
function toCp1252Bytes(s: string): Uint8Array | null {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const cp = s.charCodeAt(i);
    if (cp <= 0xff) {
      // 0x80-0x9F are C1 controls in latin-1 and would not appear in text
      // that was decoded as cp1252, so their presence rules mojibake out.
      if (cp >= 0x80 && cp <= 0x9f) return null;
      out[i] = cp;
    } else {
      const byte = CP1252_HIGH.get(cp);
      if (byte === undefined) return null;
      out[i] = byte;
    }
  }
  return out;
}

/** Decode strictly as UTF-8; null when the bytes are not valid UTF-8. */
function decodeUtf8Strict(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * The original text if `s` is cp1252 mojibake, else null.
 *
 * Pure ASCII can never qualify: it round-trips to itself, and we require the
 * decode to actually change something.
 *
 * A string containing U+FFFD always returns null — the replacement character
 * has no cp1252 byte, so the round-trip cannot run. Mojibake sitting beside
 * one therefore goes unreported, which is the right trade: U+FFFD already
 * means "re-fetch from the source", and that repairs the rest of the string
 * along with it.
 */
export function repairMojibake(s: string): string | null {
  const bytes = toCp1252Bytes(s);
  if (bytes === null) return null;
  const decoded = decodeUtf8Strict(bytes);
  if (decoded === null || decoded === s) return null;
  return decoded;
}

function excerptAround(s: string, index: number, radius = 40): string {
  return s.slice(Math.max(0, index - radius), index + radius);
}

/** First index at which `s` and `t` differ; -1 when they match. */
function firstDivergence(s: string, t: string): number {
  const n = Math.min(s.length, t.length);
  for (let i = 0; i < n; i++) if (s[i] !== t[i]) return i;
  return s.length === t.length ? -1 : n;
}

/**
 * Every piece of encoding damage in one string, in order. Returns an empty
 * array for text that is merely non-ASCII.
 */
export function findEncodingDamage(s: string): EncodingDamage[] {
  const found: EncodingDamage[] = [];

  const fffd = s.indexOf(REPLACEMENT);
  if (fffd !== -1) {
    found.push({
      kind: "replacement-character",
      index: fffd,
      excerpt: excerptAround(s, fffd),
    });
  }

  const repaired = repairMojibake(s);
  if (repaired !== null) {
    const at = firstDivergence(s, repaired);
    found.push({
      kind: "cp1252-mojibake",
      index: at === -1 ? 0 : at,
      excerpt: excerptAround(s, at === -1 ? 0 : at),
      repaired,
    });
  }

  return found;
}

/** One-line description for a report. */
export function describeEncodingDamage(d: EncodingDamage): string {
  if (d.kind === "replacement-character") {
    return "contains U+FFFD — bytes were lost upstream, re-fetch from the source";
  }
  return `cp1252 mojibake — UTF-8 decoded as cp1252; should read ${JSON.stringify(d.repaired)}`;
}
