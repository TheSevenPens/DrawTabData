import type { Tablet, Pen, PenCompat } from "./drawtab-loader.js";
import { getDiagonal, brandName } from "./drawtab-loader.js";

export interface SimilarTabletsOptions {
  /** Restrict to tablets within ±10% diagonal of the source. */
  similarSize?: boolean;
  /** Require overlap on at least one Model.IncludedPen entry. */
  samePen?: boolean;
  /** Require the same Brand. */
  sameBrand?: boolean;
  /** Restrict to a specific brand (overrides sameBrand). */
  brand?: string;
  /** Require Model.LaunchYear >= source year. */
  sameYearOrLater?: boolean;
}

/**
 * Find tablets similar to a given source tablet, with optional filters.
 * Always excludes the source tablet itself, and always restricts to the
 * same Model.Type (PENTABLET / PENDISPLAY / STANDALONE) since cross-type
 * comparisons are rarely meaningful.
 */
export function findSimilarTablets(
  source: Tablet,
  candidates: Tablet[],
  options: SimilarTabletsOptions = {},
): Tablet[] {
  let results = candidates.filter(
    (t) => t.Meta.EntityId !== source.Meta.EntityId && t.Model.Type === source.Model.Type,
  );

  if (options.similarSize) {
    const sourceDiag = getDiagonal(source.Digitizer?.Dimensions);
    if (sourceDiag) {
      const tolerance = sourceDiag * 0.1;
      results = results.filter((t) => {
        const d = getDiagonal(t.Digitizer?.Dimensions);
        return d !== null && Math.abs(d - sourceDiag) <= tolerance;
      });
    }
  }

  if (options.samePen && source.Model.IncludedPen && source.Model.IncludedPen.length > 0) {
    const pens = new Set(source.Model.IncludedPen);
    results = results.filter((t) => {
      if (!t.Model.IncludedPen || t.Model.IncludedPen.length === 0) return false;
      return t.Model.IncludedPen.some((p) => pens.has(p));
    });
  }

  if (options.brand) {
    results = results.filter((t) => t.Model.Brand === options.brand);
  } else if (options.sameBrand) {
    results = results.filter((t) => t.Model.Brand === source.Model.Brand);
  }

  if (options.sameYearOrLater && source.Model.LaunchYear) {
    results = results.filter(
      (t) => t.Model.LaunchYear && t.Model.LaunchYear >= source.Model.LaunchYear,
    );
  }

  return results;
}

export function buildTabletToPenCompatMap(
  penCompat: PenCompat[],
  pens: Pen[],
): Map<string, Pen[]> {
  const penMap = new Map(pens.map((p) => [p.PenId, p]));
  const result = new Map<string, Pen[]>();

  for (const row of penCompat) {
    const pen = penMap.get(row.PenId);
    if (!pen) continue;
    const list = result.get(row.TabletId);
    if (list) {
      list.push(pen);
    } else {
      result.set(row.TabletId, [pen]);
    }
  }

  return result;
}

export function buildPenToTabletCompatMap(
  penCompat: PenCompat[],
  tablets: Tablet[],
): Map<string, Tablet[]> {
  const tabletMap = new Map(tablets.map((t) => [t.Model.Id, t]));
  const result = new Map<string, Tablet[]>();

  for (const row of penCompat) {
    const tablet = tabletMap.get(row.TabletId);
    if (!tablet) continue;
    const list = result.get(row.PenId);
    if (list) {
      list.push(tablet);
    } else {
      result.set(row.PenId, [tablet]);
    }
  }

  return result;
}

export function buildIncludedPenMap(
  tablets: Tablet[],
): Map<string, Tablet[]> {
  const result = new Map<string, Tablet[]>();

  for (const tablet of tablets) {
    if (!tablet.Model.IncludedPen || tablet.Model.IncludedPen.length === 0) continue;
    for (const penId of tablet.Model.IncludedPen) {
      const id = penId.trim();
      if (!id) continue;
      const list = result.get(id);
      if (list) {
        list.push(tablet);
      } else {
        result.set(id, [tablet]);
      }
    }
  }

  return result;
}

/**
 * Build a Map from pen EntityId to a formatted display name.
 * E.g. "WACOM.PEN.KP501E" -> "Wacom Grip Pen (KP-501E)"
 */
export function buildPenNameMap(pens: Pen[]): Map<string, string> {
  return new Map(
    pens.map((p) => [p.EntityId, `${brandName(p.Brand)} ${p.PenName} (${p.PenId})`]),
  );
}

/**
 * Resolve an array of PenId strings to their display names using a
 * pre-built name map, falling back to the raw ID if not found.
 */
export function formatPenIds(
  ids: string[],
  penNameMap: Map<string, string>,
): string {
  return ids.map((id) => penNameMap.get(id) ?? id).join(", ");
}
