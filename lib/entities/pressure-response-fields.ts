import type { PressureResponse } from "../drawtab-loader.js";
import type { FieldDisplayDef, Step } from "@thesevenpens/queriton";
import { BRANDS } from "../loader-shared.js";
import { estimatePiaf, estimatePmax } from "../pressure/interpolate.js";
import { computedOf } from "../computed.js";

export type { PressureResponse } from "../drawtab-loader.js";

// IsDefective depends on the inventory unit's recorded defects; the
// DrawTabDataSet computes it while loading PressureResponse (see
// ../computed.ts, #346). PenEntityId is the stored EntityId — pages draw a
// label through cellLinks. (A setPenNameMap() hook for it existed but was
// never called, so the field was already raw in practice.)

export const PRESSURE_RESPONSE_FIELD_GROUPS = ["Session", "Environment"];

export const PRESSURE_RESPONSE_FIELDS: FieldDisplayDef<PressureResponse>[] = [
  // Session
  { key: "EntityId", label: "Entity ID", getValue: (s) => s.EntityId, type: "string", group: "Session" },
  { key: "Brand", label: "Brand", getValue: (s) => s.Brand, type: "enum", enumValues: [...BRANDS], group: "Session" },
  { key: "PenEntityId", label: "Pen", getValue: (s) => s.PenEntityId, type: "string", group: "Session" },
  { key: "PenFamily", label: "Pen Family", getValue: (s) => s.PenFamily, type: "string", group: "Session" },
  { key: "InventoryId", label: "Inventory ID", getValue: (s) => s.InventoryId, type: "string", group: "Session" },
  { key: "Date", label: "Date", getValue: (s) => s.Date, type: "string", group: "Session" },
  { key: "User", label: "User", getValue: (s) => s.User, type: "string", group: "Session" },
  { key: "Notes", label: "Notes", getValue: (s) => s.Notes, type: "string", group: "Session" },
  {
    key: "DataPoints", label: "Data Points", group: "Session", computed: true, type: "number",
    getValue: (s) => String(s.Records.length),
  },
  {
    key: "MaxGf", label: "Max Force (gf)", group: "Session", computed: true, type: "number",
    getValue: (s) => {
      if (s.Records.length === 0) return "";
      return Math.max(...s.Records.map(r => r[0])).toFixed(1);
    },
  },
  {
    key: "Piaf", label: "Piaf (gf)", group: "Session", computed: true, type: "number",
    getValue: (s) => {
      const p = estimatePiaf(s.Records);
      return p === null || !Number.isFinite(p) ? "" : p.toFixed(1);
    },
  },
  {
    key: "Pmax", label: "Pmax (gf)", group: "Session", computed: true, type: "number",
    getValue: (s) => {
      const p = estimatePmax(s.Records);
      return p === null || !Number.isFinite(p) ? "" : p.toFixed(1);
    },
  },
  {
    key: "IsDefective", label: "Defective unit", group: "Session", computed: true, type: "enum",
    enumValues: ["YES", "NO"],
    getValue: (s) => (computedOf(s).IsDefective ? "YES" : "NO"),
  },
  // Environment
  { key: "TabletEntityId", label: "TabletEntityId", getValue: (s) => s.TabletEntityId, type: "string", group: "Environment" },
  { key: "Driver", label: "Driver", getValue: (s) => s.Driver, type: "string", group: "Environment" },
  { key: "OS", label: "OS", getValue: (s) => s.OS, type: "enum", enumValues: ["WINDOWS", "MACOS"], group: "Environment" },
];

export const PRESSURE_RESPONSE_DEFAULT_COLUMNS = [
  "Brand", "PenEntityId", "InventoryId", "Date", "DataPoints", "MaxGf", "TabletEntityId", "OS",
];

export const PRESSURE_RESPONSE_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["Brand", "PenEntityId", "InventoryId", "Date", "DataPoints", "MaxGf", "TabletEntityId", "OS"],
  },
  { kind: "sort", field: "Date", direction: "desc" },
];
