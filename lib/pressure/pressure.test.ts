// Unit tests for the pressure-math modules. These functions back every
// pressure-response chart on the explorer (PenDetail, PenFamilyDetail,
// SessionDetail, pen-flagged, /pressure-response, /entity/<session>) so
// silent regressions are visible-but-subtle. Each function is pinned
// here with its documented edge cases.
//
// The math (interpolate.ts) was ported verbatim from PenPressureData;
// the boundary clamps and short-circuits are not obvious from reading
// the code, so they each get their own test.

import { describe, it, expect } from "vitest";
import {
  interpolatePhysical,
  estimateP00,
  estimateP100,
  fmtP,
  type PressureRecord,
} from "./interpolate.js";
import {
  buildInventoryDefects,
  isSessionDefective,
  excludedPensSummary,
} from "./defects.js";
import { sessionEntityId, parseSessionEntityId } from "./session-id.js";
import {
  findNonMonotonicSessions,
  findMissingLowEnd,
  findSingleSessionPens,
  findStaleMeasurements,
  findRecommendedForRemeasurement,
} from "./data-quality.js";
import type { InventoryPen, PressureResponse } from "../schemas.js";

// --- Helpers ---------------------------------------------------------------

/** Minimal-but-valid PressureResponse for tests. Override what each test needs. */
function makeSession(over: Partial<PressureResponse>): PressureResponse {
  return {
    Brand: "WACOM",
    PenEntityId: "wacom.pen.cp923",
    PenFamily: "wacom.penfamily.wacomone",
    InventoryId: "WAP.0001",
    Date: "2025-01-15",
    User: "sevenpens",
    TabletEntityId: "wacom.tablet.ctc6110wl",
    Driver: "WACOM",
    OS: "WINDOWS",
    Notes: "",
    Records: [
      [0, 0],
      [10, 50],
      [20, 100],
    ],
    _id: "00000000-0000-0000-0000-000000000000",
    _CreateDate: "2025-01-15T00:00:00.000Z",
    _ModifiedDate: "2025-01-15T00:00:00.000Z",
    ...over,
  };
}

function makeInventoryPen(over: Partial<InventoryPen>): InventoryPen {
  return {
    Brand: "WACOM",
    InventoryId: "WAP.0001",
    PenEntityId: "wacom.pen.cp923",
    PenFamily: "wacom.penfamily.wacomone",
    Notes: "",
    Defects: [],
    _id: "00000000-0000-0000-0000-000000000001",
    _CreateDate: "2025-01-15T00:00:00.000Z",
    _ModifiedDate: "2025-01-15T00:00:00.000Z",
    ...over,
  } as InventoryPen;
}

// --- interpolate.ts --------------------------------------------------------

describe("interpolatePhysical", () => {
  it("linearly interpolates between adjacent records", () => {
    const records: PressureRecord[] = [
      [0, 0],
      [10, 100],
    ];
    expect(interpolatePhysical(records, 50)).toBe(5);
    expect(interpolatePhysical(records, 25)).toBe(2.5);
    expect(interpolatePhysical(records, 0)).toBe(0);
    expect(interpolatePhysical(records, 100)).toBe(10);
  });

  it("returns x0 when adjacent ys are equal (flat segment)", () => {
    // The function returns the LEFT x when y1 === y0 to avoid divide-by-zero.
    const records: PressureRecord[] = [
      [5, 50],
      [10, 50],
    ];
    expect(interpolatePhysical(records, 50)).toBe(5);
  });

  it("returns null when the target lies outside the covered range", () => {
    const records: PressureRecord[] = [
      [0, 10],
      [10, 90],
    ];
    expect(interpolatePhysical(records, 5)).toBeNull(); // below first y
    expect(interpolatePhysical(records, 95)).toBeNull(); // above last y
  });

  it("walks all segments to find the bracket containing the target", () => {
    const records: PressureRecord[] = [
      [0, 0],
      [5, 20],
      [10, 60],
      [15, 100],
    ];
    // Target 80 lies in the [10, 15] segment between y=60 and y=100.
    // x = 10 + ((80-60) * (15-10)) / (100-60) = 10 + 2.5 = 12.5
    expect(interpolatePhysical(records, 80)).toBe(12.5);
  });

  it("returns null on empty / single-record inputs", () => {
    expect(interpolatePhysical([], 50)).toBeNull();
    expect(interpolatePhysical([[0, 50]], 50)).toBeNull();
  });
});

