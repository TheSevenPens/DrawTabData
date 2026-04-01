import type { DrawTabDataAll } from "./drawtab-all.js";
import {
  loadTabletsFromDisk, loadPensFromDisk, loadPenCompatFromDisk,
  loadPenFamiliesFromDisk, loadTabletFamiliesFromDisk, loadDriversFromDisk,
  loadPressureResponseFromDisk,
} from "./drawtab-loader-node.js";
import {
  buildTabletToPenCompatMap, buildPenToTabletCompatMap, buildIncludedPenMap,
} from "./compat-helpers.js";

export type { DrawTabDataAll } from "./drawtab-all.js";

export function loadAllFromDisk(dataDir: string): DrawTabDataAll {
  const tablets          = loadTabletsFromDisk(dataDir);
  const pens             = loadPensFromDisk(dataDir);
  const penCompat        = loadPenCompatFromDisk(dataDir);
  const penFamilies      = loadPenFamiliesFromDisk(dataDir);
  const tabletFamilies   = loadTabletFamiliesFromDisk(dataDir);
  const drivers          = loadDriversFromDisk(dataDir);
  const pressureResponse = loadPressureResponseFromDisk(dataDir);

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
