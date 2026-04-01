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
  ModelBrand: string;
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

interface TabletFile {
  DrawingTablets: Tablet[];
}

// --- Loader ---

const BRANDS = ["HUION", "WACOM", "XENCELABS", "XPPEN"];

export async function loadTablets(dataBaseUrl: string): Promise<Tablet[]> {
  const all: Tablet[] = [];
  const fetches = BRANDS.map(async (brand) => {
    const url = `${dataBaseUrl}/tablets/${brand}-tablets.json`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`Failed to load ${url}: ${resp.status}`);
      return;
    }
    const data: TabletFile = await resp.json();
    all.push(...data.DrawingTablets);
  });
  await Promise.all(fetches);
  return all;
}

// --- Accessors ---

export function getBrands(tablets: Tablet[]): string[] {
  return [...new Set(tablets.map((t) => t.ModelBrand))].sort();
}

export function filterByBrand(tablets: Tablet[], brand: string): Tablet[] {
  return tablets.filter((t) => t.ModelBrand === brand);
}

export function filterByType(tablets: Tablet[], type: Tablet["ModelType"]): Tablet[] {
  return tablets.filter((t) => t.ModelType === type);
}
