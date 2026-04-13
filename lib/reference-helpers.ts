import type { ISOPaperSize } from "./drawtab-loader.js";

export interface ISOPaperMatch {
  /** The matched paper size name, e.g. "A4" */
  name: string;
  /** Diagonal of the matched paper size in mm */
  diagonalMm: number;
  /** Signed percentage difference: positive = tablet is larger, negative = smaller */
  percentDiff: number;
  /** Human-readable qualifier, e.g. "10% larger than A4" or "~ A4" */
  label: string;
}

/**
 * Find the ISO A-series paper size whose diagonal is closest to the
 * given diagonal in mm. Returns the match with percentage difference
 * and a formatted label.
 */
export function findClosestISOPaperSize(
  diagonalMm: number,
  sizes: ISOPaperSize[],
): ISOPaperMatch | null {
  const aSeries = sizes.filter((s) => s.Series === "A");
  if (aSeries.length === 0) return null;

  let best = aSeries[0];
  let bestDiag = Math.sqrt(best.Width_mm ** 2 + best.Height_mm ** 2);
  let bestDist = Math.abs(bestDiag - diagonalMm);

  for (const p of aSeries) {
    const pDiag = Math.sqrt(p.Width_mm ** 2 + p.Height_mm ** 2);
    const dist = Math.abs(pDiag - diagonalMm);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
      bestDiag = pDiag;
    }
  }

  const pct = Math.round(
    Math.abs(diagonalMm - bestDiag) / bestDiag * 100,
  );

  let label: string;
  if (pct >= 1) {
    label = diagonalMm > bestDiag
      ? `${pct}% larger than ${best.Name}`
      : `${pct}% smaller than ${best.Name}`;
  } else {
    label = `~ ${best.Name}`;
  }

  return {
    name: best.Name,
    diagonalMm: bestDiag,
    percentDiff: diagonalMm > bestDiag ? pct : -pct,
    label,
  };
}
