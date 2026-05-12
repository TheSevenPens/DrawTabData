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
import type {
  AnyFieldDef,
  Step,
  AggregatorSpec,
  SummaryRow,
  FilterExpr,
  JoinStep,
  SemijoinStep,
} from "./pipeline/types.js";
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
 * Ergonomic shape for `Query.summarize()`. Translates to one canonical
 * `SummarizeStep` with `groupBy` (always an array) and `aggs` (one entry
 * per requested aggregator). Examples:
 *
 *   { by: "Brand", count: true }
 *     → groupBy: ["Brand"], aggs: [{ name: "count", op: "count" }]
 *
 *   { by: ["Brand", "ModelType"], count: "tablets" }
 *     → groupBy: ["Brand", "ModelType"], aggs: [{ name: "tablets", op: "count" }]
 *
 *   { by: "Brand", avg: { avgYear: "ModelLaunchYear" } }
 *     → aggs: [{ name: "avgYear", op: "avg", field: "ModelLaunchYear" }]
 */
export interface SummarizeSpec {
  /** Field key(s) to group by. Omit for a single all-rows summary. */
  by?: string | string[];
  /** `true` → adds a `count` column; string → uses that column name. */
  count?: boolean | string;
  /** Map of output-column-name → field key. Empty/non-numeric skipped. */
  sum?: Record<string, string>;
  avg?: Record<string, string>;
  min?: Record<string, string>;
  max?: Record<string, string>;
  median?: Record<string, string>;
  /** Count of distinct non-empty values per group. */
  distinctCount?: Record<string, string>;
  /** First / last raw value in input order (includes empties). */
  first?: Record<string, string>;
  last?: Record<string, string>;
  /** Array of all raw values per group (input order, includes empties). */
  collect?: Record<string, string>;
}

function summarizeSpecToAggs(spec: SummarizeSpec): AggregatorSpec[] {
  const aggs: AggregatorSpec[] = [];
  if (spec.count) {
    aggs.push({ name: spec.count === true ? "count" : spec.count, op: "count" });
  }
  const fieldedOps = ["sum", "avg", "min", "max", "median", "distinctCount", "first", "last", "collect"] as const;
  for (const op of fieldedOps) {
    for (const [name, field] of Object.entries(spec[op] ?? {})) {
      aggs.push({ name, op, field });
    }
  }
  return aggs;
}

/**
 * Lazy query over an entity collection. Calls to filter/sort/take/summarize
 * return a new Query with the step appended; the underlying load and
 * execution are deferred until toArray/find/count.
 */
export class Query<T> {
  constructor(
    private readonly load: () => Promise<T[]>,
    private readonly fields: AnyFieldDef[],
    private readonly steps: Step[] = [],
  ) {}

