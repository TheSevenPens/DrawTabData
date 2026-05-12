import * as fs from "fs";
import * as path from "path";
import type { Tablet, Pen, PenFamily, TabletFamily, Driver, PenCompat, Brand } from "./drawtab-loader.js";
import type { Loader } from "queriton";
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

// --- Generic sharded loader class -----------------------------------------
//
// Disk counterpart to `ShardedURLLoader`. Same options, same JSON
// convention, same "missing shard files are silently skipped" semantics.

export interface ShardedDiskLoaderOptions<T, Raw = T> {
  shards: readonly string[];
  /** POSIX-style relative path under `dataDir`; joined via `path.join`. */
  filePath: (shard: string) => string;
  rootKey: string;
  transform?: (raw: Raw[]) => T[];
}

export class ShardedDiskLoader<T, Raw = T> implements Loader<T> {
  constructor(
    private readonly dataDir: string,
    private readonly opts: ShardedDiskLoaderOptions<T, Raw>,
  ) {}

  async load(): Promise<T[]> {
    const raw: Raw[] = [];
    for (const shard of this.opts.shards) {
      const filePath = path.join(this.dataDir, ...this.opts.filePath(shard).split("/"));
      if (!fs.existsSync(filePath)) continue;
      const text = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(text);
      const items = data[this.opts.rootKey];
      if (Array.isArray(items)) {
        raw.push(...(items as Raw[]));
      }
    }
    return this.opts.transform ? this.opts.transform(raw) : (raw as unknown as T[]);
  }
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

// --- Inventory loaders (user-partitioned, not brand-partitioned) ---

import type { InventoryPen } from "./entities/inventory-pen-fields.js";
import type { InventoryTablet } from "./entities/inventory-tablet-fields.js";

export function loadInventoryPensFromDisk(dataDir: string, userId: string): InventoryPen[] {
  const filePath = path.join(dataDir, "inventory", `${userId}-pens.json`);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  return (data.InventoryPens ?? []) as InventoryPen[];
}

export function loadInventoryTabletsFromDisk(dataDir: string, userId: string): InventoryTablet[] {
  const filePath = path.join(dataDir, "inventory", `${userId}-tablets.json`);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  return (data.InventoryTablets ?? []) as InventoryTablet[];
}

// --- Re-export types and accessors ---

export type { Tablet, Pen, PenFamily, TabletFamily, Driver, PenCompat, PressureResponse, Brand, Dimensions, ColorGamuts, ISOPaperSize } from "./drawtab-loader.js";
export { getBrands, filterByBrand, filterByType, getDiagonal, getDiagonalCm, getDiagonalIn, formatDimensions, containsText, equalsText, brandName, BRAND_NAMES } from "./drawtab-loader.js";
