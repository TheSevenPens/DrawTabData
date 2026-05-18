import type { PressureResponse } from "../drawtab-loader.js";
import type { FieldDef, Step } from "queriton";
import { BRANDS } from "../loader-shared.js";
import { estimateP00, estimateP100 } from "../pressure/interpolate.js";
import type { DefectInfo } from "../pressure/defects.js";

export type { PressureResponse } from "../drawtab-loader.js";

// Pages can call setPenNameMap() with a PenEntityId -> "Brand PenName (PenId)"
// map (typically built via buildPenNameMap() from $lib/pen-helpers) so the
// "Pen" column shows a human-readable label instead of a raw EntityId.
// Falls back to the raw EntityId when no map is set or the EntityId is
// unknown.
let penNameMap: Map<string, string> = new Map();
export function setPenNameMap(map: Map<string, string>): void {
  penNameMap = map;
}

// Pages call setDefectsByInventoryId() with the lookup built by
// `buildInventoryDefects(inventoryPens)` so the `IsDefective` computed
// field reflects true status. Defaults to an empty map so unwired
// consumers see 'NO' for every row. Wire this at +layout.ts so every
// consumer (list pages, /pen-analysis, /api-explorer) inherits accurate
// values automatically.
let defectsByInventoryId: ReadonlyMap<string, DefectInfo> = new Map();
export function setDefectsByInventoryId(map: ReadonlyMap<string, DefectInfo>): void {
  defectsByInventoryId = map;
}

export const PRESSURE_RESPONSE_FIELD_GROUPS = ["Session", "Environment"];

export const PRESSURE_RESPONSE_FIELDS: FieldDef<PressureResponse>[] = [
  // Session
  { key: "Brand", label: "Brand", getValue: (s) => s.Brand, type: "enum", enumValues: [...BRANDS], group: "Session" },
  { key: "PenEntityId", label: "Pen", getValue: (s) => penNameMap.get(s.PenEntityId) ?? s.PenEntityId, type: "string", group: "Session" },
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
    key: "IAF", label: "IAF (P00, gf)", group: "Session", computed: true, type: "number",
    getValue: (s) => {
      const p = estimateP00(s.Records);
      return p === null || !Number.isFinite(p) ? "" : p.toFixed(1);
    },
  },
  {
    key: "MaxPressure", label: "Max Pressure (P100, gf)", group: "Session", computed: true, type: "number",
    getValue: (s) => {
      const p = estimateP100(s.Records);
      return p === null || !Number.isFinite(p) ? "" : p.toFixed(1);
    },
  },
  {
    key: "IsDefective", label: "Defective unit", group: "Session", computed: true, type: "enum",
    enumValues: ["YES", "NO"],
    getValue: (s) => defectsByInventoryId.has(s.InventoryId) ? "YES" : "NO",
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