describe("estimateP00", () => {
  it("returns null on empty input", () => {
    expect(estimateP00([])).toBeNull();
  });

  it("returns the first x when the first y is already ≤ 0", () => {
    // A session that already records 0% pressure → P00 is the first x.
    expect(estimateP00([[3, 0], [5, 50]])).toBe(3);
    expect(estimateP00([[3, -1], [5, 50]])).toBe(3);
  });

  it("returns null when only one record is supplied (no slope to fit)", () => {
    expect(estimateP00([[10, 50]])).toBeNull();
  });

  it("returns xFirst when the first y is already at-or-below the threshold (0.5%)", () => {
    // yFirst ≤ THRESHOLD → no extrapolation needed; the first x already
    // satisfies the activation criterion.
    expect(estimateP00([[8, 0.3], [10, 50]])).toBe(8);
    expect(estimateP00([[8, 0.5], [10, 50]])).toBe(8);
  });

  it("extrapolates backward when first y is well above threshold", () => {
    // Steady-state increasing data → P00 should fall somewhere before xFirst
    // and ≥ 0 (the function clamps negatives to 0).
    const records: PressureRecord[] = [
      [10, 20],
      [12, 40],
      [14, 60],
      [16, 80],
      [18, 100],
    ];
    const p00 = estimateP00(records);
    expect(p00).not.toBeNull();
    expect(p00!).toBeGreaterThanOrEqual(0);
    expect(p00!).toBeLessThan(10);
  });

  it("clamps extrapolated p00 to 0 if the model predicts a negative", () => {
    // A nearly-flat slope with a high yFirst forces p00 far below 0;
    // the function caps it at 0 to keep the chart axis sane.
    const records: PressureRecord[] = [
      [5, 50],
      [5.0001, 50.0001],
    ];
    const p00 = estimateP00(records);
    // Either null (degenerate slopes) or clamped to 0 — both are
    // valid here; the contract is "no negative output".
    if (p00 !== null) expect(p00).toBeGreaterThanOrEqual(0);
  });
});

describe("estimateP100", () => {
  it("returns the first x where y ≥ 100", () => {
    expect(estimateP100([[0, 0], [10, 100]])).toBe(10);
    expect(estimateP100([[0, 0], [10, 105]])).toBe(10);
  });

  it("returns null on empty / single-record inputs that don't reach 100", () => {
    expect(estimateP100([])).toBeNull();
    expect(estimateP100([[5, 50]])).toBeNull();
  });

  it("returns xLast when the gap to 100 is already at-or-below the threshold", () => {
    // 100 - yLast ≤ 0.5 → no extrapolation.
    expect(estimateP100([[0, 0], [10, 99.7]])).toBe(10);
    expect(estimateP100([[0, 0], [10, 99.5]])).toBe(10);
  });

  it("extrapolates forward when the gap is meaningful", () => {
    // Records stop at 80%; the model extrapolates to where y would reach 100.
    const records: PressureRecord[] = [
      [10, 20],
      [12, 40],
      [14, 60],
      [16, 80],
    ];
    const p100 = estimateP100(records);
    expect(p100).not.toBeNull();
    expect(p100!).toBeGreaterThan(16);
  });

  it("rejects unphysical extrapolations more than 4× xLast as null", () => {
    // A near-zero positive slope at the end → extrapolation would say
    // "P100 is at infinity"; the function clamps that to null.
    const records: PressureRecord[] = [
      [10, 5],
      [11, 5.01],
    ];
    expect(estimateP100(records)).toBeNull();
  });
});

describe("fmtP", () => {
  it("renders null as the em-dash sentinel", () => {
    expect(fmtP(null)).toBe("—");
  });

  it("renders numbers to one decimal place", () => {
    expect(fmtP(0)).toBe("0.0");
    expect(fmtP(1.234)).toBe("1.2");
    expect(fmtP(1.25)).toBe("1.3"); // banker's rounding doesn't apply — toFixed
    expect(fmtP(-1.5)).toBe("-1.5");
  });
});

// --- session-id.ts ---------------------------------------------------------

