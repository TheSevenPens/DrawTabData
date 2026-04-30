import type { PressureResponse } from "../drawtab-loader.js";
import type { FieldDef, Step } from "../pipeline/types.js";
import { BRANDS } from "../loader-shared.js";

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
