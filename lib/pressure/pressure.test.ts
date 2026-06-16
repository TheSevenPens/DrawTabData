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
  estimatePiaf,
  estimatePmax,
  fmtP,
  type PressureRecord,
} from "./interpolate.js";
import { resolveIafByUnit } from "./iaf-resolve.js";
import type { PressureRange } from "../schemas.js";
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

describe("estimatePiaf", () => {
  it("returns null on empty input", () => {
    expect(estimatePiaf([])).toBeNull();
  });

  it("returns midpoint of last-zero and first-nonzero when the session brackets activation", () => {
    // Piaf sits between the highest-force 0% sample and the lowest-force non-0% sample.
    expect(estimatePiaf([[3, 0], [5, 50]])).toBe(4);
    expect(estimatePiaf([[3, -1], [5, 50]])).toBe(4);
  });

  it("picks the WIDEST 0%-to-non-0% bracket (max-A and min-B across all records)", () => {
    // Several 0% samples then several non-0%: A = highest-force 0%,
    // B = lowest-force non-0%. Records intentionally out-of-order to
    // verify the scan doesn't assume sorted input.
    const records: PressureRecord[] = [
      [5, 0],
      [9.2, 0], // ← A (last 0%)
      [0.3, 0],
      [9.6, 0.01], // ← B (first non-0%)
      [12, 50],
      [20, 100],
    ];
    expect(estimatePiaf(records)).toBeCloseTo(9.4, 10); // (9.2 + 9.6) / 2
  });

  it("returns null when there's no 0%-to-non-0% bracket", () => {
    // No samples at y ≤ 0 → the bracket branch can't fire. The
    // spring-decay extrapolation that previously filled this gap was
    // removed in issue #212; sessions without an activation sample now
    // report null so the UI surfaces "no estimate available".
    const records: PressureRecord[] = [
      [10, 20],
      [12, 40],
      [14, 60],
      [16, 80],
      [18, 100],
    ];
    expect(estimatePiaf(records)).toBeNull();
  });

  it("returns null when only one record is supplied (no bracket)", () => {
    expect(estimatePiaf([[10, 50]])).toBeNull();
  });

  it("returns null when every record sits at 0% (no first-non-zero to bracket against)", () => {
    // All-zero sessions can't estimate activation — we know the pen hasn't
    // activated by max(x), but we don't know how far above that it would.
    expect(estimatePiaf([[3, 0], [5, 0]])).toBeNull();
  });
});

