// --- Types ---

import type { Loader } from "@thesevenpens/queriton";
import { BRANDS, expandPenCompat, type PenCompatGrouped } from "./loader-shared.js";

export type { Tablet, Dimensions, ColorGamuts, Pen, PenFamily, TabletFamily, Driver, Brand, PressureResponse, PressureRange, VersionInfo, WacomUpdateProduct, OTDTablet, OTDConfigFile, OTDAuditStatus, OTDEntityAudit, Link, LinkCheck, LinkContentType } from "./schemas.js";

import type { Tablet, Dimensions, Pen, PenFamily, TabletFamily, Driver, Brand, PressureResponse, VersionInfo, WacomUpdateProduct, OTDTablet, OTDConfigFile, OTDAuditStatus } from "./schemas.js";

export interface PenCompat {
  Brand: string;
  TabletId: string;
  PenId: string;
  _id: string;
  _CreateDate: string;
  _ModifiedDate: string;
}

// --- Fetching one data file -----------------------------------------------
//
// Two outcomes used to look identical: "this file doesn't exist" (normal —
// most brands have no pressure-response file, so the loaders probe every
// brand in BRANDS) and "this file failed to load" (a 503, a dropped
// connection, a truncated body). Both returned nothing, so a failed
// WACOM-pens.json showed 64 of 143 pens as if that were the whole dataset
// (TheSevenPens/DrawTabDataExplorer#331). Now only absence is quiet;
// every failure throws a DataLoadError naming the file.

/** A data file that exists but could not be loaded or has the wrong shape. */
export class DataLoadError extends Error {
  constructor(
    readonly url: string,
    readonly reason: string,
    options?: { cause?: unknown },
  ) {
    super(`Couldn't load ${url}: ${reason}`, options);
    this.name = "DataLoadError";
  }
}

/**
 * Fetch and parse one JSON data file.
 *
 * Returns `undefined` when the file is **absent**: an HTTP 404, or an HTML
 * page served in its place (an SPA fallback answering 200 for a missing
 * path). Throws `DataLoadError` for everything else — network failure, any
 * other non-OK status, or a body that isn't valid JSON.
 */
export async function fetchDataFile(url: string): Promise<any> {
  let resp: Response;
  try {
    resp = await fetch(url);
  } catch (err) {
    throw new DataLoadError(url, "network error", { cause: err });
  }
  if (resp.status === 404) return undefined;
  if (!resp.ok) throw new DataLoadError(url, `HTTP ${resp.status}`);
  const contentType = resp.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) return undefined;
  try {
    return await resp.json();
  } catch (err) {
    throw new DataLoadError(url, "invalid JSON", { cause: err });
  }
}

// --- Generic loader ---

export async function loadBrandPartitionedDataFromURL<T>(
  dataBaseUrl: string,
  entityPath: string,
  rootKey: string,
  brands: string[] = BRANDS,
): Promise<T[]> {
  return new ShardedURLLoader<T>(dataBaseUrl, {
    shards: brands,
    filePath: (brand) => `${entityPath}/${brand}-${entityPath}.json`,
    rootKey,
  }).load();
}

// --- Generic sharded loader class -----------------------------------------
//
// One instance per collection. Each shard's file lives at
// `${baseUrl}/${filePath(shard)}`, and the array of records lives under
// `data[rootKey]`. An absent shard (see fetchDataFile) is skipped — the
// loaders probe every brand, and most brands lack most files. A shard that
// fails, or whose JSON has no array under `rootKey`, or whose array holds a
// non-object, fails the whole load: a partial collection must never pass
// for a complete one. Rows are returned in shard order, not in whichever
// order the responses happened to arrive.
//
// Used by `DrawTabDataSet` to wire its collections; project-specific glue
// because the JSON-shape convention is DrawTab's, but the class itself
// has zero hard-coded entity names.

export interface ShardedURLLoaderOptions<T, Raw = T> {
  /** Shard names — for brand-sharded files this is `BRANDS`; for a single
   * file like `brands/brands.json` use `["brands"]`; for inventory use
   * `[userId]`. */
  shards: readonly string[];
  /** Maps a shard name to the file path under `baseUrl`. */
  filePath: (shard: string) => string;
  /** Key under which the array of records lives in each shard's JSON. */
  rootKey: string;
  /** Optional post-process applied to the concatenated raw rows (e.g.
   * `expandPenCompat` flattens grouped PenCompat into one row per pair). */
  transform?: (raw: Raw[]) => T[];
}

