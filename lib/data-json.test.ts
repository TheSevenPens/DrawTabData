import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  checkDataJsonText,
  findDuplicateKeys,
  findIntegerLikeKeys,
  formatDataJson,
  parseDataJson,
  readDataJson,
  writeDataJson,
} from "./data-json.js";

// Characters #43 found mangled by the PowerShell round trip, plus the ones
// ConvertTo-Json needlessly escaped.
const tricky = {
  Title: "Pride of Wacom – Pro Pen 3 “quoted” & it's café",
  Author: "Zoë Ørsted",
  Emoji: "✏️",
  Number: 5,
  Decimal: 92.3,
  Nested: { List: ["a", "b"] },
};

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "data-json-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("formatDataJson", () => {
  it("writes &, apostrophes and non-ASCII literally", () => {
    const text = formatDataJson(tricky);
    expect(text).toContain("Pride of Wacom – Pro Pen 3 “quoted” & it's café");
    expect(text).toContain("Zoë Ørsted");
    expect(text).not.toMatch(/\\u00|\\u20/);
  });

  it("uses two-space indent, LF only, one trailing newline", () => {
    const text = formatDataJson({ A: { B: 1 } });
    expect(text).toBe('{\n  "A": {\n    "B": 1\n  }\n}\n');
    expect(text).not.toContain("\r");
  });

  it("refuses integer-like keys, which a round trip would reorder", () => {
    expect(() => formatDataJson({ b: 1, "2": 2 })).toThrow(/integer-like/);
  });
});

describe("findDuplicateKeys", () => {
  it("finds a repeated key in the same object", () => {
    expect(findDuplicateKeys('{"a":1,"b":2,"a":3}')).toEqual(["a"]);
  });

  it("allows the same key in different objects", () => {
    expect(findDuplicateKeys('[{"a":1},{"a":2}]')).toEqual([]);
    expect(findDuplicateKeys('{"a":{"a":1}}')).toEqual([]);
  });

  it("ignores braces, colons and quotes inside string values", () => {
    expect(findDuplicateKeys('{"a":"x: {\\"a\\": 1}","b":"}"}')).toEqual([]);
  });

  it("compares keys after unescaping", () => {
    expect(findDuplicateKeys('{"é":1,"\\u00e9":2}')).toEqual(["é"]);
  });
});

describe("findIntegerLikeKeys", () => {
  it("reports numeric keys with their path", () => {
    expect(findIntegerLikeKeys({ x: [{ "10": 1 }] })).toEqual(["$.x[0].10"]);
    expect(findIntegerLikeKeys({ "01": 1, "1a": 2 })).toEqual([]);
  });
});

describe("parseDataJson", () => {
  it("skips a BOM (readers are tolerant)", () => {
    expect(parseDataJson('﻿{"a":1}')).toEqual({ a: 1 });
  });

  it("rejects duplicate keys instead of silently keeping the last", () => {
    expect(() => parseDataJson('{"a":1,"a":2}', "x.json")).toThrow(/x\.json: duplicate/);
  });
});

describe("writeDataJson", () => {
  it("round-trips tricky text byte-for-byte, with no BOM or CR", () => {
    const file = path.join(dir, "t.json");
    writeDataJson(file, tricky);
    const bytes = fs.readFileSync(file);
    expect(bytes[0]).not.toBe(0xef); // no UTF-8 BOM
    expect(bytes.includes(0x0d)).toBe(false); // no CR
    expect(readDataJson(file)).toEqual(tricky);
    // Writing the parsed value again changes nothing (#43 compounded on re-runs).
    expect(writeDataJson(file, readDataJson(file))).toBe(false);
    expect(fs.readFileSync(file)).toEqual(bytes);
  });

  it("a focused edit changes only the edited lines", () => {
    const file = path.join(dir, "t.json");
    const data = { Rows: [{ Id: "A", Year: "2020" }, { Id: "B", Year: "2021" }] };
    writeDataJson(file, data);
    const before = fs.readFileSync(file, "utf8").split("\n");
    data.Rows[1].Year = "2022";
    writeDataJson(file, data);
    const after = fs.readFileSync(file, "utf8").split("\n");
    const changed = after.filter((l, i) => l !== before[i]);
    expect(changed).toEqual(['      "Year": "2022"']);
  });

  it("leaves no temp file behind", () => {
    writeDataJson(path.join(dir, "t.json"), { a: 1 });
    expect(fs.readdirSync(dir)).toEqual(["t.json"]);
  });
});

describe("checkDataJsonText", () => {
  const canonical = formatDataJson({ a: [1, 2] });

  it("passes canonical text", () => {
    expect(checkDataJsonText(canonical, "f")).toEqual([]);
  });

  it("flags a BOM, CRLF, mixed endings and non-canonical formatting", () => {
    const problems = (t: string) => checkDataJsonText(t, "f").map((i) => i.problem);
    expect(problems("﻿" + canonical)).toEqual(["bom"]);
    expect(problems(canonical.replace(/\n/g, "\r\n"))).toEqual(["crlf"]);
    expect(checkDataJsonText(canonical.replace("\n", "\r\n"), "f")[0].detail).toMatch(/mixed/);
    expect(problems('{"a": [1,2]}\n')).toEqual(["not-canonical"]);
    expect(problems('{"a":1}')).toEqual(["not-canonical"]); // missing trailing newline
  });

  it("flags wide PowerShell-style indentation and \\u0026 escapes", () => {
    expect(checkDataJsonText('{\n    "a":  "x \\u0026 y"\n}\n', "f").map((i) => i.problem)).toEqual([
      "not-canonical",
    ]);
  });

  it("reports duplicate keys and invalid JSON without throwing", () => {
    expect(checkDataJsonText('{"a":1,"a":2}\n', "f")[0].problem).toBe("duplicate-keys");
    expect(checkDataJsonText("{", "f")[0].problem).toBe("invalid-json");
  });
});
