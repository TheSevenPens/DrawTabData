// Session EntityIds are stored and must match what Brand / InventoryId /
// Date / IdSuffix imply, and be unique — two sessions of one pen on one day
// used to share an ID, so one of them was unreachable at /entity/<id>.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatDataJson } from "./data-json.js";
import { runDataQuality } from "./data-quality.js";

let dataDir: string;
beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dq-sessions-"));
  fs.mkdirSync(path.join(dataDir, "pressure-response"));
});
afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

let uuid = 0;
const session = (over: Record<string, unknown> = {}) => ({
  EntityId: "wacom.session.wap.0009_2026-05-25",
  Brand: "WACOM",
  PenEntityId: "wacom.pen.cp923",
  PenFamily: "",
  InventoryId: "WAP.0009",
  Date: "2026-05-25",
  User: "sevenpens",
  TabletEntityId: "wacom.tablet.ctc6110wl",
  Driver: "WACOM",
  OS: "WINDOWS",
  Notes: "",
  Records: [[10, 0]],
  _id: `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`,
  _CreateDate: "2026-05-25T00:00:00.000Z",
  _ModifiedDate: "2026-05-25T00:00:00.000Z",
  ...over,
});

function sessionIssues(sessions: unknown[]) {
  fs.writeFileSync(
    path.join(dataDir, "pressure-response", "WACOM-pressure-response.json"),
    formatDataJson({ PressureResponse: sessions }),
  );
  return runDataQuality(dataDir)
    .filter((i) => i.field === "EntityId")
    .map((i) => `${i.entityId}: ${i.issue}${i.value ? ` ${i.value}` : ""}`);
}

describe("session EntityId checks", () => {
  it("accepts a derived ID, and a suffixed one for a same-day repeat", () => {
    expect(
      sessionIssues([
        session(),
        session({
          EntityId: "wacom.session.wap.0009_2026-05-25_galaxybook5pro360",
          IdSuffix: "galaxybook5pro360",
          TabletEntityId: "samsung.tablet.galaxybook5pro360",
        }),
      ]),
    ).toEqual([]);
  });

  it("rejects a stored ID that doesn't match the fields", () => {
    expect(sessionIssues([session({ Date: "2026-05-26" })])).toEqual([
      'wacom.session.wap.0009_2026-05-25: does not match derived value got "wacom.session.wap.0009_2026-05-25", expected "wacom.session.wap.0009_2026-05-26"',
    ]);
  });

  it("rejects a same-day repeat without an IdSuffix", () => {
    expect(sessionIssues([session(), session()])).toEqual([
      "wacom.session.wap.0009_2026-05-25: duplicate EntityId (also in WACOM-pressure-response.json)",
    ]);
  });

  it("requires the stored ID", () => {
    const { EntityId: _omit, ...noId } = session();
    expect(sessionIssues([noId])).toContainEqual(expect.stringMatching(/does not match derived value got "undefined"/));
  });
});
