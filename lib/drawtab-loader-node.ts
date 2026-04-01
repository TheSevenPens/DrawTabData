import * as fs from "fs";
import * as path from "path";
import type { Tablet } from "./drawtab-loader.js";

// --- Generic loader ---

const BRANDS = ["HUION", "WACOM", "XENCELABS", "XPPEN"];

export function loadBrandPartitionedDataFromDisk<T>(
  dataDir: string,
  entityPath: string,
  rootKey: string,
  brands: string[] = BRANDS,
): T[] {
  const all: T[] = [];
  for (const brand of brands) {
    const filePath = path.join(dataDir, entityPath, `${brand}-${entityPath}.json`);
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    const items = data[rootKey];
    if (Array.isArray(items)) {
      all.push(...items);
    }
  }
  return all;
}

// --- Tablet loader ---

export function loadTabletsFromDisk(dataDir: string): Tablet[] {
  return loadBrandPartitionedDataFromDisk<Tablet>(dataDir, "tablets", "DrawingTablets");
}

// --- Driver loader ---

export function loadDriversFromDisk(dataDir: string): Record<string, unknown>[] {
  return loadBrandPartitionedDataFromDisk<Record<string, unknown>>(dataDir, "drivers", "Drivers", ["WACOM"]);
}

// --- Pen loader ---

export function loadPensFromDisk(dataDir: string): Record<string, unknown>[] {
  return loadBrandPartitionedDataFromDisk<Record<string, unknown>>(dataDir, "pens", "Pens", ["WACOM"]);
}

// --- Family loaders ---

export function loadPenFamiliesFromDisk(dataDir: string): Record<string, unknown>[] {
  return loadBrandPartitionedDataFromDisk<Record<string, unknown>>(dataDir, "pen-families", "PenFamilies", ["WACOM"]);
}

export function loadTabletFamiliesFromDisk(dataDir: string): Record<string, unknown>[] {
  return loadBrandPartitionedDataFromDisk<Record<string, unknown>>(dataDir, "tablet-families", "TabletFamilies", ["WACOM"]);
}

// --- Pen compat loader ---

export function loadPenCompatFromDisk(dataDir: string): Record<string, unknown>[] {
  return loadBrandPartitionedDataFromDisk<Record<string, unknown>>(dataDir, "pen-compat", "PenCompat", ["WACOM"]);
}

// --- Re-export types and accessors ---

export type { Tablet, Dimensions, ColorGamuts } from "./drawtab-loader.js";
export { getBrands, filterByBrand, filterByType } from "./drawtab-loader.js";
