import type { Tablet, Pen, PenFamily, TabletFamily, Driver, PenCompat, PressureResponse } from "./drawtab-loader.js";
import {
  loadTabletsFromURL, loadPensFromURL, loadPenCompatFromURL,
  loadPenFamiliesFromURL, loadTabletFamiliesFromURL, loadDriversFromURL,
  loadPressureResponseFromURL,
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
  pressureResponse: PressureResponse[];
  tabletToPens: Map<string, Pen[]>;
  penToTablets: Map<string, Tablet[]>;
  includedPenMap: Map<string, Tablet[]>;
}

export async function loadAllFromURL(baseUrl: string): Promise<DrawTabDataAll> {
  const [tablets, pens, penCompat, penFamilies, tabletFamilies, drivers, pressureResponse] = await Promise.all([
    loadTabletsFromURL(baseUrl),
    loadPensFromURL(baseUrl),
    loadPenCompatFromURL(baseUrl),
    loadPenFamiliesFromURL(baseUrl),
    loadTabletFamiliesFromURL(baseUrl),
    loadDriversFromURL(baseUrl),
    loadPressureResponseFromURL(baseUrl),
  ]);

  return {
    tablets,
    pens,
    penCompat,
    penFamilies,
    tabletFamilies,
    drivers,
    pressureResponse,
    tabletToPens: buildTabletToPenCompatMap(penCompat, pens),
    penToTablets: buildPenToTabletCompatMap(penCompat, tablets),
    includedPenMap: buildIncludedPenMap(tablets),
  };
}
