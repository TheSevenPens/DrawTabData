// High-level data-access API. Wraps the URL and disk loaders behind a
// uniform interface, lazy-loads each entity collection on first access,
// caches the result for subsequent calls, and exposes a fluent query
// builder backed by the existing pipeline engine.
//
// Example:
//
//   const ds = new DrawTabDataSet({ kind: "url", baseUrl: "" });
//   const wacomTablets = await ds.Tablets
//     .filter("Brand", "==", "WACOM")
//     .sort("ModelLaunchYear", "desc")
//     .take(20)
//     .toArray();
//
// Phase 1 (this module): lazy loading + fluent filter/sort/take.
// Phase 2 (not yet): auto-resolved relationships
// (e.g. `tablet.getCompatiblePens()`).

import type { Tablet, Pen, PenFamily, TabletFamily, Driver, PenCompat, PressureResponse, Brand } from "./drawtab-loader.js";
import {
  loadTabletsFromURL,
  loadPensFromURL,
  loadDriversFromURL,
  loadBrandsFromURL,
  loadPenFamiliesFromURL,
  loadTabletFamiliesFromURL,
  loadPenCompatFromURL,
  loadPressureResponseFromURL,
  loadInventoryPensFromURL,
  loadInventoryTabletsFromURL,
} from "./drawtab-loader.js";
import {
  loadTabletsFromDisk,
  loadPensFromDisk,
  loadDriversFromDisk,
  loadBrandsFromDisk,
  loadPenFamiliesFromDisk,
  loadTabletFamiliesFromDisk,
  loadPenCompatFromDisk,
  loadPressureResponseFromDisk,
  loadInventoryPensFromDisk,
  loadInventoryTabletsFromDisk,
} from "./drawtab-loader-node.js";
import type { AnyFieldDef, Step } from "./pipeline/types.js";
import { executePipeline } from "./pipeline/engine.js";
import { BRAND_FIELDS } from "./entities/brand-fields.js";
import { TABLET_FIELDS } from "./entities/tablet-fields.js";
import { TABLET_FAMILY_FIELDS } from "./entities/tablet-family-fields.js";
import { PEN_FIELDS } from "./entities/pen-fields.js";
import { PEN_FAMILY_FIELDS } from "./entities/pen-family-fields.js";
import { DRIVER_FIELDS } from "./entities/driver-fields.js";
import { PEN_COMPAT_FIELDS } from "./entities/pen-compat-fields.js";
import { PRESSURE_RESPONSE_FIELDS } from "./entities/pressure-response-fields.js";
import { INVENTORY_PEN_FIELDS, type InventoryPen } from "./entities/inventory-pen-fields.js";
import { INVENTORY_TABLET_FIELDS, type InventoryTablet } from "./entities/inventory-tablet-fields.js";

// --- Source ----------------------------------------------------------------

export type DataSource =
  | { kind: "url"; baseUrl: string; userId?: string }
  | { kind: "disk"; dataDir: string; userId?: string };

// --- Fluent query ----------------------------------------------------------

export type FilterOp =
  | "=="
  | "!="
  | "contains"
  | "notcontains"
  | "startswith"
  | "notstartswith"
  | "empty"
  | "notempty"
  | ">"
  | ">="
  | "<"
  | "<=";

export type SortDirection = "asc" | "desc";

/**
 * Lazy query over an entity collection. Calls to filter/sort/take return a
 * new Query with the step appended; the underlying load and execution are
 * deferred until toArray/find/count.
 */
export class Query<T> {
  constructor(
    private readonly load: () => Promise<T[]>,
    private readonly fields: AnyFieldDef[],
    private readonly steps: Step[] = [],
  ) {}

  filter(field: string, operator: FilterOp, value: string | number): Query<T> {
    return new Query(this.load, this.fields, [
      ...this.steps,
      { kind: "filter", field, operator, value: String(value) },
    ]);
  }

  sort(field: string, direction: SortDirection = "asc"): Query<T> {
    return new Query(this.load, this.fields, [
      ...this.steps,
      { kind: "sort", field, direction },
    ]);
  }

  take(count: number): Query<T> {
    return new Query(this.load, this.fields, [
      ...this.steps,
      { kind: "take", count },
    ]);
  }

  async toArray(): Promise<T[]> {
    const items = await this.load();
    if (this.steps.length === 0) return items;
    return executePipeline(items, this.steps, this.fields, []).data;
  }

  async find(predicate: (item: T) => boolean): Promise<T | undefined> {
    return (await this.toArray()).find(predicate);
  }

