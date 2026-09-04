import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  extractPageText,
  extractPenTokens,
  extractSkuTokens,
  normalizeCode,
  parsePageText,
  reconstructText,
  records,
  slugify,
  type MacHollywoodSource,
} from "./machollywood.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "..", "data", "machollywood");

const SOURCE: MacHollywoodSource = {
  url: "https://example.invalid/page",
  site: "example.invalid",
  title: "test",
  retrievedAt: "2026-09-03",
  textSha256: "",
};

const parse = (text: string) => parsePageText(text, SOURCE);

describe("extractPageText", () => {
  it("takes the rte body, drops tags, and collapses blank runs", () => {
    const html = `<html><body><div class="header">skip me</div>
      <div class="rte"><p>Hello <strong>world</strong></p><p></p><p></p><p>Second &amp; last</p></div>
      <div class="footer">skip me too</div></body></html>`;
    expect(extractPageText(html)).toBe("Hello world\n\nSecond & last\n");
  });

  it("walks nested divs to find the end of the body, and stops there", () => {
    const html = `<div class="rte"><p>a</p><div><p>b</p></div><p>c</p></div><p>outside</p>`;
    // A bare <div> open tag adds no break of its own, so "a" and "b" abut.
    expect(extractPageText(html)).toBe("a\nb\n\nc\n");
  });

  it("turns <br> into a line break", () => {
    expect(extractPageText(`<div class="rte"><p>a<br>b</p></div>`)).toBe("a\nb\n");
  });

  it("throws rather than guessing when the body is missing", () => {
    expect(() => extractPageText("<html><body>nope</body></html>")).toThrow(/article body/);
  });
});

describe("parsePageText", () => {
  const page = [
    "Intro paragraph.",
    "",
    "______________",
    "",
    "| Pen Displays |",
    "",
    "Cintiqs",
    "",
    "Widget 12 (AB-1200)",
    "",
    "Some Pen included.",
    "",
    "The 12\" Widget (2020 Release).",
    "SKU: AB1200",
    "",
    "- Nibs for Included Pen: NIB1",
    "",
    "Pen Compatibility",
    "",
    "Current Gens.: Some Pen (KP504E).",
    "Legacy Gens.: Old Pen (KP503E).",
    "",
    "_________________________",
    "",
    "Widget 9",
    "(AB-900)",
    "",
    "Other Pen included.",
    "",
    "SKUs: AB900, AB901",
    "",
    "Pen Compatibility",
    "",
    "Legacy Gens.: Old Pen (KP503E).",
    "",
    "_________________________",
    "",
    "Tablets Not Shown Above:",
    "",
    "Gadget, 1998 (CD-0405) Discontinued",
    "",
    "Compatible Pen: UltraPen UP-703E",
    "",
    "_______________",
    "",
    "Many of the older tablets are hard to find.",
    "",
    "______________",
    "",
    "| Back to Top |",
    "",
  ].join("\n") + "\n";

  it("round-trips the source text exactly", () => {
    expect(reconstructText(parse(page))).toBe(page);
  });

  it("finds the records and skips the chrome", () => {
    const kinds = parse(page).segments.map((s) => s.kind);
    expect(kinds).toEqual(["preamble", "record", "record", "record", "footer", "footer"]);
  });

  it("pulls the fields of a full record apart", () => {
    const r = records(parse(page))[0];
    expect(r).toMatchObject({
      id: "widget-12-ab-1200",
      section: "Pen Displays",
      group: "Cintiqs",
      heading: "Widget 12 (AB-1200)",
      includedPen: "Some Pen included.",
      description: ['The 12" Widget (2020 Release).'],
      skuLine: "SKU: AB1200",
      bullets: ["Nibs for Included Pen: NIB1"],
      compatibility: ["Current Gens.: Some Pen (KP504E).", "Legacy Gens.: Old Pen (KP503E)."],
    });
  });

  it("joins a two-line heading and inherits the group from the section", () => {
    const r = records(parse(page))[1];
    expect(r.heading).toBe("Widget 9 (AB-900)");
    expect(r.group).toBe("Cintiqs");
    expect(r.skuLine).toBe("SKUs: AB900, AB901");
  });

  it("keeps a short record's Compatible Pen line as its compatibility", () => {
    const r = records(parse(page))[2];
    expect(r).toMatchObject({
      heading: "Gadget, 1998 (CD-0405) Discontinued",
      includedPen: null,
      skuLine: null,
      compatibility: ["Compatible Pen: UltraPen UP-703E"],
    });
  });

  it("gives colliding headings distinct ids", () => {
    const dup = [
      "| S |",
      "",
      "Cintiq 21UX (A)",
      "",
      "Pen included.",
      "",
      "Pen Compatibility",
      "",
      "Legacy Gens.: Pen (KP503E).",
      "",
      "_____",
      "",
      "Cintiq 21UX (A)",
      "",
      "Pen included.",
      "",
      "Pen Compatibility",
      "",
      "Legacy Gens.: Pen (KP503E).",
      "",
    ].join("\n") + "\n";
    expect(records(parse(dup)).map((r) => r.id)).toEqual([
      "cintiq-21ux-a",
      "cintiq-21ux-a-2",
    ]);
  });
});

