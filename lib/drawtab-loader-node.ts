import * as fs from "fs";
import * as path from "path";
import type { Tablet, Pen, PenFamily, TabletFamily, Driver, PenCompat, Brand } from "./drawtab-loader.js";
import { BRANDS, expandPenCompat, type PenCompatGrouped } from "./loader-shared.js";

// --- Generic loader ---

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
  return loadBrandPartitionedDataFromDisk<Driver>(dataDir, "drivers", "Drivers");
}

// --- Pen loader ---

export function loadPensFromDisk(dataDir: string): Pen[] {
  return loadBrandPartitionedDataFromDisk<Pen>(dataDir, "pens", "Pens");
}

// --- Family loaders ---

export function loadPenFamiliesFromDisk(dataDir: string): PenFamily[] {
  return loadBrandPartitionedDataFromDisk<PenFamily>(dataDir, "pen-families", "PenFamilies");
}

export function loadTabletFamiliesFromDisk(dataDir: string): TabletFamily[] {
  return loadBrandPartitionedDataFromDisk<TabletFamily>(dataDir, "tablet-families", "TabletFamilies");
}

// --- Pen compat loader ---

export function loadPenCompatFromDisk(dataDir: string): PenCompat[] {
  const grouped = loadBrandPartitionedDataFromDisk<PenCompatGrouped>(dataDir, "pen-compat", "PenCompat");
  return expandPenCompat(grouped);
}

// --- Brand loader ---

export function loadBrandsFromDisk(dataDir: string): Brand[] {
  const filePath = path.join(dataDir, "brands", "brands.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  return data.Brands ?? [];
}

// --- Reference data ---

import type { ISOPaperSize } from "./drawtab-loader.js";

export function loadISOPaperSizesFromDisk(dataDir: string): ISOPaperSize[] {
  const filePath = path.join(dataDir, "reference", "iso-paper-sizes.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  return data.ISOPaperSizes ?? [];
}

// --- Pressure response loader ---

import type { PressureResponse } from "./schemas.js";

export function loadPressureResponseFromDisk(dataDir: string): PressureResponse[] {
  return loadBrandPartitionedDataFromDisk<PressureResponse>(dataDir, "pressure-response", "PressureResponse");
}

// --- Re-export types and accessors ---

export type { Tablet, Pen, PenFamily, TabletFamily, Driver, PenCompat, PressureResponse, Brand, Dimensions, ColorGamuts, ISOPaperSize } from "./drawtab-loader.js";
export { getBrands, filterByBrand, filterByType, getDiagonal, getDiagonalCm, getDiagonalIn, formatDimensions, containsText, equalsText, brandName, BRAND_NAMES } from "./drawtab-loader.js";