  async count(): Promise<number> {
    return (await this.toArray()).length;
  }
}

// --- Dataset ---------------------------------------------------------------

type Loaders = {
  brands(): Promise<Brand[]>;
  tablets(): Promise<Tablet[]>;
  tabletFamilies(): Promise<TabletFamily[]>;
  pens(): Promise<Pen[]>;
  penFamilies(): Promise<PenFamily[]>;
  drivers(): Promise<Driver[]>;
  penCompat(): Promise<PenCompat[]>;
  pressureResponse(): Promise<PressureResponse[]>;
  inventoryPens(): Promise<InventoryPen[]>;
  inventoryTablets(): Promise<InventoryTablet[]>;
};

function requireUserId(source: DataSource): string {
  if (!source.userId) {
    throw new Error(
      "Inventory access requires a userId in the DataSource (e.g. { kind: 'url', baseUrl: '', userId: 'sevenpens' }).",
    );
  }
  return source.userId;
}

function makeLoaders(source: DataSource): Loaders {
  if (source.kind === "url") {
    const b = source.baseUrl;
    return {
      brands: () => loadBrandsFromURL(b),
      tablets: () => loadTabletsFromURL(b),
      tabletFamilies: () => loadTabletFamiliesFromURL(b),
      pens: () => loadPensFromURL(b),
      penFamilies: () => loadPenFamiliesFromURL(b),
      drivers: () => loadDriversFromURL(b),
      penCompat: () => loadPenCompatFromURL(b),
      pressureResponse: () => loadPressureResponseFromURL(b),
      inventoryPens: () =>
        loadInventoryPensFromURL(b, requireUserId(source)) as unknown as Promise<InventoryPen[]>,
      inventoryTablets: () =>
        loadInventoryTabletsFromURL(b, requireUserId(source)) as unknown as Promise<InventoryTablet[]>,
    };
  }
  const d = source.dataDir;
  return {
    brands: async () => loadBrandsFromDisk(d),
    tablets: async () => loadTabletsFromDisk(d),
    tabletFamilies: async () => loadTabletFamiliesFromDisk(d),
    pens: async () => loadPensFromDisk(d),
    penFamilies: async () => loadPenFamiliesFromDisk(d),
    drivers: async () => loadDriversFromDisk(d),
    penCompat: async () => loadPenCompatFromDisk(d),
    pressureResponse: async () => loadPressureResponseFromDisk(d),
    inventoryPens: async () => loadInventoryPensFromDisk(d, requireUserId(source)),
    inventoryTablets: async () => loadInventoryTabletsFromDisk(d, requireUserId(source)),
  };
}

/**
 * High-level entry point. Construct once, then access entity collections
 * via the typed properties (`ds.Tablets`, `ds.Pens`, etc.). Each collection
 * is loaded lazily on first access and cached for the lifetime of the
 * instance.
 */
export class DrawTabDataSet {
  private readonly loaders: Loaders;
  private readonly cache = new Map<keyof Loaders, Promise<unknown>>();

  constructor(source: DataSource) {
    this.loaders = makeLoaders(source);
  }

  private memo<K extends keyof Loaders>(
    key: K,
    loader: () => Promise<unknown>,
  ): Promise<unknown> {
    let p = this.cache.get(key);
    if (!p) {
      p = loader();
      this.cache.set(key, p);
    }
    return p;
  }

  get Brands(): Query<Brand> {
    return new Query(
      () => this.memo("brands", this.loaders.brands) as Promise<Brand[]>,
      BRAND_FIELDS as AnyFieldDef[],
    );
  }

  get Tablets(): Query<Tablet> {
    return new Query(
      () => this.memo("tablets", this.loaders.tablets) as Promise<Tablet[]>,
      TABLET_FIELDS as AnyFieldDef[],
    );
  }

  get TabletFamilies(): Query<TabletFamily> {
    return new Query(
      () => this.memo("tabletFamilies", this.loaders.tabletFamilies) as Promise<TabletFamily[]>,
      TABLET_FAMILY_FIELDS as AnyFieldDef[],
    );
  }

  get Pens(): Query<Pen> {
    return new Query(
      () => this.memo("pens", this.loaders.pens) as Promise<Pen[]>,
      PEN_FIELDS as AnyFieldDef[],
    );
  }

  get PenFamilies(): Query<PenFamily> {
    return new Query(
      () => this.memo("penFamilies", this.loaders.penFamilies) as Promise<PenFamily[]>,
      PEN_FAMILY_FIELDS as AnyFieldDef[],
    );
  }