describe("the checked-in capture", () => {
  const text = readFileSync(path.join(dataDir, "machollywood-pen-compat.txt"), "utf-8");
  const dataset = JSON.parse(
    readFileSync(path.join(dataDir, "machollywood-pen-compat.json"), "utf-8"),
  );

  it("round-trips: the JSON reproduces the .txt byte for byte", () => {
    expect(reconstructText(dataset)).toBe(text);
  });

  it("is the parse the current code produces", () => {
    const fresh = parsePageText(text, dataset.source);
    expect(fresh.segments).toEqual(dataset.segments);
  });

  it("records the sha256 of the text it was built from", () => {
    expect(dataset.source.textSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("every record carries a heading and a section", () => {
    for (const r of records(dataset)) {
      expect(r.heading).not.toBe("");
      expect(r.section).not.toBeNull();
    }
  });

  it("every record lists at least one compatibility line", () => {
    const bare = records(dataset).filter((r) => r.compatibility.length === 0);
    expect(bare.map((r) => r.id)).toEqual([]);
  });
});

describe("slugify", () => {
  it("lowercases and collapses punctuation to single dashes", () => {
    expect(slugify("Cintiq Pro 24 (DTK/H-2420K0)")).toBe("cintiq-pro-24-dtk-h-2420k0");
    expect(slugify("Intuos Pro, 2017/19 (PTH-4/6/860 /P)")).toBe("intuos-pro-2017-19-pth-4-6-860-p");
  });
});

describe("token extraction", () => {
  const record = {
    id: "r",
    section: "Pen Tablets",
    group: null,
    heading: "Intuos M & S BT (CTL-6100/4100)",
    includedPen: "4K Pen LP-1100 included.",
    description: [],
    skuLine: "SKUs: CTL6100WLK0, CTL6100WLE0, CTL4100",
    bullets: [],
    compatibility: ["Current Gen.: 4K Pen LP1100K", "Legacy Gens.: LP170G/K/ES, LP171"],
  };

  it("reads tablet SKUs off the SKU line", () => {
    expect(extractSkuTokens(record).map((t) => t.token)).toEqual([
      "CTL6100WLK0",
      "CTL6100WLE0",
      "CTL4100",
    ]);
  });

  it("falls back to the heading when there is no SKU line", () => {
    const short = { ...record, skuLine: null, heading: "Volito, 2002 (FT-0405U) Discontinued" };
    expect(extractSkuTokens(short).map((t) => t.token)).toEqual(["FT-0405U"]);
  });

  it("reads pen codes from the included-pen and compatibility lines", () => {
    expect(extractPenTokens(record).map((t) => t.token)).toEqual([
      "LP-1100",
      "LP1100K",
      "LP170G/K/ES",
      "LP171",
    ]);
  });

  it("keeps a multi-variant code whole rather than splitting it", () => {
    const tokens = extractPenTokens(record);
    expect(tokens.find((t) => t.token === "LP170G/K/ES")).toBeDefined();
  });

  it("keeps each code with the line it came from", () => {
    const first = extractPenTokens(record)[0];
    expect(first).toMatchObject({ from: "includedPen", context: "4K Pen LP-1100 included." });
  });
});

describe("normalizeCode", () => {
  it("ignores case and punctuation so page codes can meet our Ids", () => {
    expect(normalizeCode("DTH-3220")).toBe("DTH3220");
    expect(normalizeCode("dth3220k0")).toBe("DTH3220K0");
    expect(normalizeCode("LP170G/K/ES")).toBe("LP170GKES");
  });
});
