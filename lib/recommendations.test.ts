import { describe, expect, it } from "vitest";
import { currentPrice, currentRating, launchPrice, ratingRank } from "./recommendations.js";
import type { Price, Rating } from "./schemas.js";

const meta = { _id: "00000000-0000-0000-0000-000000000000", _CreateDate: "2026-01-01T00:00:00.000Z", _ModifiedDate: "2026-01-01T00:00:00.000Z" };
const rating = (Date: string, r: Rating["Rating"], Context?: string): Rating => ({ EntityId: "x.tablet.a", Brand: "WACOM", Date, Rating: r, Context, Source: "test", ...meta });
const price = (Kind: Price["Kind"], Amount: string, Date: string | undefined, extra: Partial<Price> = {}): Price => ({
  EntityId: "x.tablet.a", Brand: "WACOM", Kind, Amount, Currency: "USD", Date, CheckedOn: "2026-11-04", Primary: false, Source: "test", ...meta, ...extra,
});

describe("currentRating", () => {
  it("takes the newest rating", () => {
    expect(currentRating([rating("2024-01-01", "GOOD"), rating("2025-01-01", "EXCELLENT")])?.rating).toBe("EXCELLENT");
  });
  it("is null once the newest record delists the device", () => {
    expect(currentRating([rating("2024-01-01", "GOOD"), rating("2025-01-01", "DELISTED")])).toBeNull();
  });
  it("reports a conflict between contexts", () => {
    const c = currentRating([rating("2024-01-01", "GOOD", "small"), rating("2024-01-01", "OK", "medium")]);
    expect(c?.rating).toBe("GOOD");
    expect(c?.conflict).toHaveLength(2);
  });
  it("ranks DELISTED and unknown values last", () => {
    expect(ratingRank("EXCELLENT")).toBe(0);
    expect(ratingRank("DELISTED")).toBe(ratingRank("nonsense"));
  });
});

describe("prices", () => {
  it("current is the newest CURRENT price in the currency", () => {
    const rows = [price("CURRENT", "100", "2026-01-01"), price("CURRENT", "90", "2026-11-04"), price("CURRENT", "1", "2026-12-01", { Currency: "JPY" })];
    expect(currentPrice(rows)?.Amount).toBe("90");
  });
  it("launch prefers LAUNCH, else the earliest RETAIL", () => {
    expect(launchPrice([price("RETAIL", "300", "2020-05-01"), price("LAUNCH", "350", "2020-01-01")])?.Amount).toBe("350");
    expect(launchPrice([price("RETAIL", "300", "2021-05-01"), price("RETAIL", "320", "2020-05-01")])?.Amount).toBe("320");
    expect(launchPrice([price("CURRENT", "1", "2026-01-01")])).toBeNull();
  });
});
