/**
 * Per-unit IAF resolution.
 *
 * The "IAF for a pen unit" prefers a *direct* measurement (PressureRange,
 * Metric === "IAF") over the *estimated* Piaf derived from that unit's
 * pressure-response sessions. The rule, per pen unit (PenInventoryId):
 *
 *   measured value (median of direct measurements)   ← if any exist
 *   else median estimated Piaf across the unit's sessions
 *   else omitted
 *
 * Consumers (the IAF tab, pen-analysis IAF sections) render one value per
 * unit and use `source` to distinguish trustworthy measured values from
 * rough estimates. The estimate fallback uses the same `estimatePiaf`
 * bracket-midpoint as everywhere else.
 */

import type { PressureResponse, PressureRange } from "../drawtab-loader.js";
import { estimatePiaf } from "./interpolate.js";

export type IafSource = "measured" | "estimated";

export interface ResolvedUnitIaf {
  inventoryId: string;
  penEntityId: string;
  value: number;
  source: IafSource;
  /** Backing count: direct measurements (measured) or sessions (estimated). */
  count: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/** Median direct-IAF value per inventory id (only `Metric === "IAF"` rows). */
export function measuredIafByInventoryId(
  measurements: readonly PressureRange[],
): Map<string, { value: number; count: number; penEntityId: string }> {
  const byUnit = new Map<string, { vals: number[]; penEntityId: string }>();
  for (const m of measurements) {
    if (m.Metric !== "IAF") continue;
    const v = Number(m.Value);
    if (!Number.isFinite(v)) continue;
    const g = byUnit.get(m.PenInventoryId);
    if (g) g.vals.push(v);
    else byUnit.set(m.PenInventoryId, { vals: [v], penEntityId: m.PenEntityId });
  }
  const out = new Map<string, { value: number; count: number; penEntityId: string }>();
  for (const [id, g] of byUnit) {
    out.set(id, { value: median(g.vals), count: g.vals.length, penEntityId: g.penEntityId });
  }
  return out;
}

/**
 * Resolve one IAF value per pen unit across the supplied sessions and direct
 * measurements. Pass sessions already filtered to the entity of interest and
 * to non-defective units (the caller owns the defective filter, matching the
 * other pressure views). Units with neither a measurement nor a finite
 * estimate are omitted.
 */
export function resolveIafByUnit(
  sessions: readonly PressureResponse[],
  measurements: readonly PressureRange[],
): ResolvedUnitIaf[] {
  const measured = measuredIafByInventoryId(measurements);

  const estByUnit = new Map<string, { vals: number[]; penEntityId: string }>();
  for (const s of sessions) {
    const v = estimatePiaf(s.Records);
    if (v === null || !Number.isFinite(v)) continue;
    const g = estByUnit.get(s.InventoryId);
    if (g) g.vals.push(v);
    else estByUnit.set(s.InventoryId, { vals: [v], penEntityId: s.PenEntityId });
  }

  const out: ResolvedUnitIaf[] = [];
  const units = new Set<string>([...measured.keys(), ...estByUnit.keys()]);
  for (const id of units) {
    const m = measured.get(id);
    if (m) {
      out.push({
        inventoryId: id,
        penEntityId: m.penEntityId || estByUnit.get(id)?.penEntityId || "",
        value: m.value,
        source: "measured",
        count: m.count,
      });
      continue;
    }
    const est = estByUnit.get(id);
    if (est && est.vals.length > 0) {
      out.push({
        inventoryId: id,
        penEntityId: est.penEntityId,
        value: median(est.vals),
        source: "estimated",
        count: est.vals.length,
      });
    }
  }
  return out;
}