export class ShardedURLLoader<T, Raw = T> implements Loader<T> {
  constructor(
    private readonly baseUrl: string,
    private readonly opts: ShardedURLLoaderOptions<T, Raw>,
  ) {}

  async load(): Promise<T[]> {
    const { rootKey } = this.opts;
    const perShard = await Promise.all(
      this.opts.shards.map(async (shard): Promise<Raw[]> => {
        const url = `${this.baseUrl}/${this.opts.filePath(shard)}`;
        const data = await fetchDataFile(url);
        if (data === undefined) return [];
        const items = data?.[rootKey];
        if (!Array.isArray(items)) {
          throw new DataLoadError(url, `expected an array under "${rootKey}"`);
        }
        const bad = items.findIndex((r) => r === null || typeof r !== "object");
        if (bad !== -1) {
          throw new DataLoadError(url, `"${rootKey}"[${bad}] is not a record`);
        }
        return items as Raw[];
      }),
    );
    const raw = ([] as Raw[]).concat(...perShard);
    return this.opts.transform ? this.opts.transform(raw) : (raw as unknown as T[]);
  }
}

// --- Tablet loader ---

export async function loadTabletsFromURL(dataBaseUrl: string): Promise<Tablet[]> {
  return loadBrandPartitionedDataFromURL<Tablet>(dataBaseUrl, "tablets", "DrawingTablets");
}

// --- Driver loader ---

export async function loadDriversFromURL(dataBaseUrl: string): Promise<Driver[]> {
  return loadBrandPartitionedDataFromURL<Driver>(dataBaseUrl, "drivers", "Drivers");
}

// --- Pen loader ---

export async function loadPensFromURL(dataBaseUrl: string): Promise<Pen[]> {
  return loadBrandPartitionedDataFromURL<Pen>(dataBaseUrl, "pens", "Pens");
}

// --- Family loaders ---

export async function loadPenFamiliesFromURL(dataBaseUrl: string): Promise<PenFamily[]> {
  return loadBrandPartitionedDataFromURL<PenFamily>(dataBaseUrl, "pen-families", "PenFamilies");
}

export async function loadTabletFamiliesFromURL(dataBaseUrl: string): Promise<TabletFamily[]> {
  return loadBrandPartitionedDataFromURL<TabletFamily>(dataBaseUrl, "tablet-families", "TabletFamilies");
}

// --- Pen compat loader ---

export async function loadPenCompatFromURL(dataBaseUrl: string): Promise<PenCompat[]> {
  const grouped = await loadBrandPartitionedDataFromURL<PenCompatGrouped>(dataBaseUrl, "pen-compat", "PenCompat");
  return expandPenCompat(grouped);
}

// --- Pressure response loader ---

export async function loadPressureResponseFromURL(dataBaseUrl: string): Promise<PressureResponse[]> {
  return loadBrandPartitionedDataFromURL<PressureResponse>(dataBaseUrl, "pressure-response", "PressureResponse");
}

// --- Inventory loaders ---

export async function loadInventoryPensFromURL(dataBaseUrl: string, userId: string): Promise<Record<string, unknown>[]> {
  const url = `${dataBaseUrl}/inventory/${userId}-pens.json`;
  const data = await fetchDataFile(url);
  if (data === undefined) return [];
  return data.InventoryPens ?? [];
}

export async function loadInventoryTabletsFromURL(dataBaseUrl: string, userId: string): Promise<Record<string, unknown>[]> {
  const url = `${dataBaseUrl}/inventory/${userId}-tablets.json`;
  const data = await fetchDataFile(url);
  if (data === undefined) return [];
  return data.InventoryTablets ?? [];
}

// --- Wacom-update product manifest loader ---

export async function loadWacomUpdateProductsFromURL(
  dataBaseUrl: string,
): Promise<WacomUpdateProduct[]> {
  const url = `${dataBaseUrl}/wacom-update/products.json`;
  const data = await fetchDataFile(url);
  if (data === undefined) return [];
  return data;
}

// --- OpenTabletDriver config loader ---

/** Loads the full OTD reference file (provenance + tablet list). Refresh it
 * with scripts/extract-otd-configs.mjs. Returns null if unavailable. */
export async function loadOtdConfigFromURL(
  dataBaseUrl: string,
): Promise<OTDConfigFile | null> {
  const url = `${dataBaseUrl}/otd/otd-tablets.json`;
  const data = await fetchDataFile(url);
  if (data === undefined) return null;
  return data as OTDConfigFile;
}

/** Loads just the OTD tablet list (drops provenance). */
export async function loadOtdTabletsFromURL(
  dataBaseUrl: string,
): Promise<OTDTablet[]> {
  return (await loadOtdConfigFromURL(dataBaseUrl))?.tablets ?? [];
}

