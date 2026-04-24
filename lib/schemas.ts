// Valibot schemas for all entity types. The TS interfaces in
// drawtab-loader.ts are inferred from these, so the schema is the
// single source of truth for both shape and runtime validation.
//
// Schemas use strictObject so unknown fields are flagged at parse
// time. Multi-valued fields (e.g. Model.IncludedPen) are arrays of
// strings. Cross-field rules (e.g. PENTABLET cannot have Display
// group) are enforced by v.rawCheck so data-quality flags it.
//
// Tablet fields are nested into groups:
//   Meta       — internal tracking (EntityId, _id, dates)
//   Model      — product identity (Brand, Name, Type, Year, ...)
//   Digitizer  — digitizer specs
//   Display    — display specs  (PENDISPLAY + STANDALONE only)
//   Physical   — physical dimensions and weight
//   Standalone — compute/battery/connectivity/hardware (STANDALONE only)

import * as v from "valibot";

// --- Primitives & helpers ---

const TrimmedString = v.pipe(
  v.string(),
  v.check((s) => s === s.trim(), "value has leading/trailing whitespace"),
);

/** A string that, if non-empty, must parse as a number. */
const NumericString = v.pipe(
  TrimmedString,
  v.check(
    (s) => s === "" || !isNaN(Number(s)),
    "expected a numeric value",
  ),
);

const UuidString = v.pipe(TrimmedString, v.uuid("invalid UUID format"));
const IsoDateString = v.pipe(TrimmedString, v.isoTimestamp("invalid ISO 8601 date"));

const BrandEnum = v.picklist(["DIGIDRAW", "GAOMON", "HUION", "SAMSUNG", "UGEE", "WACOM", "XENCELABS", "XPPEN"]);
const YesNo = v.picklist(["YES", "NO"]);

// --- Shared sub-shapes ---

export const DimensionsSchema = v.strictObject({
  Width: v.optional(v.number()),
  Height: v.optional(v.number()),
  Depth: v.optional(v.number()),
});

export const ColorGamutsSchema = v.strictObject({
  SRGB: v.optional(v.number()),
  ADOBERGB: v.optional(v.number()),
  DCIP3: v.optional(v.number()),
  DISPLAYP3: v.optional(v.number()),
  NTSC: v.optional(v.number()),
  REC709: v.optional(v.number()),
});

// --- Tablet group schemas ---

const MetaSchema = v.strictObject({
  EntityId: TrimmedString,
  _id: UuidString,
  _CreateDate: IsoDateString,
  _ModifiedDate: IsoDateString,
});

const ModelSchema = v.strictObject({
  Brand: BrandEnum,
  Id: TrimmedString,
  Name: TrimmedString,
  AlternateNames: v.optional(v.array(TrimmedString)),
  Type: v.picklist(["PENTABLET", "PENDISPLAY", "STANDALONE"]),
  LaunchYear: TrimmedString,
  Audience: v.optional(v.picklist(["Consumer", "Enthusiast", "Professional"])),
  Family: v.optional(TrimmedString),
  IncludedPen: v.optional(v.array(TrimmedString)),
  ProductLink: v.optional(TrimmedString),
  UserManual: v.optional(TrimmedString),
  Status: v.optional(v.picklist(["ACTIVE", "AVAILABLE", "DISCONTINUED"])),
});

const DigitizerSchema = v.strictObject({
  Type: v.optional(v.picklist(["PASSIVE_EMR", "ACTIVE_EMR"])),
  PressureLevels: v.optional(NumericString),
  Dimensions: v.optional(DimensionsSchema),
  Density: v.optional(NumericString),
  ReportRate: v.optional(NumericString),
  Tilt: v.optional(NumericString),
  AccuracyCenter: v.optional(NumericString),
  AccuracyCorner: v.optional(NumericString),
  MaxHover: v.optional(NumericString),
  SupportsTouch: v.optional(YesNo),
});

const DisplaySchema = v.strictObject({
  PixelDimensions: v.optional(DimensionsSchema),
  PanelTech: v.optional(v.picklist(["IPS", "TFT", "AHVA", "OLED", "H-IPS", "MVA"])),
  Brightness: v.optional(NumericString),
  BrightnessPeak: v.optional(NumericString),
  Contrast: v.optional(NumericString),
  ColorBitDepth: v.optional(v.picklist(["6", "8", "10"])),
  ColorGamuts: v.optional(ColorGamutsSchema),
  Lamination: v.optional(YesNo),
  AntiGlare: v.optional(v.picklist(["AGFILM", "ETCHEDGLASS", "FILM"])),
  ResponseTime: v.optional(NumericString),
  RefreshRate: v.optional(NumericString),
  ViewingAngleHorizontal: v.optional(NumericString),
  ViewingAngleVertical: v.optional(NumericString),
});

