// High-level data-access API. Wraps the URL and disk loaders behind a
// uniform interface, lazy-loads each entity collection on first access,
// caches the result for subsequent calls, and exposes a fluent query
// builder backed by the existing pipeline engine.
//
// Records returned by the dataset carry relationship helper methods
// (e.g. `tablet.getCompatiblePens()`) bound to the parent dataset via
// closure. The same helpers are also available as `ds.method(record)`
// — both APIs are kept; the record-method form delegates to the
// dataset-method form internally.
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
//   const pens = await wacomTablets[0].getCompatiblePens();

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
import type { AnyFieldDef } from "./pipeline/types.js";
import { Query } from "./pipeline/query.js";
import { DataSet } from "./pipeline/dataset.js";
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

// --- Record types with relationship methods --------------------------------
//
// Each entity returned by the dataset is a shallow clone of the raw loaded
// record with extra non-enumerable methods bound to the parent dataset.

export type TabletWithRels = Tablet & {
  getCompatiblePens(): Promise<PenWithRels[]>;
  getFamily(): Promise<TabletFamilyWithRels | null>;
  getBrand(): Promise<BrandWithRels | null>;
};

export type PenWithRels = Pen & {
  getCompatibleTablets(): Promise<TabletWithRels[]>;
  getFamily(): Promise<PenFamilyWithRels | null>;
  getBrand(): Promise<BrandWithRels | null>;
};

export type TabletFamilyWithRels = TabletFamily & {
  getTablets(): Promise<TabletWithRels[]>;
  getBrand(): Promise<BrandWithRels | null>;
};

export type PenFamilyWithRels = PenFamily & {
  getPens(): Promise<PenWithRels[]>;
  getBrand(): Promise<BrandWithRels | null>;
};

export type BrandWithRels = Brand & {
  getTablets(): Promise<TabletWithRels[]>;
  getPens(): Promise<PenWithRels[]>;
};

export type DriverWithRels = Driver & {
  getBrand(): Promise<BrandWithRels | null>;
};

export type InventoryPenWithRels = InventoryPen & {
  getPen(): Promise<PenWithRels | null>;
};

export type InventoryTabletWithRels = InventoryTablet & {
  getTablet(): Promise<TabletWithRels | null>;
};

export type PressureResponseWithRels = PressureResponse & {
  getPen(): Promise<PenWithRels | null>;
  getTablet(): Promise<TabletWithRels | null>;
  getPenFamily(): Promise<PenFamilyWithRels | null>;
};

// --- Loaders ---------------------------------------------------------------

