import * as fs from "fs";
import * as path from "path";
import type { Tablet, Pen, PenFamily, TabletFamily, Driver, PenCompat, Brand } from "./drawtab-loader.js";

// --- Generic loader ---

const BRANDS = ["GAOMON", "HUION", "SAMSUNG", "UGEE", "WACOM", "XENCELABS", "XPPEN"];

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

export function loadDriversFromDisk(dataDir: string): Driver[] {
  return loadBrandPartitionedDataFromDisk<Driver>(dataDir, "drivers", "Drivers", ["WACOM"]);
}

// --- Pen loader ---

export function loadPensFromDisk(dataDir: string): Pen[] {
  return loadBrandPartitionedDataFromDisk<Pen>(dataDir, "pens", "Pens");
}

// --- Family loaders ---

export function loadPenFamiliesFromDisk(dataDir: string): PenFamily[] {
  return loadBrandPartitionedDataFromDisk<PenFamily>(dataDir, "pen-families", "PenFamilies", ["WACOM"]);
}

export function loadTabletFamiliesFromDisk(dataDir: string): TabletFamily[] {
  return loadBrandPartitionedDataFromDisk<TabletFamily>(dataDir, "tablet-families", "TabletFamilies", ["WACOM"]);
}

// --- Pen compat loader ---

interface PenCompatGrouped {
  Brand: string;
  PenId: string;
  TabletIds: string[];
}

export function loadPenCompatFromDisk(dataDir: string): PenCompat[] {
  const grouped = loadBrandPartitionedDataFromDisk<PenCompatGrouped>(dataDir, "pen-compat", "PenCompat");
  const rows: PenCompat[] = [];
  for (const entry of grouped) {
    for (const tabletId of entry.TabletIds) {
      rows.push({
        Brand: entry.Brand,
        TabletId: tabletId,
        PenId: entry.PenId,
        _id: "",
        _CreateDate: "",
        _ModifiedDate: "",
      });
    }
  }
  return rows;
}

// --- Brand loader ---

export function loadBrandsFromDisk(dataDir: string): Brand[] {
  const filePath = path.join(dataDir, "brands", "brands.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  return data.Brands ?? [];
}

// --- Pressure response loader ---

import type { PressureResponse } from "./drawtab-loader.js";

const PRESSURE_RESPONSE_BRANDS = ["HUION", "SAMSUNG", "WACOM", "XENCELABS", "XPPEN"];

export function loadPressureResponseFromDisk(dataDir: string): PressureResponse[] {
  return loadBrandPartitionedDataFromDisk<PressureResponse>(dataDir, "pressure-response", "PressureResponse", PRESSURE_RESPONSE_BRANDS);
}

// --- Re-export types and accessors ---

export type { Tablet, Pen, PenFamily, TabletFamily, Driver, PenCompat, PressureResponse, Brand, Dimensions, ColorGamuts } from "./drawtab-loader.js";
export { getBrands, filterByBrand, filterByType, getDiagonal, formatDimensions, containsText, equalsText, brandName, BRAND_NAMES } from "./drawtab-loader.js";
