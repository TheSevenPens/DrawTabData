// --- Types ---

export interface Dimensions {
  Width?: number;
  Height?: number;
  Depth?: number;
}

export interface ColorGamuts {
  SRGB?: number;
  ADOBERGB?: number;
  DCIP3?: number;
  DISPLAYP3?: number;
  NTSC?: number;
  REC709?: number;
}

export interface Tablet {
  EntityId: string;
  Brand: string;
  ModelId: string;
  ModelName: string;
  ModelType: "PENTABLET" | "PENDISPLAY";
  ModelLaunchYear: string;
  ModelAudience?: string;
  ModelFamily?: string;
  ModelIncludedPen?: string;
  ModelProductLink?: string;
  ModelStatus?: string;
  DigitizerType?: string;
  DigitizerPressureLevels?: string;
  DigitizerDimensions?: Dimensions;
  DigitizerDensity?: string;
  DigitizerReportRate?: string;
  DigitizerTilt?: string;
  DigitizerAccuracyCenter?: string;
  DigitizerAccuracyCorner?: string;
  DigitizerMaxHover?: string;
  DigitizerSupportsTouch?: string;
  DisplayPixelDimensions?: Dimensions;
  DisplayPanelTech?: string;
  DisplayBrightness?: string;
  DisplayContrast?: string;
  DisplayColorBitDepth?: string;
  DisplayColorGamuts?: ColorGamuts;
  DisplayLamination?: string;
  DisplayAntiGlare?: string;
  DisplayResponseTime?: string;
  DisplayRefreshRate?: string;
  DisplayViewingAngleHorizontal?: string;
  DisplayViewingAngleVertical?: string;
  PhysicalDimensions?: Dimensions;
  PhysicalWeight?: string;
  PhysicalWeightInclStand?: string;
  _id: string;
  _CreateDate: string;
  _ModifiedDate: string;
}

export interface Pen {
  EntityId: string;
  Brand: string;
  PenId: string;
  PenName: string;
  PenFamily: string;
  PenYear: string;
  _id: string;
  _CreateDate: string;
  _ModifiedDate: string;
}

export interface PenFamily {
  EntityId: string;
  Brand: string;
  FamilyId: string;
  FamilyName: string;
  _id: string;
  _CreateDate: string;
  _ModifiedDate: string;
}

export interface TabletFamily {
  EntityId: string;
  Brand: string;
  FamilyId: string;
  FamilyName: string;
  _id: string;
  _CreateDate: string;
  _ModifiedDate: string;
}

export interface Driver {
  EntityId: string;
  Brand: string;
  DriverVersion: string;
  DriverName: string;
  DriverUID: string;
  OSFamily: string;
  ReleaseDate: string;
  DriverURLWacom: string;
  DriverURLArchiveDotOrg: string;
  ReleaseNotesURL: string;
  _id: string;
  _CreateDate: string;
  _ModifiedDate: string;
}

export interface PenCompat {
  Brand: string;
  TabletId: string;
  PenId: string;
  _id: string;
  _CreateDate: string;
  _ModifiedDate: string;
}

// --- Generic loader ---

const BRANDS = ["HUION", "WACOM", "XENCELABS", "XPPEN"];

export async function loadBrandPartitionedDataFromURL<T>(
  dataBaseUrl: string,
  entityPath: string,
  rootKey: string,
  brands: string[] = BRANDS,
): Promise<T[]> {
  const all: T[] = [];
  const fetches = brands.map(async (brand) => {
    const url = `${dataBaseUrl}/${entityPath}/${brand}-${entityPath}.json`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`Failed to load ${url}: ${resp.status}`);
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
  return loadBrandPartitionedDataFromURL<Driver>(dataBaseUrl, "drivers", "Drivers", ["WACOM"]);
}

// --- Pen loader ---

export async function loadPensFromURL(dataBaseUrl: string): Promise<Pen[]> {
  return loadBrandPartitionedDataFromURL<Pen>(dataBaseUrl, "pens", "Pens");
}

// --- Family loaders ---

export async function loadPenFamiliesFromURL(dataBaseUrl: string): Promise<PenFamily[]> {
  return loadBrandPartitionedDataFromURL<PenFamily>(dataBaseUrl, "pen-families", "PenFamilies", ["WACOM"]);
}

export async function loadTabletFamiliesFromURL(dataBaseUrl: string): Promise<TabletFamily[]> {
  return loadBrandPartitionedDataFromURL<TabletFamily>(dataBaseUrl, "tablet-families", "TabletFamilies", ["WACOM"]);
}

// --- Pen compat loader ---

interface PenCompatGrouped {
  Brand: string;
  PenId: string;
  TabletIds: string[];
}

function expandPenCompat(grouped: PenCompatGrouped[]): PenCompat[] {
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

export async function loadPenCompatFromURL(dataBaseUrl: string): Promise<PenCompat[]> {
  const grouped = await loadBrandPartitionedDataFromURL<PenCompatGrouped>(dataBaseUrl, "pen-compat", "PenCompat");
  return expandPenCompat(grouped);
}

// --- Helpers ---

export function getDiagonal(dimensions: Dimensions | undefined): number | null {
  if (!dimensions || dimensions.Width == null || dimensions.Height == null) return null;
  return Math.sqrt(dimensions.Width * dimensions.Width + dimensions.Height * dimensions.Height);
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