describe("sessionEntityId", () => {
  it("lowercases brand + inventory id and joins with the date", () => {
    expect(
      sessionEntityId({ Brand: "WACOM", InventoryId: "WAP.0030", Date: "2025-03-25" }),
    ).toBe("wacom.session.wap.0030_2025-03-25");
  });

  it("trims whitespace inside InventoryId", () => {
    expect(
      sessionEntityId({ Brand: "WACOM", InventoryId: "  WAP.0030  ", Date: "2025-03-25" }),
    ).toBe("wacom.session.wap.0030_2025-03-25");
  });
});

describe("parseSessionEntityId", () => {
  it("round-trips with sessionEntityId", () => {
    const id = sessionEntityId({ Brand: "HUION", InventoryId: "H.001", Date: "2024-06-01" });
    const parsed = parseSessionEntityId(id);
    expect(parsed).toEqual({ brand: "huion", inventoryId: "h.001", date: "2024-06-01" });
  });

  it("splits on the LAST underscore (InventoryId may contain dots, not date separators)", () => {
    // "wacom.session.wap.0030_2025-03-25" → InventoryId "wap.0030", Date "2025-03-25".
    const parsed = parseSessionEntityId("wacom.session.wap.0030_2025-03-25");
    expect(parsed).toEqual({ brand: "wacom", inventoryId: "wap.0030", date: "2025-03-25" });
  });

  it("returns null for non-session entity IDs", () => {
    expect(parseSessionEntityId("wacom.tablet.ctl4100")).toBeNull();
    expect(parseSessionEntityId("wacom.pen.cp923")).toBeNull();
    expect(parseSessionEntityId("wacom")).toBeNull();
  });

  it("returns null when the tail has no underscore", () => {
    expect(parseSessionEntityId("wacom.session.justaninventoryid")).toBeNull();
  });
});

// --- defects.ts ------------------------------------------------------------

describe("buildInventoryDefects", () => {
  it("includes only pens with at least one defect", () => {
    const pens = [
      makeInventoryPen({ InventoryId: "P1", Defects: [{ Kind: "INK_LEAK", Notes: "" }] }),
      makeInventoryPen({ InventoryId: "P2", Defects: [] }),
      makeInventoryPen({ InventoryId: "P3" }),
    ];
    const map = buildInventoryDefects(pens);
    expect(Array.from(map.keys()).sort()).toEqual(["P1"]);
  });

  it("formats kindsLabel and detailsLabel correctly", () => {
    const pens = [
      makeInventoryPen({
        InventoryId: "P1",
        Defects: [
          { Kind: "INK_LEAK", Notes: "barrel cracked" },
          { Kind: "WORN_TIP", Notes: "" },
        ],
      }),
    ];
    const info = buildInventoryDefects(pens).get("P1")!;
    expect(info.kindsLabel).toBe("INK_LEAK, WORN_TIP");
    expect(info.detailsLabel).toBe("INK_LEAK: barrel cracked; WORN_TIP");
  });
});

describe("isSessionDefective", () => {
  it("returns true iff the session's InventoryId is in the defect map", () => {
    const pens = [
      makeInventoryPen({ InventoryId: "P1", Defects: [{ Kind: "X", Notes: "" }] }),
    ];
    const map = buildInventoryDefects(pens);
    expect(isSessionDefective(makeSession({ InventoryId: "P1" }), map)).toBe(true);
    expect(isSessionDefective(makeSession({ InventoryId: "P2" }), map)).toBe(false);
  });
});

describe("excludedPensSummary", () => {
  it("deduplicates by InventoryId and formats as 'id (kindsLabel)'", () => {
    const pens = [
      makeInventoryPen({ InventoryId: "P1", Defects: [{ Kind: "INK_LEAK", Notes: "" }] }),
      makeInventoryPen({ InventoryId: "P2", Defects: [{ Kind: "WORN_TIP", Notes: "" }] }),
    ];
    const map = buildInventoryDefects(pens);
    const sessions = [
      makeSession({ InventoryId: "P1" }),
      makeSession({ InventoryId: "P1" }), // dup of P1
      makeSession({ InventoryId: "P2" }),
      makeSession({ InventoryId: "P3" }), // not defective
    ];
    expect(excludedPensSummary(sessions, map)).toEqual([
      "P1 (INK_LEAK)",
      "P2 (WORN_TIP)",
    ]);
  });

  it("returns an empty list when no session pen is defective", () => {
    const map = buildInventoryDefects([]);
    const sessions = [makeSession({ InventoryId: "P1" })];
    expect(excludedPensSummary(sessions, map)).toEqual([]);
  });
});

