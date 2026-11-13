// Reading the dated recommendation and price records: which rating and
// which price are "current". Records are never edited, so "current" is
// always derived from the history. See docs/RECOMMENDATIONS.md and
// docs/PRICES.md.
import type { Rating, Price } from "./schemas.js";
import { RATINGS } from "./schemas.js";

export type RatingValue = (typeof RATINGS)[number];

/** Best rating first: EXCELLENT = 0 … AVOID = 4. */
export const ratingRank = (r: string | null | undefined): number => {
  const i = RATINGS.indexOf(r as RatingValue);
  return i < 0 || r === "DELISTED" ? RATINGS.length : i;
};

export interface CurrentRating {
  rating: RatingValue;
  since: string;
  basis: string | null;
  /** Set when the newest ratings from different Contexts disagree. */
  conflict: { rating: RatingValue; context: string | null; date: string }[] | null;
}

/**
 * A device's current rating: the newest rating per Context (imported records
 * carry the docs page they came from; new ones have none), dropping
 * DELISTED, then the newest of those. Null when nothing live remains.
 */
export function currentRating(history: readonly Rating[]): CurrentRating | null {
  const latest = new Map<string, Rating>();
  for (const r of [...history].sort((a, b) => a.Date.localeCompare(b.Date))) latest.set(r.Context ?? "", r);
  const live = [...latest.values()].filter((r) => r.Rating !== "DELISTED");
  if (!live.length) return null;
  live.sort((a, b) => b.Date.localeCompare(a.Date) || ratingRank(a.Rating) - ratingRank(b.Rating));
  const distinct = new Set(live.map((r) => r.Rating));
  return {
    rating: live[0].Rating,
    since: live[0].Date,
    basis: live[0].Basis ?? null,
    conflict: distinct.size > 1 ? live.map((r) => ({ rating: r.Rating, context: r.Context ?? null, date: r.Date })) : null,
  };
}

/** The newest CURRENT price in a currency (USD by default); primary breaks ties. */
export function currentPrice(prices: readonly Price[], currency = "USD"): Price | null {
  return newestOfKind(prices, "CURRENT", currency);
}

/** The launch price in a currency; falls back to the earliest dated RETAIL price. */
export function launchPrice(prices: readonly Price[], currency = "USD"): Price | null {
  const launch = prices.filter((p) => p.Kind === "LAUNCH" && p.Currency === currency);
  if (launch.length) return [...launch].sort((a, b) => Number(b.Primary) - Number(a.Primary) || (a.Date ?? "").localeCompare(b.Date ?? ""))[0];
  const retail = prices.filter((p) => p.Kind === "RETAIL" && p.Currency === currency);
  return [...retail].sort((a, b) => Number(b.Primary) - Number(a.Primary) || (a.Date ?? "9").localeCompare(b.Date ?? "9"))[0] ?? null;
}

function newestOfKind(prices: readonly Price[], kind: Price["Kind"], currency: string): Price | null {
  const rows = prices.filter((p) => p.Kind === kind && p.Currency === currency);
  return [...rows].sort((a, b) => (b.Date ?? "").localeCompare(a.Date ?? "") || Number(b.Primary) - Number(a.Primary))[0] ?? null;
}
