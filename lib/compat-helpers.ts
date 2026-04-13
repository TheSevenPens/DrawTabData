import type { Tablet, Pen, PenCompat } from "./drawtab-loader.js";
import { getDiagonal, brandName } from "./drawtab-loader.js";

export interface SimilarTabletsOptions {
  /** Restrict to tablets within ±10% diagonal of the source. */
  similarSize?: boolean;
  /** Require overlap on at least one ModelIncludedPen entry. */
  samePen?: boolean;
  /** Require the same Brand. */
  sameBrand?: boolean;
  /** Restrict to a specific brand (overrides sameBrand). */
  brand?: string;
  /** Require ModelLaunchYear >= source year. */
  sameYearOrLater?: boolean;
}

/**
 * Find tablets similar to a given source tablet, with optional filters.
 * Always excludes the source tablet itself, and always restricts to the
 * same ModelType (PENTABLET / PENDISPLAY / STANDALONE) since cross-type
 * comparisons are rarely meaningful.
 */
export function findSimilarTablets(
  source: Tablet,
  candidates: Tablet[],
  options: SimilarTabletsOptions = {},
): Tablet[] {
  let results = candidates.filter(
    (t) => t.EntityId !== source.EntityId && t.ModelType === source.ModelType,
  );

  if (options.similarSize) {
    const sourceDiag = getDiagonal(source.DigitizerDimensions);
    if (sourceDiag) {
      const tolerance = sourceDiag * 0.1;
      results = results.filter((t) => {
        const d = getDiagonal(t.DigitizerDimensions);
        return d !== null && Math.abs(d - sourceDiag) <= tolerance;
      });
    }
  }

  if (options.samePen && source.ModelIncludedPen && source.ModelIncludedPen.length > 0) {
    const pens = new Set(source.ModelIncludedPen);
    results = results.filter((t) => {
      if (!t.ModelIncludedPen || t.ModelIncludedPen.length === 0) return false;
      return t.ModelIncludedPen.some((p) => pens.has(p));
    });
  }

  if (options.brand) {
    results = results.filter((t) => t.Brand === options.brand);
  } else if (options.sameBrand) {
    results = results.filter((t) => t.Brand === source.Brand);
  }

  if (options.sameYearOrLater && source.ModelLaunchYear) {
    results = results.filter(
      (t) => t.ModelLaunchYear && t.ModelLaunchYear >= source.ModelLaunchYear,
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
  const tabletMap = new Map(tablets.map((t) => [t.ModelId, t]));
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
    if (!tablet.ModelIncludedPen || tablet.ModelIncludedPen.length === 0) continue;
    for (const penId of tablet.ModelIncludedPen) {
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
 * Build a Map from PenId to a formatted display name.
 * E.g. "KP-501E" -> "Wacom Grip Pen (KP-501E)"
 */
export function buildPenNameMap(pens: Pen[]): Map<string, string> {
  return new Map(
    pens.map((p) => [p.PenId, `${brandName(p.Brand)} ${p.PenName} (${p.PenId})`]),
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
