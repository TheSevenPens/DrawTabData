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
  DisplayResolution?: Dimensions;
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

export async function loadDriversFromURL(dataBaseUrl: string): Promise<Record<string, unknown>[]> {
  return loadBrandPartitionedDataFromURL<Record<string, unknown>>(dataBaseUrl, "drivers", "Drivers", ["WACOM"]);
}

// --- Pen loader ---

export async function loadPensFromURL(dataBaseUrl: string): Promise<Record<string, unknown>[]> {
  return loadBrandPartitionedDataFromURL<Record<string, unknown>>(dataBaseUrl, "pens", "Pens", ["WACOM"]);
}

// --- Family loaders ---

export async function loadPenFamiliesFromURL(dataBaseUrl: string): Promise<Record<string, unknown>[]> {
  return loadBrandPartitionedDataFromURL<Record<string, unknown>>(dataBaseUrl, "pen-families", "PenFamilies", ["WACOM"]);
}

export async function loadTabletFamiliesFromURL(dataBaseUrl: string): Promise<Record<string, unknown>[]> {
  return loadBrandPartitionedDataFromURL<Record<string, unknown>>(dataBaseUrl, "tablet-families", "TabletFamilies", ["WACOM"]);
}

// --- Pen compat loader ---

export async function loadPenCompatFromURL(dataBaseUrl: string): Promise<Record<string, unknown>[]> {
  return loadBrandPartitionedDataFromURL<Record<string, unknown>>(dataBaseUrl, "pen-compat", "PenCompat", ["WACOM"]);
}

// --- Accessors ---

export function getBrands(tablets: Tablet[]): string[] {
  return [...new Set(tablets.map((t) => t.Brand))].sort();
}

export function filterByBrand(tablets: Tablet[], brand: string): Tablet[] {
  return tablets.filter((t) => t.Brand === brand);
}

export function filterByType(tablets: Tablet[], type: Tablet["ModelType"]): Tablet[] {
  return tablets.filter((t) => t.ModelType === type);
}
