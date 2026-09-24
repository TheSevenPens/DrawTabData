// Every managed data file must stay in the canonical format (RFC #45 phase
// 1). The check reads raw bytes, so a BOM, a CRLF or mixed line ending,
// PowerShell wide indentation, a & escape or a duplicate key fails
// here — in this repo's tests and in the Explorer's CI, which runs them.

import { describe, expect, it } from "vitest";
import * as path from "node:path";
import * as url from "node:url";
import { checkManagedDataFiles, listManagedDataFiles, MANAGED_DATA_DIRS } from "./data-json.js";

const dataDir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "data");

describe("managed data files", () => {
  it("covers every managed directory", () => {
    const dirs = new Set(listManagedDataFiles(dataDir).map((f) => path.basename(path.dirname(f))));
    for (const d of MANAGED_DATA_DIRS) expect(dirs.has(d), d).toBe(true);
  });

  it("are all canonical (fix with: npx tsx scripts/format-data.ts --write)", () => {
    const issues = checkManagedDataFiles(dataDir).map((i) => `${i.file}: ${i.problem} ${i.detail ?? ""}`);
    expect(issues).toEqual([]);
  });
});
