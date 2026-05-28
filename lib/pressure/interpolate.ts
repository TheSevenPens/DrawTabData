/**
 * Pressure-response curve interpolation and P-value estimation.
 *
 * Key concepts:
 *   - A "record" is `[physicalForceGf, logicalPressurePct]`.
 *   - "P-values" are physical-force values at standard logical-pressure
 *     percentiles (P00, P01, ..., P100).
 *   - P00 = Initial Activation Force (IAF) — the force at which the
 *     pen first registers any pressure above 0%.
 *   - P100 = Maximum Force — the force needed to reach 100% pressure.
 *   - Both endpoints are estimated via a bracket-midpoint algorithm.
 *     Sessions that don't capture the activation / saturation transition
 *     return null (per issue #212; the legacy spring-decay extrapolation
 *     was removed once the dataset was backfilled with explicit 0% / 100%
 *     samples wherever those could plausibly be inferred).
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

/**
 * Estimate the physical force at which logical pressure first rises
 * above 0% (Initial Activation Force / P00).
 *
 * **Bracket midpoint.** Let
 *   A = max(x) over records with y ≤ 0
 *   B = min(x) over records with y > 0
 * If both exist and A < B, the pen activated somewhere in (A, B] and
 * P00 = (A + B) / 2 is the best we can say without finer sampling.
 *
 * Returns null when the session doesn't bracket activation. Callers
 * (PressureChart, SessionStats, pen-analysis rankings) treat null as
 * "no estimate available" and hide the corresponding row / dashed line.
 */
export function estimateP00(records: readonly PressureRecord[]): number | null {
  if (records.length === 0) return null;

  let aMax: number | null = null; // highest x where y ≤ 0
  let bMin: number | null = null; // lowest  x where y > 0
  for (const [x, y] of records) {
    if (y <= 0) {
      if (aMax === null || x > aMax) aMax = x;
    } else {
      if (bMin === null || x < bMin) bMin = x;
    }
  }
  if (aMax !== null && bMin !== null && aMax < bMin) {
    return (aMax + bMin) / 2;
  }
  return null;
}

/**
 * Estimate the physical force at which logical pressure reaches 100%
 * (Maximum Force / P100).
 *
 * **Bracket midpoint.** Let
 *   C = max(x) over records with y < 100
 *   D = min(x) over records with y ≥ 100
 * If both exist and C < D, the pen saturated somewhere in (C, D] and
 * P100 = (C + D) / 2.
 *
 * **Saturated-only fallback.** When every record reads y ≥ 100, no
 * bracket exists but we still know the pen had saturated by the
 * lowest-force record. Return that x to preserve the pre-existing
 * behaviour for already-saturated sessions.
 *
 * Otherwise returns null (the session never reaches saturation and the
 * spring-decay extrapolation that previously filled this gap was
 * removed in issue #212).
 */
export function estimateP100(records: readonly PressureRecord[]): number | null {
  if (records.length === 0) return null;

  let cMax: number | null = null; // highest x where y < 100
  let dMin: number | null = null; // lowest  x where y ≥ 100
  for (const [x, y] of records) {
    if (y >= 100) {
      if (dMin === null || x < dMin) dMin = x;
    } else {
      if (cMax === null || x > cMax) cMax = x;
    }
  }
  if (cMax !== null && dMin !== null && cMax < dMin) {
    return (cMax + dMin) / 2;
  }
  // Saturated-only session: keep the legacy "first saturated x" behaviour.
  if (cMax === null && dMin !== null) return dMin;
  return null;
}

/** Format an interpolated physical value (1 decimal place) or "—" if null. */
export function fmtP(val: number | null): string {
  return val === null ? '—' : val.toFixed(1);
}
