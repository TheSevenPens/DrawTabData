// --- Types ---

import { BRANDS, WACOM_ONLY, PRESSURE_RESPONSE_BRANDS, TABLET_FAMILY_BRANDS, expandPenCompat, type PenCompatGrouped } from "./loader-shared.js";

export { TABLET_FAMILY_BRANDS } from "./loader-shared.js";

export type { Tablet, Dimensions, ColorGamuts, Pen, PenFamily, TabletFamily, Driver, Brand, PressureResponse, VersionInfo } from "./schemas.js";

import type { Tablet, Dimensions, Pen, PenFamily, TabletFamily, Driver, Brand, PressureResponse, VersionInfo } from "./schemas.js";

export interface PenCompat {
  Brand: string;
  TabletId: string;
  PenId: string;
  _id: string;
  _CreateDate: string;
  _ModifiedDate: string;
}

// --- Generic loader ---

export async function loadBrandPartitionedDataFromURL<T>(
  dataBaseUrl: string,
  entityPath: string,
  rootKey: string,
  brands: string[] = BRANDS,
): Promise<T[]> {
  const all: T[] = [];
  const fetches = brands.map(async (brand) => {
    const url = `${dataBaseUrl}/${entityPath}/${brand}-${entityPath}.json`;
    let resp: Response;
    try {
      resp = await fetch(url);
    } catch {
      return;
    }
    if (!resp.ok) {
      return;
    }
    const contentType = resp.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      return;
    }
    const data = await resp.json();
    const items = data[rootKey];
    if (Array.isArray(items)) {
      all.push(...items);
    }
  });
  await Promise.all(fetches);
  return all;
}

// --- Tablet loader ---

export async function loadTabletsFromURL(dataBaseUrl: string): Promise<Tablet[]> {
  return loadBrandPartitionedDataFromURL<Tablet>(dataBaseUrl, "tablets", "DrawingTablets");
}

// --- Driver loader ---

export async function loadDriversFromURL(dataBaseUrl: string): Promise<Driver[]> {
  return loadBrandPartitionedDataFromURL<Driver>(dataBaseUrl, "drivers", "Drivers", WACOM_ONLY);
}

// --- Pen loader ---

export async function loadPensFromURL(dataBaseUrl: string): Promise<Pen[]> {
  return loadBrandPartitionedDataFromURL<Pen>(dataBaseUrl, "pens", "Pens");
}

// --- Family loaders ---

export async function loadPenFamiliesFromURL(dataBaseUrl: string): Promise<PenFamily[]> {
  return loadBrandPartitionedDataFromURL<PenFamily>(dataBaseUrl, "pen-families", "PenFamilies", WACOM_ONLY);
}

export async function loadTabletFamiliesFromURL(dataBaseUrl: string): Promise<TabletFamily[]> {
  return loadBrandPartitionedDataFromURL<TabletFamily>(dataBaseUrl, "tablet-families", "TabletFamilies", TABLET_FAMILY_BRANDS);
}

// --- Pen compat loader ---

export async function loadPenCompatFromURL(dataBaseUrl: string): Promise<PenCompat[]> {
  const grouped = await loadBrandPartitionedDataFromURL<PenCompatGrouped>(dataBaseUrl, "pen-compat", "PenCompat");
  return expandPenCompat(grouped);
}

// --- Pressure response loader ---

export async function loadPressureResponseFromURL(dataBaseUrl: string): Promise<PressureResponse[]> {
  return loadBrandPartitionedDataFromURL<PressureResponse>(dataBaseUrl, "pressure-response", "PressureResponse", PRESSURE_RESPONSE_BRANDS);
}

// --- Inventory loaders ---

export async function loadInventoryPensFromURL(dataBaseUrl: string, userId: string): Promise<Record<string, unknown>[]> {
  const url = `${dataBaseUrl}/inventory/${userId}-pens.json`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const contentType = resp.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return [];
  const data = await resp.json();
  return data.InventoryPens ?? [];
}

export async function loadInventoryTabletsFromURL(dataBaseUrl: string, userId: string): Promise<Record<string, unknown>[]> {
  const url = `${dataBaseUrl}/inventory/${userId}-tablets.json`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const contentType = resp.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return [];
  const data = await resp.json();
  return data.InventoryTablets ?? [];
}

// --- Brand loader ---

export async function loadBrandsFromURL(dataBaseUrl: string): Promise<Brand[]> {
  const url = `${dataBaseUrl}/brands/brands.json`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const contentType = resp.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return [];
  const data = await resp.json();
  return data.Brands ?? [];
}

// --- Reference data ---

export interface ISOPaperSize {
  Series: string;
  Name: string;
  Width_mm: number;
  Height_mm: number;
  Width_in: number;
  Height_in: number;
}

export async function loadISOPaperSizesFromURL(dataBaseUrl: string): Promise<ISOPaperSize[]> {
  const url = `${dataBaseUrl}/reference/iso-paper-sizes.json`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const contentType = resp.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return [];
  const data = await resp.json();
  return data.ISOPaperSizes ?? [];
}

// --- Version info ---

export async function loadVersionFromURL(dataBaseUrl: string): Promise<VersionInfo | null> {
  const url = `${dataBaseUrl}/version.json`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const contentType = resp.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return null;
  return (await resp.json()) as VersionInfo;
}

// --- Brand names ---

export const BRAND_NAMES: Record<string, string> = {
  APPLE: "Apple", ASUS: "Asus", GAOMON: "Gaomon", HUION: "Huion",
  SAMSUNG: "Samsung", STAEDTLER: "Staedtler", UGEE: "Ugee", VEIKK: "Veikk",
  WACOM: "Wacom", XENCELABS: "Xencelabs", XPPEN: "XP-Pen",
};

export function brandName(id: string): string {
  return BRAND_NAMES[id] ?? id;
}

// --- Helpers ---

export function getDiagonal(dimensions: Dimensions | undefined): number | null {
  if (!dimensions || dimensions.Width == null || dimensions.Height == null) return null;
  return Math.sqrt(dimensions.Width * dimensions.Width + dimensions.Height * dimensions.Height);
}

/** Diagonal in centimeters (mm / 10). */
export function getDiagonalCm(dimensions: Dimensions | undefined): number | null {
  const d = getDiagonal(dimensions);
  return d !== null ? d * 0.1 : null;
}

/** Diagonal in inches (mm * 0.03937). */
export function getDiagonalIn(dimensions: Dimensions | undefined): number | null {
  const d = getDiagonal(dimensions);
  return d !== null ? d * 0.03937 : null;
}

export function formatDimensions(dimensions: Dimensions | undefined): string {
  if (!dimensions) return "";
  const parts = [dimensions.Width, dimensions.Height, dimensions.Depth].filter((v) => v != null);
  return parts.join(" x ");
}

export function containsText(value: string | undefined, search: string): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(search.toLowerCase());
}

export function equalsText(value: string | undefined, search: string): boolean {
  if (!value) return false;
  return value.toLowerCase() === search.toLowerCase();
}

// --- Accessors ---

export function getBrands<T extends { Brand: string }>(items: T[]): string[] {
  return [...new Set(items.map((t) => t.Brand))].sort();
}

export function filterByBrand<T extends { Brand: string }>(items: T[], brand: string): T[] {
  return items.filter((t) => equalsText(t.Brand, brand));
}

export function filterByType(tablets: Tablet[], type: string): Tablet[] {
  return tablets.filter((t) => equalsText(t.ModelType, type));
}