describe("estimatePmax", () => {
  it("returns null on empty input", () => {
    expect(estimatePmax([])).toBeNull();
  });

  it("returns midpoint of last-non-100 and first-saturated when the session brackets saturation", () => {
    // Pmax sits between the last record below 100% and the first record at-or-above 100%.
    expect(estimatePmax([[0, 0], [8, 80], [10, 100]])).toBe(9); // (8 + 10) / 2
    expect(estimatePmax([[0, 0], [8, 80], [10, 105]])).toBe(9); // y ≥ 100 counts as saturated
  });

  it("picks the WIDEST non-100-to-saturated bracket (max-C and min-D across all records)", () => {
    // Mixed order — verify the scan finds max(x where y<100) and min(x where y>=100).
    const records: PressureRecord[] = [
      [10, 100],
      [5, 50],
      [12, 100],
      [9, 99.9], // ← C (last sub-100)
      [8, 80],
      [11, 100], // 11 > 10, so D stays at 10
    ];
    expect(estimatePmax(records)).toBeCloseTo(9.5, 10); // (9 + 10) / 2
  });

  it("returns the lowest saturated x when every record is already at-or-above 100%", () => {
    // No sub-100 samples → no bracket midpoint, but we still know the
    // pen had saturated by the lowest recorded force. Preserves the
    // pre-bracket-logic behaviour for saturated-only sessions.
    expect(estimatePmax([[8, 100], [10, 100], [12, 105]])).toBe(8);
  });

  it("returns null when the curve never reaches 100%", () => {
    // Records stop at 80%. Without a y ≥ 100 sample the bracket branch
    // can't fire, and the spring-decay extrapolation that previously
    // filled this gap was removed in issue #212.
    const records: PressureRecord[] = [
      [10, 20],
      [12, 40],
      [14, 60],
      [16, 80],
    ];
    expect(estimatePmax(records)).toBeNull();
  });

  it("returns null on single-record inputs that don't reach 100", () => {
    expect(estimatePmax([[5, 50]])).toBeNull();
  });

  it("returns null when the curve is close to 100% but doesn't cross it", () => {
    // Pre-#212 a 0.5% gap-to-100 short-circuited to xLast; post-#212 we
    // require an actual y ≥ 100 sample (or the saturated-only fallback).
    expect(estimatePmax([[0, 0], [10, 99.7]])).toBeNull();
    expect(estimatePmax([[0, 0], [10, 99.5]])).toBeNull();
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
    expect(result[0].firstDrop).toEqual({ axis: "logical", index: 2, from: 50, to: 40 });
  });

  it("flags sessions whose physical force x drops as the array progresses", () => {
    // Mirrors the real-world case from WAP.0025 / 2025-04-05: a record's
    // physical-force value sits below the running max from an earlier
    // record, even though logical pressure is still increasing.
    const session = makeSession({
      Records: [
        [0, 0],
        [10, 50],
        [20, 90],
        [18, 95], // x drops 20 -> 18 (y still increasing)
        [25, 100],
      ],
    });
    const result = findNonMonotonicSessions([session]);
    expect(result).toHaveLength(1);
    expect(result[0].firstDrop).toEqual({ axis: "force", index: 3, from: 20, to: 18 });
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
    expect(result[0].firstDrop.axis).toBe("logical");
  });

  it("when both axes drop in the same session, reports whichever happens first", () => {
    // Logical drop at index 2, force drop at index 4. Logical wins because
    // the scan stops at the earliest drop.
    const yFirst = makeSession({
      Records: [
        [0, 0],
        [5, 50],
        [10, 40], // logical drop
        [15, 60],
        [12, 70], // force drop, never reached
      ],
    });
    const r1 = findNonMonotonicSessions([yFirst]);
    expect(r1[0].firstDrop.axis).toBe("logical");
    expect(r1[0].firstDrop.index).toBe(2);

    // Mirror: force drop comes first.
    const xFirst = makeSession({
      Records: [
        [0, 0],
        [10, 30],
        [8, 40], // force drop
        [12, 50],
        [15, 40], // logical drop, never reached
      ],
    });
    const r2 = findNonMonotonicSessions([xFirst]);
    expect(r2[0].firstDrop.axis).toBe("force");
    expect(r2[0].firstDrop.index).toBe(2);
  });

  it("treats equal values as monotonic on both axes (≥, not strictly >)", () => {
    const flat = makeSession({
      Records: [
        [0, 0],
        [5, 50],
        [10, 50], // logical plateau, not a drop
        [10, 70], // force plateau, not a drop
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

// --- iaf-resolve.ts --------------------------------------------------------

describe("resolveIafByUnit", () => {
  function makeMeasurement(over: Partial<PressureRange>): PressureRange {
    return {
      Brand: "WACOM",
      PenEntityId: "wacom.pen.kp504e",
      PenInventoryId: "WAP.0001",
      Metric: "IAF",
      Value: "3.7",
      Date: "2026-06-14",
      TabletEntityId: "wacom.tablet.pth660",
      Driver: "WACOM",
      OS: "WINDOWS",
      Method: "PenPressureProfiler1.8",
      _id: "00000000-0000-0000-0000-000000000010",
      _CreateDate: "2026-06-14T00:00:00.000Z",
      _ModifiedDate: "2026-06-14T00:00:00.000Z",
      ...over,
    } as PressureRange;
  }

  it("uses the direct measurement when one exists (measured wins over the estimate)", () => {
    const sessions = [
      makeSession({ InventoryId: "WAP.0001", Records: [[3, 0], [5, 50], [10, 100]] }), // estimate ~4
    ];
    const measurements = [makeMeasurement({ PenInventoryId: "WAP.0001", Value: "3.7" })];
    const out = resolveIafByUnit(sessions, measurements);
    expect(out).toEqual([
      { inventoryId: "WAP.0001", penEntityId: "wacom.pen.kp504e", value: 3.7, source: "measured", count: 1 },
    ]);
  });

  it("falls back to the median estimated Piaf when no measurement exists", () => {
    const sessions = [
      makeSession({ InventoryId: "WAP.0002", Records: [[3, 0], [5, 50]] }), // Piaf = 4
      makeSession({ InventoryId: "WAP.0002", Records: [[5, 0], [9, 50]] }), // Piaf = 7
    ];
    const out = resolveIafByUnit(sessions, []);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ inventoryId: "WAP.0002", source: "estimated", count: 2 });
    expect(out[0].value).toBeCloseTo(5.5, 10); // median(4, 7)
  });

  it("takes the median of multiple direct measurements for a unit", () => {
    const measurements = [
      makeMeasurement({ PenInventoryId: "WAP.0003", Value: "2.0" }),
      makeMeasurement({ PenInventoryId: "WAP.0003", Value: "4.0" }),
      makeMeasurement({ PenInventoryId: "WAP.0003", Value: "3.0" }),
    ];
    const out = resolveIafByUnit([], measurements);
    expect(out[0]).toMatchObject({ inventoryId: "WAP.0003", value: 3, source: "measured", count: 3 });
  });

  it("resolves each unit independently and includes measured-only units", () => {
    const sessions = [
      makeSession({ InventoryId: "WAP.0002", Records: [[3, 0], [5, 50]] }), // estimate-only unit
    ];
    const measurements = [makeMeasurement({ PenInventoryId: "WAP.0001", Value: "3.7" })]; // measured-only unit
    const out = resolveIafByUnit(sessions, measurements);
    const byId = new Map(out.map((r) => [r.inventoryId, r]));
    expect(byId.get("WAP.0001")?.source).toBe("measured");
    expect(byId.get("WAP.0002")?.source).toBe("estimated");
  });

  it("omits units with neither a measurement nor a finite estimate", () => {
    // Session never brackets activation → estimatePiaf null → no estimate.
    const sessions = [makeSession({ InventoryId: "WAP.0009", Records: [[10, 20], [12, 40]] })];
    expect(resolveIafByUnit(sessions, [])).toEqual([]);
  });
});