  /**
   * Three accepted forms:
   *
   * - `.filter(field, op, value)` — flat AND-chain, serialisable to URL state.
   * - `.filter(expr)` — boolean expression tree with `and` / `or` / `not`,
   *   also serialisable.
   * - `.filter(item => ...)` — arbitrary predicate function. NOT serialisable —
   *   such steps are dropped by saved-view / URL-state persistence.
   */
  filter(predicate: (item: T) => boolean): Query<T>;
  filter(expr: FilterExpr): Query<T>;
  filter(field: string, operator: FilterOp, value: string | number): Query<T>;
  filter(
    a: string | ((item: T) => boolean) | FilterExpr,
    b?: FilterOp,
    c?: string | number,
  ): Query<T> {
    if (typeof a === "string") {
      return new Query(this.load, this.fields, [
        ...this.steps,
        { kind: "filter", field: a, operator: b as FilterOp, value: String(c) },
      ]);
    }
    if (typeof a === "function") {
      return new Query(this.load, this.fields, [
        ...this.steps,
        { kind: "predicate", fn: a as (item: unknown) => boolean },
      ]);
    }
    return new Query(this.load, this.fields, [
      ...this.steps,
      { kind: "boolFilter", expr: a },
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

  /**
   * Project each row to only the listed fields, reading values via the
   * active field-defs. Returns a Query whose row shape is `SummaryRow`,
   * so subsequent `.sort()` / `.filter()` / `.take()` operate on the
   * projected columns. Unknown field keys degrade to empty strings.
   */
  select(fields: string[]): Query<SummaryRow> {
    return new Query<SummaryRow>(
      this.load as unknown as () => Promise<SummaryRow[]>,
      this.fields,
      [...this.steps, { kind: "project", fields }],
    );
  }

  /**
   * Distinct non-empty values of a single field, sorted naturally. Equivalent
   * to `.summarize({ by: field }).toArray().map(r => r[field])` with empties
   * dropped and natural sort applied.
   */
  async distinct(field: string): Promise<string[]> {
    const rows = await this.summarize({ by: field }).toArray();
    return rows
      .map((r) => String(r[field] ?? ""))
      .filter((v) => v !== "")
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  /** Synonym for `.distinct()`. */
  values(field: string): Promise<string[]> {
    return this.distinct(field);
  }

  /**
   * Group rows by zero or more fields and compute aggregators per group.
   * Returns a new Query whose row shape is `SummaryRow` — subsequent
   * `.sort()` / `.filter()` / `.take()` target groupBy keys and aggregator
   * output columns (e.g. `.sort("count", "desc").take(5)`).
   */
  summarize(spec: SummarizeSpec): Query<SummaryRow> {
    const groupBy =
      spec.by === undefined ? [] : Array.isArray(spec.by) ? spec.by : [spec.by];
    const aggs = summarizeSpecToAggs(spec);
    return new Query<SummaryRow>(
      // The load function still returns the raw entities — the summarize step
      // collapses them at execution time. We widen its return through unknown
      // because the executor handles the row-shape transition.
      this.load as unknown as () => Promise<SummaryRow[]>,
      this.fields,
      [...this.steps, { kind: "summarize", groupBy, aggs }],
    );
  }

  /**
   * Adds computed columns to each row. The functions are evaluated against
   * the *current* row shape — call `.derive()` before `.summarize()` /
   * `.project()` if you want the derived values available in those steps.
   * Returns a Query whose row shape is widened to include the new keys.
   */
  derive<K extends string>(
    cols: Record<K, (item: T) => string | number>,
  ): Query<T & Record<K, string | number>> {
    return new Query(this.load as unknown as () => Promise<(T & Record<K, string | number>)[]>, this.fields, [
      ...this.steps,
      { kind: "derive", cols: cols as Record<string, (item: unknown) => string | number> },
    ]);
  }

  /**
   * Inner join with another Query. Matching pairs of rows are merged
   * (right-side columns overwrite left on name collisions). The right-side
   * Query is materialised lazily at `.toArray()` time.
   */
  join<U>(other: Query<U>, leftKey: string, rightKey: string): Query<T & U> {
    return new Query(this.load as unknown as () => Promise<(T & U)[]>, this.fields, [
      ...this.steps,
      { kind: "join", other, leftKey, rightKey } as JoinStep,
    ]);
  }

  /**
   * Semi-join: keeps left rows that have at least one matching row on
   * the right side. The right side's columns are *not* merged in — the
   * row shape stays as `T`.
   */
  semijoin<U>(other: Query<U>, leftKey: string, rightKey: string): Query<T> {
    return new Query(this.load, this.fields, [
      ...this.steps,
      { kind: "semijoin", other, leftKey, rightKey } as SemijoinStep,
    ]);
  }

  async toArray(): Promise<T[]> {
    const items = await this.load();
    if (this.steps.length === 0) return items;
    // Resolve any join/semijoin steps by materialising the right side first.
    // The engine itself is synchronous, so this is the awaiting layer.
    const resolved: Step[] = [];
    for (const step of this.steps) {
      if (step.kind === "join") {
        const right = step.other as Query<unknown>;
        const rightRows = await right.toArray();
        resolved.push({
          kind: "joinResolved",
          leftKey: step.leftKey,
          rightKey: step.rightKey,
          rightRows,
          rightFields: right.fields,
        });
      } else if (step.kind === "semijoin") {
        const right = step.other as Query<unknown>;
        const rightRows = await right.toArray();
        resolved.push({
          kind: "semijoinResolved",
          leftKey: step.leftKey,
          rightKey: step.rightKey,
          rightRows,
          rightFields: right.fields,
        });
      } else {
        resolved.push(step);
      }
    }
    return executePipeline(items, resolved, this.fields, []).data;
  }

  async find(predicate: (item: T) => boolean): Promise<T | undefined> {
    return (await this.toArray()).find(predicate);
  }

  async count(): Promise<number> {
    return (await this.toArray()).length;
  }
}

// --- Loaders ---------------------------------------------------------------

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

  // --- Collection accessors -- each cached load returns wrapped records ----

  get Brands(): Query<BrandWithRels> {
    return new Query(
      () => this.memo("brands", async () => {
        const raw = await this.loaders.brands();
        return raw.map((b) => this.wrapBrand(b));
      }) as Promise<BrandWithRels[]>,
      BRAND_FIELDS as AnyFieldDef[],
    );
  }

  get Tablets(): Query<TabletWithRels> {
    return new Query(
      () => this.memo("tablets", async () => {
        const raw = await this.loaders.tablets();
        return raw.map((t) => this.wrapTablet(t));
      }) as Promise<TabletWithRels[]>,
      TABLET_FIELDS as AnyFieldDef[],
    );
  }

  get TabletFamilies(): Query<TabletFamilyWithRels> {
    return new Query(
      () => this.memo("tabletFamilies", async () => {
        const raw = await this.loaders.tabletFamilies();
        return raw.map((f) => this.wrapTabletFamily(f));
      }) as Promise<TabletFamilyWithRels[]>,
      TABLET_FAMILY_FIELDS as AnyFieldDef[],
    );
  }

  get Pens(): Query<PenWithRels> {
    return new Query(
      () => this.memo("pens", async () => {
        const raw = await this.loaders.pens();
        return raw.map((p) => this.wrapPen(p));
      }) as Promise<PenWithRels[]>,
      PEN_FIELDS as AnyFieldDef[],
    );
  }

  get PenFamilies(): Query<PenFamilyWithRels> {
    return new Query(
      () => this.memo("penFamilies", async () => {
        const raw = await this.loaders.penFamilies();
        return raw.map((f) => this.wrapPenFamily(f));
      }) as Promise<PenFamilyWithRels[]>,
      PEN_FAMILY_FIELDS as AnyFieldDef[],
    );
  }

  get Drivers(): Query<DriverWithRels> {
    return new Query(
      () => this.memo("drivers", async () => {
        const raw = await this.loaders.drivers();
        return raw.map((d) => this.wrapDriver(d));
      }) as Promise<DriverWithRels[]>,
      DRIVER_FIELDS as AnyFieldDef[],
    );
  }

  get PenCompat(): Query<PenCompat> {
    return new Query(
      () => this.memo("penCompat", this.loaders.penCompat) as Promise<PenCompat[]>,
      PEN_COMPAT_FIELDS as AnyFieldDef[],
    );
  }

  get PressureResponse(): Query<PressureResponseWithRels> {
    return new Query(
      () => this.memo("pressureResponse", async () => {
        const raw = await this.loaders.pressureResponse();
        return raw.map((s) => this.wrapPressureResponse(s));
      }) as Promise<PressureResponseWithRels[]>,
      PRESSURE_RESPONSE_FIELDS as AnyFieldDef[],
    );
  }

  /** Per-user inventory. Requires `userId` on the DataSource — accessing
   * the query throws on materialisation if none was supplied. */
  get InventoryPens(): Query<InventoryPenWithRels> {
    return new Query(
      () => this.memo("inventoryPens", async () => {
        const raw = await this.loaders.inventoryPens();
        return raw.map((p) => this.wrapInventoryPen(p));
      }) as Promise<InventoryPenWithRels[]>,
      INVENTORY_PEN_FIELDS as AnyFieldDef[],
    );
  }

  /** Per-user inventory. Requires `userId` on the DataSource — accessing
   * the query throws on materialisation if none was supplied. */
  get InventoryTablets(): Query<InventoryTabletWithRels> {
    return new Query(
      () => this.memo("inventoryTablets", async () => {
        const raw = await this.loaders.inventoryTablets();
        return raw.map((t) => this.wrapInventoryTablet(t));
      }) as Promise<InventoryTabletWithRels[]>,
      INVENTORY_TABLET_FIELDS as AnyFieldDef[],
    );
  }

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
