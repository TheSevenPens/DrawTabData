import { describe, expect, it } from "vitest";
import { findSimilarTablets } from "./compat-helpers.js";
import type { Tablet } from "./drawtab-loader.js";

// Width x height chosen so the diagonal is a round number (3-4-5 triangles).
const tablet = (id: string, diag: number, model: Partial<Tablet["Model"]> = {}): Tablet =>
  ({
    Meta: { EntityId: `wacom.tablet.${id}` },
    Model: { Brand: "WACOM", Id: id, Name: id, Type: "PENTABLET", ReleaseYear: "2020", ...model },
    Digitizer: { Dimensions: { Width: diag * 0.8, Height: diag * 0.6 } },
  }) as unknown as Tablet;

const source = tablet("src", 200);
const all = [
  source,
  tablet("tiny", 150), // 75%
  tablet("justunder", 179), // 89.5%
  tablet("floor", 180), // 90%
  tablet("same", 200),
  tablet("bigger", 219), // 109.5%
  tablet("huge", 300), // 150%
  tablet("display", 300, { Type: "PENDISPLAY" }),
];
const ids = (ts: Tablet[]) => ts.map((t) => t.Model.Id);

describe("findSimilarTablets — size", () => {
  it("always excludes the source and other types", () => {
    expect(ids(findSimilarTablets(source, all))).toEqual(["tiny", "justunder", "floor", "same", "bigger", "huge"]);
  });

  it("similarSize keeps diagonals within ±10%", () => {
    expect(ids(findSimilarTablets(source, all, { similarSize: true }))).toEqual(["floor", "same", "bigger"]);
  });

  it("sameSizeOrLarger keeps the similar band and everything bigger (#24)", () => {
    expect(ids(findSimilarTablets(source, all, { sameSizeOrLarger: true }))).toEqual([
      "floor",
      "same",
      "bigger",
      "huge",
    ]);
  });

  it("a tablet with no active area is dropped by either size filter", () => {
    const noSize = { ...tablet("nosize", 200), Digitizer: undefined } as unknown as Tablet;
    expect(ids(findSimilarTablets(source, [noSize], { sameSizeOrLarger: true }))).toEqual([]);
  });

  it("a source with no active area can't be size-filtered, so the filter is skipped", () => {
    const noSize = { ...source, Digitizer: undefined } as unknown as Tablet;
    expect(findSimilarTablets(noSize, all, { sameSizeOrLarger: true })).toHaveLength(6);
  });
});

describe("findSimilarTablets — other filters", () => {
  it("samePen needs an overlapping included pen; sameYearOrLater compares years", () => {
    const withPen = tablet("pen", 200, { IncludedPen: ["wacom.pen.kp504e"], ReleaseYear: "2019" });
    const src = tablet("src", 200, { IncludedPen: ["wacom.pen.kp504e"], ReleaseYear: "2020" });
    expect(ids(findSimilarTablets(src, [withPen, tablet("nopen", 200)], { samePen: true }))).toEqual(["pen"]);
    expect(ids(findSimilarTablets(src, [withPen, tablet("newer", 200, { ReleaseYear: "2021" })], { sameYearOrLater: true }))).toEqual([
      "newer",
    ]);
  });
});
