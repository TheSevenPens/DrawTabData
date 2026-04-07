// Valibot schemas for all entity types. The TS interfaces in
// drawtab-loader.ts are inferred from these, so the schema is the
// single source of truth for both shape and runtime validation.
//
// Schemas use strictObject so unknown fields are flagged at parse
// time. Multi-valued fields (e.g. ModelIncludedPen) are arrays of
// strings. Cross-field rules (e.g. PENTABLET cannot have display
// fields) are enforced by the v.variant discriminated union.

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

const BrandEnum = v.picklist(["GAOMON", "HUION", "SAMSUNG", "UGEE", "WACOM", "XENCELABS", "XPPEN"]);
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

// --- Tablet (variant on ModelType) ---

const TabletBaseFields = {
  EntityId: TrimmedString,
  Brand: BrandEnum,
  ModelId: TrimmedString,
  ModelName: TrimmedString,
  ModelLaunchYear: TrimmedString,
  ModelAudience: v.optional(v.picklist(["Consumer", "Enthusiast", "Professional"])),
  ModelFamily: v.optional(TrimmedString),
  ModelIncludedPen: v.optional(v.array(TrimmedString)),
  ModelProductLink: v.optional(TrimmedString),
  ModelStatus: v.optional(v.picklist(["ACTIVE", "AVAILABLE", "DISCONTINUED"])),
  DigitizerType: v.optional(v.picklist(["PASSIVE_EMR", "ACTIVE_EMR"])),
  DigitizerPressureLevels: v.optional(NumericString),
  DigitizerDimensions: v.optional(DimensionsSchema),
  DigitizerDensity: v.optional(NumericString),
  DigitizerReportRate: v.optional(NumericString),
  DigitizerTilt: v.optional(NumericString),
  DigitizerAccuracyCenter: v.optional(NumericString),
  DigitizerAccuracyCorner: v.optional(NumericString),
  DigitizerMaxHover: v.optional(NumericString),
  DigitizerSupportsTouch: v.optional(YesNo),
  PhysicalDimensions: v.optional(DimensionsSchema),
  PhysicalWeight: v.optional(NumericString),
  PhysicalWeightInclStand: v.optional(YesNo),
  _id: UuidString,
  _CreateDate: IsoDateString,
  _ModifiedDate: IsoDateString,
};

const DisplayFields = {
  DisplayPixelDimensions: v.optional(DimensionsSchema),
  DisplayPanelTech: v.optional(v.picklist(["IPS", "TFT", "AHVA", "OLED", "H-IPS", "MVA"])),
  DisplayBrightness: v.optional(NumericString),
  DisplayContrast: v.optional(NumericString),
  DisplayColorBitDepth: v.optional(v.picklist(["6", "8", "10"])),
  DisplayColorGamuts: v.optional(ColorGamutsSchema),
  DisplayLamination: v.optional(YesNo),
  DisplayAntiGlare: v.optional(v.picklist(["AGFILM", "ETCHEDGLASS", "FILM"])),
  DisplayResponseTime: v.optional(NumericString),
  DisplayRefreshRate: v.optional(NumericString),
  DisplayViewingAngleHorizontal: v.optional(NumericString),
  DisplayViewingAngleVertical: v.optional(NumericString),
};

const DISPLAY_FIELD_KEYS = Object.keys(DisplayFields);

/**
 * Single Tablet schema (not a discriminated union) so downstream code
 * can read display fields without narrowing on ModelType. The cross-
 * field rule "PENTABLET cannot carry display fields" is enforced as
 * a runtime check via v.rawCheck so data-quality flags it, but the
 * inferred TS type still exposes display fields on every tablet.
 */
export const TabletSchema = v.pipe(
  v.strictObject({
    ...TabletBaseFields,
    ...DisplayFields,
    ModelType: v.picklist(["PENTABLET", "PENDISPLAY", "STANDALONE"]),
  }),
  v.rawCheck(({ dataset, addIssue }) => {
    if (dataset.typed && dataset.value.ModelType === "PENTABLET") {
      for (const key of DISPLAY_FIELD_KEYS) {
        if ((dataset.value as Record<string, unknown>)[key] !== undefined) {
          addIssue({
            message: "display field present on a PENTABLET",
            path: [{
              type: "object",
              origin: "value",
              input: dataset.value,
              key,
              value: (dataset.value as Record<string, unknown>)[key],
            }],
          });
        }
      }
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
export const TabletFamilySchema = v.strictObject(FamilyFields);

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
export type VersionInfo = v.InferOutput<typeof VersionInfoSchema>;
