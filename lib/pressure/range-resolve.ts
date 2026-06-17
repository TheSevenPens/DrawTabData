/**
 * Per-unit / per-sample resolution of a pressure-range metric (IAF or MAX).
 *
 * "Measured wins" at every level: a pen unit that has any direct measurement
 * (a PressureRange row for the metric) is resolved from those measurements and
 * its estimates are ignored; a unit with no measurement falls back to the
 * estimates derived from its pressure-response sessions. So per pen unit
 * (PenInventoryId):
 *
 *   measured samples (the unit's direct measurements)   ← if any exist
 *   else estimated samples (one per pressure session)
 *   else the unit is omitted
 *
 * The three tab views are all derived from this single resolution:
 *
 *   - by sample  → the unit's resolved-source datapoints, listed individually
 *   - by unit    → the median of those datapoints (one value per unit)
 *   - summary    → min / median / max across the per-unit values
 *
 * The estimate uses the same bracket-midpoint estimators as everywhere else
 * (estimatePiaf for IAF, estimatePmax for MAX). Pass sessions already scoped
 * to the entity and filtered to non-defective units — the caller owns the
 * defective filter, matching the other pressure views.
 */

import type { PressureResponse, PressureRange } from "../drawtab-loader.js";
import { estimatePiaf, estimatePmax, type PressureRecord } from "./interpolate.js";
import { sessionEntityId } from "./session-id.js";

export type RangeMetric = "IAF" | "MAX";
export type RangeSource = "measured" | "estimated";

/** A single datapoint for a unit: either a direct measurement or the estimate
 * derived from one pressure-response session. */
export interface RangeSample {
  inventoryId: string;
  penEntityId: string;
  tabletEntityId: string;
  driver: string;
  date: string;
  value: number;
  source: RangeSource;
  /** Set for estimated samples (one per pressure session) so the UI can link
   * back to the session detail page. Absent for measured samples. */
  sessionEntityId?: string;
}

export interface ResolvedRangeUnit {
  inventoryId: string;
  penEntityId: string;
  /** Median of `samples` (which all share `source`). */
  value: number;
  source: RangeSource;
  /** Number of backing datapoints (direct measurements or sessions). */
  count: number;
  /** The resolved-source datapoints — measured when any measurement exists,
   * otherwise the estimated ones. */
  samples: RangeSample[];
}

const ESTIMATORS: Record<RangeMetric, (r: readonly PressureRecord[]) => number | null> = {
  IAF: estimatePiaf,
  MAX: estimatePmax,
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function pushSample(map: Map<string, RangeSample[]>, id: string, sample: RangeSample): void {
  const g = map.get(id);
  if (g) g.push(sample);
  else map.set(id, [sample]);
}

/**
 * Resolve one value (and its backing samples) per pen unit for the given
 * metric across the supplied sessions and direct measurements. Units with
 * neither a measurement nor a finite estimate are omitted.
 */
export function resolveRangeByUnit(
  metric: RangeMetric,
  sessions: readonly PressureResponse[],
  measurements: readonly PressureRange[],
): ResolvedRangeUnit[] {
  const estimate = ESTIMATORS[metric];

  const measuredByUnit = new Map<string, RangeSample[]>();
  for (const m of measurements) {
    if (m.Metric !== metric) continue;
    const v = Number(m.Value);
    if (!Number.isFinite(v)) continue;
    pushSample(measuredByUnit, m.PenInventoryId, {
      inventoryId: m.PenInventoryId,
      penEntityId: m.PenEntityId,
      tabletEntityId: m.TabletEntityId,
      driver: m.Driver,
      date: m.Date,
      value: v,
      source: "measured",
    });
  }

  const estByUnit = new Map<string, RangeSample[]>();
  for (const s of sessions) {
    const v = estimate(s.Records);
    if (v === null || !Number.isFinite(v)) continue;
    pushSample(estByUnit, s.InventoryId, {
      inventoryId: s.InventoryId,
      penEntityId: s.PenEntityId,
      tabletEntityId: s.TabletEntityId,
      driver: s.Driver,
      date: s.Date,
      value: v,
      source: "estimated",
      sessionEntityId: sessionEntityId(s),
    });
  }

  const out: ResolvedRangeUnit[] = [];
  const units = new Set<string>([...measuredByUnit.keys(), ...estByUnit.keys()]);
  for (const id of units) {
    const measured = measuredByUnit.get(id);
    const samples = measured && measured.length > 0 ? measured : (estByUnit.get(id) ?? []);
    if (samples.length === 0) continue;
    out.push({
      inventoryId: id,
      penEntityId: samples[0].penEntityId || "",
      value: median(samples.map((s) => s.value)),
      source: samples[0].source,
      count: samples.length,
      samples,
    });
  }
  return out;
}

// --- Slim IAF-specific view ------------------------------------------------
//
// The pen-analysis rankings and the data-quality "estimated, not measured"
// check only need one resolved value per unit, not the backing samples.

export type IafSource = RangeSource;

export interface ResolvedUnitIaf {
  inventoryId: string;
  penEntityId: string;
  value: number;
  source: IafSource;
  /** Backing count: direct measurements (measured) or sessions (estimated). */
  count: number;
}

/** IAF convenience wrapper returning the slim per-unit shape. */
export function resolveIafByUnit(
  sessions: readonly PressureResponse[],
  measurements: readonly PressureRange[],
): ResolvedUnitIaf[] {
  return resolveRangeByUnit("IAF", sessions, measurements).map(
    ({ inventoryId, penEntityId, value, source, count }) => ({
      inventoryId,
      penEntityId,
      value,
      source,
      count,
    }),
  );
}