const PhysicalSchema = v.strictObject({
  Dimensions: v.optional(DimensionsSchema),
  Weight: v.optional(NumericString),
  WeightInclStand: v.optional(YesNo),
});

const StandaloneSchema = v.strictObject({
  OS: v.optional(TrimmedString),
  Processor: v.optional(TrimmedString),
  GPU: v.optional(TrimmedString),
  RAM: v.optional(NumericString),
  Storage: v.optional(NumericString),
  ExpandableStorage: v.optional(YesNo),
  MemoryCardSlot: v.optional(TrimmedString),
  BatteryCapacity: v.optional(NumericString),
  BatteryLife: v.optional(NumericString),
  BatteryChargingWatts: v.optional(NumericString),
  Wifi: v.optional(TrimmedString),
  Bluetooth: v.optional(TrimmedString),
  USB: v.optional(TrimmedString),
  Speakers: v.optional(YesNo),
  FrontCamera: v.optional(NumericString),
  RearCamera: v.optional(NumericString),
});

/**
 * Tablet schema with nested field groups. Display and Standalone groups
 * are optional objects — absent on tablet types that don't use them.
 * Cross-group rules are enforced by v.rawCheck.
 */
export const TabletSchema = v.pipe(
  v.strictObject({
    Meta: MetaSchema,
    Model: ModelSchema,
    Digitizer: v.optional(DigitizerSchema),
    Display: v.optional(DisplaySchema),
    Physical: v.optional(PhysicalSchema),
    Standalone: v.optional(StandaloneSchema),
  }),
  v.rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed) return;
    const val = dataset.value;
    if (val.Model.Type === "PENTABLET" && val.Display !== undefined) {
      addIssue({ message: "Display group present on a PENTABLET" });
    }
    if (val.Model.Type !== "STANDALONE" && val.Standalone !== undefined) {
      addIssue({ message: "Standalone group present on a non-STANDALONE tablet" });
    }
  }),
);

export const TabletFileSchema = v.strictObject({
  DrawingTablets: v.array(TabletSchema),
});

// --- Pen ---

export const PenSchema = v.strictObject({
  EntityId: TrimmedString,
  Brand: BrandEnum,
  PenId: TrimmedString,
  PenName: TrimmedString,
  PenFamily: TrimmedString,
  PenYear: TrimmedString,
  PenTech: v.optional(TrimmedString),
  ButtonCount: v.optional(NumericString),
  PressureSensitive: v.optional(YesNo),
  PressureLevels: v.optional(NumericString),
  Roller: v.optional(YesNo),
  Eraser: v.optional(YesNo),
  Shape: v.optional(v.picklist(["THIN", "STANDARD"])),
  Weight: v.optional(NumericString),
  Tilt: v.optional(YesNo),
  BarrelRotation: v.optional(YesNo),
  Tags: v.optional(v.array(TrimmedString)),
  _id: UuidString,
  _CreateDate: IsoDateString,
  _ModifiedDate: IsoDateString,
});

// --- Families ---

const FamilyFields = {
  EntityId: TrimmedString,
  Brand: BrandEnum,
  FamilyId: TrimmedString,
  FamilyName: TrimmedString,
  _id: UuidString,
  _CreateDate: IsoDateString,
  _ModifiedDate: IsoDateString,
};

export const PenFamilySchema = v.strictObject(FamilyFields);
export const TabletFamilySchema = v.strictObject({
  ...FamilyFields,
  ModelPattern: v.optional(TrimmedString),
});

// --- Driver ---

export const DriverSchema = v.strictObject({
  EntityId: TrimmedString,
  Brand: BrandEnum,
  DriverVersion: TrimmedString,
  DriverName: TrimmedString,
  DriverUID: TrimmedString,
  OSFamily: TrimmedString,
  ReleaseDate: TrimmedString,
  DriverURLWacom: TrimmedString,
  DriverURLArchiveDotOrg: TrimmedString,
  ReleaseNotesURL: TrimmedString,
  _id: UuidString,
  _CreateDate: IsoDateString,
  _ModifiedDate: IsoDateString,
});

// --- Brand ---

export const BrandSchema = v.strictObject({
  EntityId: TrimmedString,
  BrandId: TrimmedString,
  BrandName: TrimmedString,
  SiteURL: TrimmedString,
  Country: TrimmedString,
  FoundedYear: v.optional(TrimmedString),
  _id: UuidString,
  _CreateDate: IsoDateString,
  _ModifiedDate: IsoDateString,
});

