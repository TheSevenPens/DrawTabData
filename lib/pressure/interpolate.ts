/**
 * Pressure-response curve interpolation and P-value extrapolation.
 *
 * Ported from PenPressureData/app/src/lib/interpolate.js on 2026-05-01.
 * Logic unchanged — only typed and re-exported as part of the shared
 * data-repo lib so any DrawTabData consumer can reuse it.
 *
 * Key concepts:
 *   - A "record" is `[physicalForceGf, logicalPressurePct]`.
 *   - "P-values" are physical-force values at standard logical-pressure
 *     percentiles (P00, P01, ..., P100).
 *   - P00 = Initial Activation Force (IAF) — the force at which the
 *     pen first registers any pressure above 0%.
 *   - P100 = Maximum Force — the force needed to reach 100% pressure.
 *   - Both endpoints are extrapolated using a spring-decay model when
 *     the raw measurements don't reach exactly 0% / 100%.
 */

export type PressureRecord = readonly [number, number];

/**
 * Linear interpolation between adjacent records to find the physical
 * force that yields the target logical pressure.
 *
 * @returns the interpolated physical value, or null if the target lies
 *   outside the range covered by the records.
 */
export function interpolatePhysical(
  records: readonly PressureRecord[],
  targetLogical: number,
): number | null {
  for (let i = 0; i < records.length - 1; i++) {
    const [x0, y0] = records[i];
    const [x1, y1] = records[i + 1];
    if (y0 <= targetLogical && targetLogical <= y1) {
      if (y1 === y0) return x0;
      return x0 + ((targetLogical - y0) * (x1 - x0)) / (y1 - y0);
    }
  }
  return null;
}

function computeSlopes(records: readonly PressureRecord[]): number[] {
  const slopes: number[] = [];
  for (let i = 0; i < records.length - 1; i++) {
    const [x0, y0] = records[i];
    const [x1, y1] = records[i + 1];
    if (x1 > x0) slopes.push((y1 - y0) / (x1 - x0));
  }
  return slopes;
}

/**
 * Exponentially recency-weighted average — last element is "newest"
 * and gets the highest weight (2^(N-1)).
 */
function weightedVelocity(slopes: readonly number[]): number | null {
  if (slopes.length === 0) return null;
  const weights = slopes.map((_, i) => Math.pow(2, i));
  const sumW = weights.reduce((a, b) => a + b, 0);
  return slopes.reduce((sum, v, i) => sum + v * weights[i], 0) / sumW;
}

const N_SLOPES = 4;
const THRESHOLD = 0.5;

/**
 * Estimate the physical force at which logical pressure first rises
 * above 0% (Initial Activation Force / P00).
 *
 * Spring model: imagining a ball rolling backward from the first
 * measured point, its deceleration is proportional to its remaining
 * distance from 0%. This gives exponential decay as x decreases:
 *
 *   y(x) = y_first · exp(k · (x − x_first))   for x < x_first
 *
 * P00 is the x where y drops to 0.5%.
 */
export function estimateP00(records: readonly PressureRecord[]): number | null {
  if (records.length === 0) return null;
  if (records[0][1] <= 0) return records[0][0];
  if (records.length < 2) return null;

  const allSlopes = computeSlopes(records);
  if (allSlopes.length === 0) return null;

  // Earliest slopes are most "recent" for a backward-moving ball.
  const firstSlopes = allSlopes.slice(0, N_SLOPES).reverse();
  const vEff = weightedVelocity(firstSlopes);
  if (vEff === null || vEff <= 0) return null;

  const [xFirst, yFirst] = records[0];
  if (yFirst <= THRESHOLD) return xFirst;

  const k = vEff / yFirst;
  const p00 = xFirst + Math.log(THRESHOLD / yFirst) / k;

  if (p00 < 0) return 0;
  if (p00 >= xFirst) return xFirst;
  return p00;
}

/**
 * Estimate the physical force at which logical pressure reaches 100%
 * (Maximum Force / P100).
 *
 * Spring model: the remaining gap r = 100 − y decays proportionally
 * to itself as x increases. P100 is the x where r drops to 0.5%.
 */
export function estimateP100(records: readonly PressureRecord[]): number | null {
  for (const [x, y] of records) {
    if (y >= 100) return x;
  }
  if (records.length < 2) return null;

  const allSlopes = computeSlopes(records);
  if (allSlopes.length === 0) return null;

  const lastSlopes = allSlopes.slice(-N_SLOPES);
  const vEff = weightedVelocity(lastSlopes);
  if (vEff === null || vEff <= 0) return null;

  const [xLast, yLast] = records[records.length - 1];
  const rLast = 100 - yLast;
  if (rLast <= 0) return xLast;
  if (rLast <= THRESHOLD) return xLast;

  const k = vEff / rLast;
  const p100 = xLast + Math.log(rLast / THRESHOLD) / k;

  if (p100 <= xLast) return xLast;
  if (p100 > xLast * 4) return null;
  return p100;
}

/** Format an interpolated physical value (1 decimal place) or "—" if null. */
export function fmtP(val: number | null): string {
  return val === null ? '—' : val.toFixed(1);
}