/** Loads the OTD→entity audit overlay: a map of `"<otdFile>|<entityId>"` →
 * verdict. Missing keys mean "unreviewed". Returns {} if unavailable. */
export async function loadOtdEntityAuditFromURL(
  dataBaseUrl: string,
): Promise<Record<string, OTDAuditStatus>> {
  const url = `${dataBaseUrl}/otd/otd-entity-audit.json`;
  const data = await fetchDataFile(url);
  if (data === undefined) return {};
  return data.audits ?? {};
}

// --- Doc-links review dataset (data/links/doc-links.json) ---

/** One external reference link extracted from DrawingTabletDocs, mapped to an
 * entity, for review on /links-review before it becomes entity data. */
export interface DocLink {
  entityId: string;
  entityType: "tablet" | "pen";
  brand: string;
  type: string;
  url: string;
  title: string;
  author: string;
  publishDate: string;
  sourceFile: string;
}

export async function loadDocLinksFromURL(dataBaseUrl: string): Promise<DocLink[]> {
  const url = `${dataBaseUrl}/links/doc-links.json`;
  const data = await fetchDataFile(url);
  if (data === undefined) return [];
  return data.links ?? [];
}

// --- MacHollywood pen-compatibility capture (data/machollywood/) ---
//
// A mirror of someone else's page, plus our reading of it, in two files that
// deliberately stay apart: the capture says what the page says, the
// annotations say what we make of it. Refresh both with
// `npm run capture-machollywood` and `npm run annotate-machollywood`.

export type {
  MacHollywoodDataset,
  MacHollywoodRecord,
  MacHollywoodSegment,
  MacHollywoodAnnotations,
  RecordAnnotation as MacHollywoodRecordAnnotation,
  CodeMapping as MacHollywoodCodeMapping,
  MatchKind as MacHollywoodMatchKind,
} from "./reference/machollywood.js";

import type {
  MacHollywoodAnnotations,
  MacHollywoodDataset,
} from "./reference/machollywood.js";

/** Loads the structured capture (provenance + segments). Null if unavailable. */
export async function loadMacHollywoodFromURL(
  dataBaseUrl: string,
): Promise<MacHollywoodDataset | null> {
  const url = `${dataBaseUrl}/machollywood/machollywood-pen-compat.json`;
  const data = await fetchDataFile(url);
  if (data === undefined) return null;
  return data as MacHollywoodDataset;
}

/** Loads our EntityId mapping over that capture. Null if unavailable. */
export async function loadMacHollywoodAnnotationsFromURL(
  dataBaseUrl: string,
): Promise<MacHollywoodAnnotations | null> {
  const url = `${dataBaseUrl}/machollywood/machollywood-pen-compat-annotations.json`;
  const data = await fetchDataFile(url);
  if (data === undefined) return null;
  return data as MacHollywoodAnnotations;
}

// --- Brand loader ---

export async function loadBrandsFromURL(dataBaseUrl: string): Promise<Brand[]> {
  const url = `${dataBaseUrl}/brands/brands.json`;
  const data = await fetchDataFile(url);
  if (data === undefined) return [];
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
  const data = await fetchDataFile(url);
  if (data === undefined) return [];
  return data.ISOPaperSizes ?? [];
}

export interface USPaperSize {
  Series: string;
  Name: string;
  Width_mm: number;
  Height_mm: number;
  Width_in: number;
  Height_in: number;
}

export async function loadUSPaperSizesFromURL(dataBaseUrl: string): Promise<USPaperSize[]> {
  const url = `${dataBaseUrl}/reference/us-paper-sizes.json`;
  const data = await fetchDataFile(url);
  if (data === undefined) return [];
  return data.USPaperSizes ?? [];
}

// --- Version info ---

/** Version metadata is informational: the app shows a "version unavailable"
 * banner rather than failing, so *any* failure here — absent, network, bad
 * JSON — yields null. (Contrast the entity loaders, which must throw.) */
export async function loadVersionFromURL(dataBaseUrl: string): Promise<VersionInfo | null> {
  try {
    const data = await fetchDataFile(`${dataBaseUrl}/version.json`);
    return (data ?? null) as VersionInfo | null;
  } catch {
    return null;
  }
}

// --- Brand names ---

export const BRAND_NAMES: Record<string, string> = {
  APPLE: "Apple", ASUS: "Asus", DIGIDRAW: "DigiDraw", GAOMON: "Gaomon", HUION: "Huion",
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
  return tablets.filter((t) => equalsText(t.Model.Type, type));
}
