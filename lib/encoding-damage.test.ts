import { describe, it, expect } from "vitest";
import {
  findEncodingDamage,
  repairMojibake,
  describeEncodingDamage,
} from "./encoding-damage.js";

// The characters under test are written as escapes so the intent survives an
// editor, a terminal, or a copy-paste that re-encodes the file — which is the
// very failure this module exists to catch.
const A_CIRCUMFLEX = "Â";
const NBSP = " ";
const EN_DASH = "–";
const EM_DASH = "—";
const NB_HYPHEN = "‑";
const FULLWIDTH_BAR = "｜";
const FFFD = "�";

describe("repairMojibake", () => {
  it("reverses the real XPT.0007 damage", () => {
    // XPPen's non-breaking space (C2 A0) decoded as cp1252.
    const damaged = `Artist Pro 24 GEN2${A_CIRCUMFLEX}${NBSP}165Hz`;
    expect(repairMojibake(damaged)).toBe(`Artist Pro 24 GEN2${NBSP}165Hz`);
  });

  it("reverses a mangled accented character", () => {
    expect(repairMojibake("CafÃ©")).toBe("Café");
  });

  it("reverses a mangled em dash", () => {
    // E2 80 94 read as cp1252 is "â" + "€" + "”".
    expect(repairMojibake("Aâ€”B")).toBe(`A${EM_DASH}B`);
  });

  it("returns null for pure ASCII", () => {
    expect(repairMojibake("Artist Pro 24 GEN2 165Hz")).toBeNull();
  });

  it("returns null for correctly encoded accented text", () => {
    // "é" is byte E9 in cp1252, which cannot begin a UTF-8 sequence.
    expect(repairMojibake("Café")).toBeNull();
  });

  it("returns null for the empty string", () => {
    expect(repairMojibake("")).toBeNull();
  });
});

// The dataset's legitimate non-ASCII characters. If any of these ever start
// reporting, the check has become noise and will be switched off — which is
// the failure mode this suite exists to prevent.
describe("findEncodingDamage leaves genuine typography alone", () => {
  const legitimate: [string, string][] = [
    ["en dash, as Wacom publishes it", `Wacom Intuos Pro (2025) ${EN_DASH} The Ultimate Creative Pen Tablet`],
    ["em dash in curated prose", `far outside the expected range ${EM_DASH} the pen requires`],
    ["ASUS's fullwidth bar", `ProArt Display PA169CDV${FULLWIDTH_BAR}Monitors${FULLWIDTH_BAR}ASUS USA`],
    ["Apple's non-breaking hyphen", `iPad Pro 11${NB_HYPHEN}inch (M4) - Tech Specs`],
    ["a bare non-breaking space", `165${NBSP}Hz`],
    ["plain ASCII", "Wacom Pro Pen 3 (ACP-500)"],
  ];

  for (const [name, text] of legitimate) {
    it(name, () => {
      expect(findEncodingDamage(text)).toEqual([]);
    });
  }
});

describe("findEncodingDamage", () => {
  it("reports mojibake with the repaired text and where it starts", () => {
    const damaged = `Artist Pro 24 GEN2${A_CIRCUMFLEX}${NBSP}165Hz`;
    const [d, ...rest] = findEncodingDamage(damaged);
    expect(rest).toEqual([]);
    expect(d.kind).toBe("cp1252-mojibake");
    expect(d.index).toBe("Artist Pro 24 GEN2".length);
    expect(d.repaired).toBe(`Artist Pro 24 GEN2${NBSP}165Hz`);
  });

  it("reports a replacement character as unrecoverable", () => {
    const [d, ...rest] = findEncodingDamage(`The pride of Wacom ${FFFD} Pro Pen 3`);
    expect(rest).toEqual([]);
    expect(d.kind).toBe("replacement-character");
    expect(d.index).toBe("The pride of Wacom ".length);
    expect(d.repaired).toBeUndefined();
  });

  it("carries an excerpt around the damage rather than the whole string", () => {
    const long = "x".repeat(200) + FFFD + "y".repeat(200);
    const [d] = findEncodingDamage(long);
    expect(d.excerpt).toContain(FFFD);
    expect(d.excerpt.length).toBeLessThan(long.length);
  });

  // U+FFFD has no cp1252 byte, so a string carrying one cannot be run back
  // through the round-trip and any mojibake beside it goes unreported. That
  // is the right trade: the replacement character already means "re-fetch
  // from the source", which repairs the rest of the string as a side effect.
  it("reports only the unrecoverable damage when a string carries both", () => {
    const both = `CafÃ© ${FFFD}`;
    expect(findEncodingDamage(both).map((d) => d.kind)).toEqual(["replacement-character"]);
  });
});

describe("describeEncodingDamage", () => {
  it("tells you to re-fetch when the bytes are gone", () => {
    const [d] = findEncodingDamage(FFFD);
    expect(describeEncodingDamage(d)).toContain("re-fetch");
  });

  it("quotes the corrected reading when the damage is reversible", () => {
    const [d] = findEncodingDamage("CafÃ©");
    expect(describeEncodingDamage(d)).toContain("Café");
  });
});
