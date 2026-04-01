import type { Tablet, Pen, PenFamily, TabletFamily, Driver, PenCompat } from "./drawtab-loader.js";
import {
  loadTabletsFromURL, loadPensFromURL, loadPenCompatFromURL,
  loadPenFamiliesFromURL, loadTabletFamiliesFromURL, loadDriversFromURL,
} from "./drawtab-loader.js";
import {
  buildTabletToPenCompatMap, buildPenToTabletCompatMap, buildIncludedPenMap,
} from "./compat-helpers.js";

export interface DrawTabDataAll {
  tablets: Tablet[];
  pens: Pen[];
  penCompat: PenCompat[];
  penFamilies: PenFamily[];
  tabletFamilies: TabletFamily[];
  drivers: Driver[];
  tabletToPens: Map<string, Pen[]>;
  penToTablets: Map<string, Tablet[]>;
  includedPenMap: Map<string, Tablet[]>;
}

export async function loadAllFromURL(baseUrl: string): Promise<DrawTabDataAll> {
  const [tablets, pens, penCompat, penFamilies, tabletFamilies, drivers] = await Promise.all([
    loadTabletsFromURL(baseUrl),
    loadPensFromURL(baseUrl),
    loadPenCompatFromURL(baseUrl),
    loadPenFamiliesFromURL(baseUrl),
    loadTabletFamiliesFromURL(baseUrl),
    loadDriversFromURL(baseUrl),
  ]);

  return {
    tablets,
    pens,
    penCompat,
    penFamilies,
    tabletFamilies,
    drivers,
    tabletToPens: buildTabletToPenCompatMap(penCompat, pens),
    penToTablets: buildPenToTabletCompatMap(penCompat, tablets),
    includedPenMap: buildIncludedPenMap(tablets),
  };
}