  get Drivers(): Query<Driver> {
    return new Query(
      () => this.memo("drivers", this.loaders.drivers) as Promise<Driver[]>,
      DRIVER_FIELDS as AnyFieldDef[],
    );
  }

  get PenCompat(): Query<PenCompat> {
    return new Query(
      () => this.memo("penCompat", this.loaders.penCompat) as Promise<PenCompat[]>,
      PEN_COMPAT_FIELDS as AnyFieldDef[],
    );
  }

  get PressureResponse(): Query<PressureResponse> {
    return new Query(
      () => this.memo("pressureResponse", this.loaders.pressureResponse) as Promise<PressureResponse[]>,
      PRESSURE_RESPONSE_FIELDS as AnyFieldDef[],
    );
  }

  /** Per-user inventory. Requires `userId` on the DataSource — accessing
   * the query throws on materialisation if none was supplied. */
  get InventoryPens(): Query<InventoryPen> {
    return new Query(
      () => this.memo("inventoryPens", this.loaders.inventoryPens) as Promise<InventoryPen[]>,
      INVENTORY_PEN_FIELDS as AnyFieldDef[],
    );
  }

  /** Per-user inventory. Requires `userId` on the DataSource — accessing
   * the query throws on materialisation if none was supplied. */
  get InventoryTablets(): Query<InventoryTablet> {
    return new Query(
      () => this.memo("inventoryTablets", this.loaders.inventoryTablets) as Promise<InventoryTablet[]>,
      INVENTORY_TABLET_FIELDS as AnyFieldDef[],
    );
  }

  // --- Phase 2: auto-resolved relationships --------------------------------

  /** Pens compatible with `tablet`, resolved via the PenCompat collection. */
  async getCompatiblePens(tablet: Tablet): Promise<Pen[]> {
    const [pens, compat] = await Promise.all([
      this.Pens.toArray(),
      this.PenCompat.toArray(),
    ]);
    const compatPenIds = new Set(
      compat.filter((c) => c.TabletId === tablet.Model.Id).map((c) => c.PenId),
    );
    return pens.filter((p) => compatPenIds.has(p.PenId));
  }

  /** Tablets compatible with `pen`, resolved via the PenCompat collection. */
  async getCompatibleTablets(pen: Pen): Promise<Tablet[]> {
    const [tablets, compat] = await Promise.all([
      this.Tablets.toArray(),
      this.PenCompat.toArray(),
    ]);
    const compatTabletIds = new Set(
      compat.filter((c) => c.PenId === pen.PenId).map((c) => c.TabletId),
    );
    return tablets.filter((t) => compatTabletIds.has(t.Model.Id));
  }

  /** The tablet's family record, or null if `Model.Family` is unset or
   * references a family that does not exist. */
  async getTabletFamily(tablet: Tablet): Promise<TabletFamily | null> {
    const familyRef = tablet.Model.Family;
    if (!familyRef) return null;
    const families = await this.TabletFamilies.toArray();
    return families.find((f) => f.EntityId === familyRef) ?? null;
  }

  /** The pen's family record, or null if `PenFamily` is unset or references
   * a family that does not exist. */
  async getPenFamily(pen: Pen): Promise<PenFamily | null> {
    const familyRef = pen.PenFamily;
    if (!familyRef) return null;
    const families = await this.PenFamilies.toArray();
    return families.find((f) => f.EntityId === familyRef) ?? null;
  }

  /** Tablets that belong to `family` (matched by `Model.Family === family.EntityId`). */
  async getTabletsInFamily(family: TabletFamily): Promise<Tablet[]> {
    const tablets = await this.Tablets.toArray();
    return tablets.filter((t) => t.Model.Family === family.EntityId);
  }

  /** Pens that belong to `family` (matched by `PenFamily === family.EntityId`). */
  async getPensInFamily(family: PenFamily): Promise<Pen[]> {
    const pens = await this.Pens.toArray();
    return pens.filter((p) => p.PenFamily === family.EntityId);
  }

  /** The brand record for any entity that has a `Brand` field
   * (Tablet uses `Model.Brand`; others have a top-level `Brand`). */
  async getBrand(
    entity: { Brand?: string; Model?: { Brand?: string } },
  ): Promise<Brand | null> {
    const brandId = entity.Brand ?? entity.Model?.Brand;
    if (!brandId) return null;
    const brands = await this.Brands.toArray();
    return brands.find((b) => b.BrandId === brandId) ?? null;
  }
}
