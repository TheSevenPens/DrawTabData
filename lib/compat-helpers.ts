import type { Tablet, Pen, PenCompat } from "./drawtab-loader.js";

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
    if (!tablet.ModelIncludedPen) continue;
    for (const penId of tablet.ModelIncludedPen.split(",")) {
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