// --- data-quality.ts -------------------------------------------------------

describe("findNonMonotonicSessions", () => {
  it("flags sessions whose logical y drops at any point", () => {
    const dropping = makeSession({
      Records: [
        [0, 0],
        [5, 50],
        [10, 40], // drop here
        [15, 100],
      ],
    });
    const clean = makeSession({
      Records: [
        [0, 0],
        [5, 50],
        [10, 100],
      ],
    });
    const result = findNonMonotonicSessions([dropping, clean]);
    expect(result).toHaveLength(1);
    expect(result[0].session).toBe(dropping);
    expect(result[0].firstDrop).toEqual({ index: 2, from: 50, to: 40 });
  });

  it("reports only the FIRST drop in a session", () => {
    const session = makeSession({
      Records: [
        [0, 0],
        [5, 50],
        [6, 40], // first drop
        [7, 30], // second drop, not reported
        [8, 80],
      ],
    });
    const result = findNonMonotonicSessions([session]);
    expect(result).toHaveLength(1);
    expect(result[0].firstDrop.index).toBe(2);
  });

  it("treats equal-y as monotonic (≥, not strictly >)", () => {
    const flat = makeSession({
      Records: [
        [0, 0],
        [5, 50],
        [10, 50], // plateau, not a drop
        [15, 100],
      ],
    });
    expect(findNonMonotonicSessions([flat])).toHaveLength(0);
  });
});

describe("findMissingLowEnd", () => {
  it("flags pens whose lowest observed y is above the threshold", () => {
    const sessions = [
      makeSession({
        InventoryId: "P1",
        Records: [
          [10, 5], // lowest y for P1 = 5, > 0.5 threshold
          [20, 100],
        ],
      }),
      makeSession({
        InventoryId: "P2",
        Records: [
          [0, 0.1], // lowest y for P2 = 0.1, ≤ threshold
          [10, 100],
        ],
      }),
    ];
    const out = findMissingLowEnd(sessions);
    expect(out.map((r) => r.inventoryId)).toEqual(["P1"]);
    expect(out[0].lowestLogical).toBe(5);
    expect(out[0].sessionCount).toBe(1);
  });

  it("aggregates the lowest y ACROSS all sessions of a pen", () => {
    const sessions = [
      makeSession({ InventoryId: "P1", Records: [[10, 5], [20, 100]] }),
      makeSession({ InventoryId: "P1", Records: [[5, 0.1], [20, 100]] }), // covers low end
    ];
    // Lowest y across both sessions is 0.1 → not flagged.
    expect(findMissingLowEnd(sessions)).toHaveLength(0);
  });

  it("accepts a custom threshold", () => {
    const sessions = [
      makeSession({ InventoryId: "P1", Records: [[10, 2], [20, 100]] }),
    ];
    expect(findMissingLowEnd(sessions, 1)).toHaveLength(1);
    expect(findMissingLowEnd(sessions, 3)).toHaveLength(0);
  });

  it("sorts results by lowestLogical descending (worst first)", () => {
    const sessions = [
      makeSession({ InventoryId: "P1", Records: [[10, 5]] }),
      makeSession({ InventoryId: "P2", Records: [[10, 10]] }),
      makeSession({ InventoryId: "P3", Records: [[10, 2]] }),
    ];
    expect(findMissingLowEnd(sessions).map((r) => r.inventoryId)).toEqual(["P2", "P1", "P3"]);
  });
});

describe("findSingleSessionPens", () => {
  it("returns pens whose session count is exactly 1", () => {
    const sessions = [
      makeSession({ InventoryId: "P1" }),
      makeSession({ InventoryId: "P2" }),
      makeSession({ InventoryId: "P2" }),
      makeSession({ InventoryId: "P3" }),
    ];
    const out = findSingleSessionPens(sessions);
    expect(out.map((r) => r.inventoryId).sort()).toEqual(["P1", "P3"]);
  });

  it("populates sessionEntityId from the single session", () => {
    const sessions = [
      makeSession({ Brand: "WACOM", InventoryId: "WAP.0001", Date: "2025-01-15" }),
    ];
    expect(findSingleSessionPens(sessions)[0].sessionEntityId).toBe(
      "wacom.session.wap.0001_2025-01-15",
    );
  });
});