type RawLoaders = {
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

function makeLoaders(source: DataSource): RawLoaders {
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

// --- Augmentation helpers --------------------------------------------------
//
// Each `wrap*` returns a shallow clone of the raw record with relationship
// methods attached as non-enumerable properties — keeps JSON.stringify and
// Object.keys behaving as on the raw record while adding ergonomics.

function defineHidden<T extends object>(
  obj: T,
  methods: Record<string, (...args: unknown[]) => unknown>,
): T {
  for (const [name, fn] of Object.entries(methods)) {
    Object.defineProperty(obj, name, {
      value: fn,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
  return obj;
}

// --- Dataset ---------------------------------------------------------------

/**
 * High-level entry point. Construct once, then access entity collections
 * via the typed properties (`ds.Tablets`, `ds.Pens`, etc.). Each collection
 * is loaded lazily on first access and cached for the lifetime of the
 * instance by the generic `DataSet` base class.
 */
export class DrawTabDataSet extends DataSet {
  constructor(source: DataSource) {
    super();
    const loaders = makeLoaders(source);

    this.registerCollection<BrandWithRels>(
      "Brands",
      async () => (await loaders.brands()).map((b) => this.wrapBrand(b)),
      BRAND_FIELDS as AnyFieldDef[],
    );
    this.registerCollection<TabletWithRels>(
      "Tablets",
      async () => (await loaders.tablets()).map((t) => this.wrapTablet(t)),
      TABLET_FIELDS as AnyFieldDef[],
    );
    this.registerCollection<TabletFamilyWithRels>(
      "TabletFamilies",
      async () => (await loaders.tabletFamilies()).map((f) => this.wrapTabletFamily(f)),
      TABLET_FAMILY_FIELDS as AnyFieldDef[],
    );
    this.registerCollection<PenWithRels>(
      "Pens",
      async () => (await loaders.pens()).map((p) => this.wrapPen(p)),
      PEN_FIELDS as AnyFieldDef[],
    );
    this.registerCollection<PenFamilyWithRels>(
      "PenFamilies",
      async () => (await loaders.penFamilies()).map((f) => this.wrapPenFamily(f)),
      PEN_FAMILY_FIELDS as AnyFieldDef[],
    );
    this.registerCollection<DriverWithRels>(
      "Drivers",
      async () => (await loaders.drivers()).map((d) => this.wrapDriver(d)),
      DRIVER_FIELDS as AnyFieldDef[],
    );
    this.registerCollection<PenCompat>(
      "PenCompat",
      loaders.penCompat,
      PEN_COMPAT_FIELDS as AnyFieldDef[],
    );
    this.registerCollection<PressureResponseWithRels>(
      "PressureResponse",
      async () => (await loaders.pressureResponse()).map((s) => this.wrapPressureResponse(s)),
      PRESSURE_RESPONSE_FIELDS as AnyFieldDef[],
    );
    this.registerCollection<InventoryPenWithRels>(
      "InventoryPens",
      async () => (await loaders.inventoryPens()).map((p) => this.wrapInventoryPen(p)),
      INVENTORY_PEN_FIELDS as AnyFieldDef[],
    );
    this.registerCollection<InventoryTabletWithRels>(
      "InventoryTablets",
      async () => (await loaders.inventoryTablets()).map((t) => this.wrapInventoryTablet(t)),
      INVENTORY_TABLET_FIELDS as AnyFieldDef[],
    );
  }

  // --- Augmentation -- bound to `this` so methods can call back ------------

  private wrapTablet(t: Tablet): TabletWithRels {
    const ds = this;
    return defineHidden({ ...t }, {
      getCompatiblePens: () => ds.getCompatiblePens(t),
      getFamily: () => ds.getTabletFamily(t),
      getBrand: () => ds.getBrand(t),
    }) as TabletWithRels;
  }

  private wrapPen(p: Pen): PenWithRels {
    const ds = this;
    return defineHidden({ ...p }, {
      getCompatibleTablets: () => ds.getCompatibleTablets(p),
      getFamily: () => ds.getPenFamily(p),
      getBrand: () => ds.getBrand(p),
    }) as PenWithRels;
  }

  private wrapTabletFamily(f: TabletFamily): TabletFamilyWithRels {
    const ds = this;
    return defineHidden({ ...f }, {
      getTablets: () => ds.getTabletsInFamily(f),
      getBrand: () => ds.getBrand(f),
    }) as TabletFamilyWithRels;
  }

  private wrapPenFamily(f: PenFamily): PenFamilyWithRels {
    const ds = this;
    return defineHidden({ ...f }, {
      getPens: () => ds.getPensInFamily(f),
      getBrand: () => ds.getBrand(f),
    }) as PenFamilyWithRels;
  }

  private wrapBrand(b: Brand): BrandWithRels {
    const ds = this;
    return defineHidden({ ...b }, {
      getTablets: () => ds.getTabletsForBrand(b),
      getPens: () => ds.getPensForBrand(b),
    }) as BrandWithRels;
  }

  private wrapDriver(d: Driver): DriverWithRels {
    const ds = this;
    return defineHidden({ ...d }, {
      getBrand: () => ds.getBrand(d),
    }) as DriverWithRels;
  }

  private wrapInventoryPen(p: InventoryPen): InventoryPenWithRels {
    const ds = this;
    return defineHidden({ ...p }, {
      getPen: () => ds.getPenForInventory(p),
    }) as InventoryPenWithRels;
  }

  private wrapInventoryTablet(t: InventoryTablet): InventoryTabletWithRels {
    const ds = this;
    return defineHidden({ ...t }, {
      getTablet: () => ds.getTabletForInventory(t),
    }) as InventoryTabletWithRels;
  }

  private wrapPressureResponse(s: PressureResponse): PressureResponseWithRels {
    const ds = this;
    return defineHidden({ ...s }, {
      getPen: () => ds.getPenForSession(s),
      getTablet: () => ds.getTabletForSession(s),
      getPenFamily: () => ds.getPenFamilyForSession(s),
    }) as PressureResponseWithRels;
  }

  // --- Collection accessors -- thin delegates over the generic DataSet ----

  get Brands(): Query<BrandWithRels> { return this.get<BrandWithRels>("Brands"); }
  get Tablets(): Query<TabletWithRels> { return this.get<TabletWithRels>("Tablets"); }
  get TabletFamilies(): Query<TabletFamilyWithRels> { return this.get<TabletFamilyWithRels>("TabletFamilies"); }
  get Pens(): Query<PenWithRels> { return this.get<PenWithRels>("Pens"); }
  get PenFamilies(): Query<PenFamilyWithRels> { return this.get<PenFamilyWithRels>("PenFamilies"); }
  get Drivers(): Query<DriverWithRels> { return this.get<DriverWithRels>("Drivers"); }
  get PenCompat(): Query<PenCompat> { return this.get<PenCompat>("PenCompat"); }
  get PressureResponse(): Query<PressureResponseWithRels> { return this.get<PressureResponseWithRels>("PressureResponse"); }
  /** Per-user inventory. Requires `userId` on the DataSource — accessing
   * the query throws on materialisation if none was supplied. */
  get InventoryPens(): Query<InventoryPenWithRels> { return this.get<InventoryPenWithRels>("InventoryPens"); }
  /** Per-user inventory. Requires `userId` on the DataSource — accessing
   * the query throws on materialisation if none was supplied. */
  get InventoryTablets(): Query<InventoryTabletWithRels> { return this.get<InventoryTabletWithRels>("InventoryTablets"); }

  // --- Dataset-level resolution methods ------------------------------------
  //
  // These are the underlying mechanism the record-method form delegates to.
  // They accept the raw record type but return wrapped records (the dataset
  // caches wrapped records, so the filter results are already augmented).

  async getCompatiblePens(tablet: Tablet): Promise<PenWithRels[]> {
    // Semi-join Pens against the PenCompat rows that reference this tablet.
    // Equivalent to the prior hand-written set-based filter, expressed as
    // a Query verb so the pattern is reusable for ad-hoc joins.
    return this.Pens.semijoin(
      this.PenCompat.filter("TabletId", "==", tablet.Model.Id),
      "PenId",
      "PenId",
    ).toArray();
  }

  async getCompatibleTablets(pen: Pen): Promise<TabletWithRels[]> {
    const [tablets, compat] = await Promise.all([
      this.Tablets.toArray(),
      this.PenCompat.toArray(),
    ]);
    const compatTabletIds = new Set(
      compat.filter((c) => c.PenId === pen.PenId).map((c) => c.TabletId),
    );
    return tablets.filter((t) => compatTabletIds.has(t.Model.Id));
  }

  async getTabletFamily(tablet: Tablet): Promise<TabletFamilyWithRels | null> {
    const familyRef = tablet.Model.Family;
    if (!familyRef) return null;
    const families = await this.TabletFamilies.toArray();
    return families.find((f) => f.EntityId === familyRef) ?? null;
  }

  async getPenFamily(pen: Pen): Promise<PenFamilyWithRels | null> {
    const familyRef = pen.PenFamily;
    if (!familyRef) return null;
    const families = await this.PenFamilies.toArray();
    return families.find((f) => f.EntityId === familyRef) ?? null;
  }

  async getTabletsInFamily(family: TabletFamily): Promise<TabletWithRels[]> {
    const tablets = await this.Tablets.toArray();
    return tablets.filter((t) => t.Model.Family === family.EntityId);
  }

  async getPensInFamily(family: PenFamily): Promise<PenWithRels[]> {
    const pens = await this.Pens.toArray();
    return pens.filter((p) => p.PenFamily === family.EntityId);
  }

  async getTabletsForBrand(brand: Brand): Promise<TabletWithRels[]> {
    const tablets = await this.Tablets.toArray();
    return tablets.filter((t) => t.Model.Brand === brand.BrandId);
  }

  async getPensForBrand(brand: Brand): Promise<PenWithRels[]> {
    const pens = await this.Pens.toArray();
    return pens.filter((p) => p.Brand === brand.BrandId);
  }

  /** The brand record for any entity that has a `Brand` field
   * (Tablet uses `Model.Brand`; others have a top-level `Brand`). */
  async getBrand(
    entity: { Brand?: string; Model?: { Brand?: string } },
  ): Promise<BrandWithRels | null> {
    const brandId = entity.Brand ?? entity.Model?.Brand;
    if (!brandId) return null;
    const brands = await this.Brands.toArray();
    return brands.find((b) => b.BrandId === brandId) ?? null;
  }

  async getPenForInventory(inv: InventoryPen): Promise<PenWithRels | null> {
    if (!inv.PenEntityId) return null;
    const pens = await this.Pens.toArray();
    return pens.find((p) => p.EntityId === inv.PenEntityId) ?? null;
  }

  async getTabletForInventory(inv: InventoryTablet): Promise<TabletWithRels | null> {
    if (!inv.TabletEntityId) return null;
    const tablets = await this.Tablets.toArray();
    return tablets.find((t) => t.Meta.EntityId === inv.TabletEntityId) ?? null;
  }

  async getPenForSession(s: PressureResponse): Promise<PenWithRels | null> {
    if (!s.PenEntityId) return null;
    const pens = await this.Pens.toArray();
    return pens.find((p) => p.EntityId === s.PenEntityId) ?? null;
  }

  async getTabletForSession(s: PressureResponse): Promise<TabletWithRels | null> {
    if (!s.TabletEntityId) return null;
    const tablets = await this.Tablets.toArray();
    return tablets.find((t) => t.Meta.EntityId === s.TabletEntityId) ?? null;
  }

  async getPenFamilyForSession(s: PressureResponse): Promise<PenFamilyWithRels | null> {
    if (!s.PenFamily) return null;
    const families = await this.PenFamilies.toArray();
    return families.find((f) => f.EntityId === s.PenFamily) ?? null;
  }
}
