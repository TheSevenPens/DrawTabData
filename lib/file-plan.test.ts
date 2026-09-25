import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applyFilePlan } from "./file-plan.js";
vi.mock("node:fs", async importOriginal => ({ ...await importOriginal<typeof import("node:fs")>() }));
let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "file-plan-")); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });
it("restores exact bytes, deleted files and removes newly created paths after a later I/O failure", () => {
  fs.writeFileSync(path.join(root, "old.json"), Buffer.from([0xef, 0xbb, 0xbf, 13, 10]));
  fs.writeFileSync(path.join(root, "deleted.json"), "keep\r\n");
  const rename = fs.renameSync;
  vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
    if (String(to).endsWith("fail.json")) throw new Error("simulated I/O failure");
    rename(from, to);
  });
  expect(() => applyFilePlan(root, new Map([
    ["old.json", Buffer.from("changed")], ["new.json", Buffer.from("new")],
    ["deleted.json", null], ["fail.json", Buffer.from("failure")],
  ]))).toThrow("simulated I/O failure");
  expect(fs.readFileSync(path.join(root, "old.json"))).toEqual(Buffer.from([0xef, 0xbb, 0xbf, 13, 10]));
  expect(fs.readFileSync(path.join(root, "deleted.json"), "utf8")).toBe("keep\r\n");
  expect(fs.readdirSync(root).sort()).toEqual(["deleted.json", "old.json"]);
});