// --- Pen compat (grouped form on disk) ---

export const PenCompatGroupedSchema = v.strictObject({
  Brand: BrandEnum,
  PenId: TrimmedString,
  TabletIds: v.array(TrimmedString),
});

// --- Pressure response ---

export const PressureResponseSchema = v.strictObject({
  Brand: BrandEnum,
  PenEntityId: TrimmedString,
  PenFamily: TrimmedString,
  InventoryId: TrimmedString,
  Date: TrimmedString,
  User: TrimmedString,
  TabletEntityId: TrimmedString,
  Driver: TrimmedString,
  OS: TrimmedString,
  Notes: TrimmedString,
  Records: v.array(v.tuple([v.number(), v.number()])),
  _id: UuidString,
  _CreateDate: IsoDateString,
  _ModifiedDate: IsoDateString,
});

// --- Inventory ---

/** A single defect entry on a per-unit inventory record. */
const DefectEntrySchema = v.strictObject({
  Kind: TrimmedString,
  Notes: TrimmedString,
});

export const InventoryPenSchema = v.strictObject({
  PenEntityId: TrimmedString,
  Brand: TrimmedString,
  PenTech: TrimmedString,
  PenTechSubtype: TrimmedString,
  InventoryId: TrimmedString,
  WithTabletInventoryId: TrimmedString,
  Notes: TrimmedString,
  Tags: v.optional(v.array(TrimmedString)),
  Defects: v.optional(v.array(DefectEntrySchema)),
  _id: UuidString,
  _CreateDate: IsoDateString,
  _ModifiedDate: IsoDateString,
});

export const InventoryPenFileSchema = v.strictObject({
  InventoryPens: v.array(InventoryPenSchema),
});

export const InventoryTabletSchema = v.strictObject({
  TabletEntityId: TrimmedString,
  Brand: TrimmedString,
  ModelId: TrimmedString,
  ModelName: TrimmedString,
  TabletType: v.picklist(["PENTABLET", "PENDISPLAY", "STANDALONE"]),
  InventoryId: TrimmedString,
  Vendor: TrimmedString,
  OrderDate: TrimmedString,
  Notes: TrimmedString,
  Tags: v.optional(v.array(TrimmedString)),
  Defects: v.optional(v.array(DefectEntrySchema)),
  _id: UuidString,
  _CreateDate: IsoDateString,
  _ModifiedDate: IsoDateString,
});

export const InventoryTabletFileSchema = v.strictObject({
  InventoryTablets: v.array(InventoryTabletSchema),
});

// --- Defect kinds vocabulary (data/reference/defect-kinds.json) ---

export const DefectKindSchema = v.strictObject({
  Kind: TrimmedString,
  AppliesTo: v.array(v.picklist(["pen", "tablet"])),
  Description: TrimmedString,
});

export const DefectKindsFileSchema = v.strictObject({
  DefectKinds: v.array(DefectKindSchema),
});

// --- Version info (data/version.json) ---

export const VersionInfoSchema = v.strictObject({
  schemaVersion: v.number(),
  version: TrimmedString,
  commit: TrimmedString,
  shortCommit: TrimmedString,
  commitDate: TrimmedString,
  counts: v.strictObject({
    tablets: v.number(),
    pens: v.number(),
    penFamilies: v.number(),
    tabletFamilies: v.number(),
    drivers: v.number(),
    brands: v.number(),
    pressureResponse: v.number(),
  }),
});

// --- Inferred types ---

export type Tablet = v.InferOutput<typeof TabletSchema>;
export type Dimensions = v.InferOutput<typeof DimensionsSchema>;
export type ColorGamuts = v.InferOutput<typeof ColorGamutsSchema>;
export type Pen = v.InferOutput<typeof PenSchema>;
export type PenFamily = v.InferOutput<typeof PenFamilySchema>;
export type TabletFamily = v.InferOutput<typeof TabletFamilySchema>;
export type Driver = v.InferOutput<typeof DriverSchema>;
export type Brand = v.InferOutput<typeof BrandSchema>;
export type PenCompatGrouped = v.InferOutput<typeof PenCompatGroupedSchema>;
export type PressureResponse = v.InferOutput<typeof PressureResponseSchema>;
export type InventoryPen = v.InferOutput<typeof InventoryPenSchema>;
export type InventoryTablet = v.InferOutput<typeof InventoryTabletSchema>;
export type DefectKind = v.InferOutput<typeof DefectKindSchema>;
export type VersionInfo = v.InferOutput<typeof VersionInfoSchema>;