describe("findStaleMeasurements", () => {
  const NOW = new Date("2026-05-12T00:00:00.000Z");

  it("flags pens whose most recent session is older than `days`", () => {
    const sessions = [
      makeSession({ InventoryId: "OLD", Date: "2024-01-01" }), // ~497 days ago
      makeSession({ InventoryId: "RECENT", Date: "2026-05-01" }), // ~11 days ago
    ];
    const out = findStaleMeasurements(sessions, 365, NOW);
    expect(out.map((r) => r.inventoryId)).toEqual(["OLD"]);
    expect(out[0].daysAgo).toBeGreaterThan(365);
    expect(out[0].lastDate).toBe("2024-01-01");
  });

  it("uses each pen's MOST RECENT session date", () => {
    const sessions = [
      makeSession({ InventoryId: "P1", Date: "2024-01-01" }), // old session
      makeSession({ InventoryId: "P1", Date: "2026-05-01" }), // recent session — wins
    ];
    expect(findStaleMeasurements(sessions, 365, NOW)).toHaveLength(0);
  });

  it("respects the days parameter", () => {
    const sessions = [makeSession({ InventoryId: "P1", Date: "2026-04-01" })];
    // ~41 days ago. Stale at 30 days, fresh at 90.
    expect(findStaleMeasurements(sessions, 30, NOW)).toHaveLength(1);
    expect(findStaleMeasurements(sessions, 90, NOW)).toHaveLength(0);
  });

  it("sorts results by daysAgo descending (oldest first)", () => {
    const sessions = [
      makeSession({ InventoryId: "P1", Date: "2024-01-01" }),
      makeSession({ InventoryId: "P2", Date: "2023-01-01" }),
      makeSession({ InventoryId: "P3", Date: "2024-06-01" }),
    ];
    expect(findStaleMeasurements(sessions, 365, NOW).map((r) => r.inventoryId))
      .toEqual(["P2", "P1", "P3"]);
  });
});

describe("findRecommendedForRemeasurement", () => {
  const NOW = new Date("2026-05-12T00:00:00.000Z");

  it("unions the three reason checks per pen", () => {
    const sessions = [
      // P1: only one session (single-session), recent date, fine y values → 1 reason.
      makeSession({
        InventoryId: "P1",
        Date: "2026-04-01",
        Records: [[0, 0], [10, 100]],
      }),
      // P2: two sessions (not single), stale, but covers low end → 1 reason.
      makeSession({
        InventoryId: "P2",
        Date: "2024-01-01",
        Records: [[0, 0], [10, 100]],
      }),
      makeSession({
        InventoryId: "P2",
        Date: "2024-01-15",
        Records: [[0, 0], [10, 100]],
      }),
    ];
    const out = findRecommendedForRemeasurement(sessions);
    // Re-run via the underlying checks to know what to expect:
    //   single-session covers P1
    //   stale covers P2
    //   missing-low-end: neither (both reach y=0)
    expect(out).toHaveLength(2);
    const byId = new Map(out.map((r) => [r.inventoryId, r.reasons]));
    expect(byId.get("P1")).toEqual(["single-session"]);
    expect(byId.get("P2")).toEqual(["stale"]);
  });

  it("sorts by reason count descending (most reasons first)", () => {
    const sessions = [
      // P1: single + stale + missing-low-end (worst)
      makeSession({
        InventoryId: "P1",
        Date: "2023-01-01",
        Records: [[10, 5], [20, 100]],
      }),
      // P2: single only
      makeSession({
        InventoryId: "P2",
        Date: "2026-05-01",
        Records: [[0, 0], [10, 100]],
      }),
    ];
    const out = findRecommendedForRemeasurement(sessions);
    expect(out[0].inventoryId).toBe("P1");
    expect(out[0].reasons.length).toBeGreaterThan(out[1].reasons.length);
  });
});
