/**
 * Defect lookup helpers.
 *
 * Inventory pens carry a structured `Defects[]` array (controlled
 * vocabulary in `data/reference/defect-kinds.json`); this module
 * builds quick lookups so chart and stats components can flag and
 * exclude defective sessions without re-walking the inventory data.
 */

import type { InventoryPen, PressureResponse } from '../schemas.js';

export interface PenDefect {
  Kind: string;
  Notes: string;
}

export interface DefectInfo {
  defects: PenDefect[];
  /** Pre-formatted "kind1, kind2" string for tooltips and labels. */
  kindsLabel: string;
  /** Pre-formatted "kind1: notes; kind2: notes" string for tooltips. */
  detailsLabel: string;
}

/** Build an `InventoryId → DefectInfo` map from a list of inventory pens. */
export function buildInventoryDefects(
  inventoryPens: readonly InventoryPen[],
): Map<string, DefectInfo> {
  const out = new Map<string, DefectInfo>();
  for (const p of inventoryPens) {
    if (!p.Defects || p.Defects.length === 0) continue;
    const defects = p.Defects.map((d) => ({ Kind: d.Kind, Notes: d.Notes }));
    out.set(p.InventoryId, {
      defects,
      kindsLabel: defects.map((d) => d.Kind).join(', '),
      detailsLabel: defects
        .map((d) => (d.Notes ? `${d.Kind}: ${d.Notes}` : d.Kind))
        .join('; '),
    });
  }
  return out;
}

/** Convenience: is the session's pen unit flagged as defective? */
export function isSessionDefective(
  session: PressureResponse,
  defectsByInventoryId: ReadonlyMap<string, DefectInfo>,
): boolean {
  return defectsByInventoryId.has(session.InventoryId);
}

/** Returns a deduplicated list of "InventoryId (kind1, kind2)" strings for
 * the defective pens that contributed sessions. Useful for the
 * "Excluding N defective pens: ..." note. */
export function excludedPensSummary(
  sessions: readonly PressureResponse[],
  defectsByInventoryId: ReadonlyMap<string, DefectInfo>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of sessions) {
    if (seen.has(s.InventoryId)) continue;
    const info = defectsByInventoryId.get(s.InventoryId);
    if (!info) continue;
    seen.add(s.InventoryId);
    out.push(`${s.InventoryId} (${info.kindsLabel})`);
  }
  return out;
}
