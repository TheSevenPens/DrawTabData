import type { PressureRange } from "../drawtab-loader.js";
import type { FieldDisplayDef, Step } from "@thesevenpens/queriton";
import { BRANDS } from "../loader-shared.js";

export type { PressureRange } from "../drawtab-loader.js";

// Pages can call setPenNameMap() with a PenEntityId -> "Brand PenName (PenId)"
// map (typically built via buildPenNameMap() from $lib/pen-helpers) so the
// "Pen" column shows a human-readable label instead of a raw EntityId.
// Mirrors the pressure-response fields file. Falls back to the raw EntityId.
let penNameMap: Map<string, string> = new Map();
export function setPenNameMap(map: Map<string, string>): void {
  penNameMap = map;
}

export const PRESSURE_RANGE_FIELD_GROUPS = ["Measurement", "Environment"];

export const PRESSURE_RANGE_FIELDS: FieldDisplayDef<PressureRange>[] = [
  // Measurement
  { key: "Brand", label: "Brand", getValue: (m) => m.Brand, type: "enum", enumValues: [...BRANDS], group: "Measurement" },
  { key: "PenInventoryId", label: "Pen Inventory ID", getValue: (m) => m.PenInventoryId, type: "string", group: "Measurement" },
  { key: "PenEntityId", label: "Pen", getValue: (m) => penNameMap.get(m.PenEntityId) ?? m.PenEntityId, type: "string", group: "Measurement" },
  { key: "Metric", label: "Metric", getValue: (m) => m.Metric, type: "enum", enumValues: ["IAF", "MAX"], group: "Measurement" },
  { key: "Value", label: "Value (gf)", getValue: (m) => m.Value ?? "", type: "number", unit: "gf", group: "Measurement" },
  { key: "Date", label: "Date", getValue: (m) => m.Date, type: "string", group: "Measurement" },
  { key: "Method", label: "Method", getValue: (m) => m.Method, type: "string", group: "Measurement" },
  // Environment
  { key: "TabletEntityId", label: "TabletEntityId", getValue: (m) => m.TabletEntityId, type: "string", group: "Environment" },
  { key: "Driver", label: "Driver", getValue: (m) => m.Driver, type: "string", group: "Environment" },
  { key: "OS", label: "OS", getValue: (m) => m.OS, type: "enum", enumValues: ["WINDOWS", "MACOS"], group: "Environment" },
];

export const PRESSURE_RANGE_DEFAULT_COLUMNS = [
  "Brand", "PenInventoryId", "PenEntityId", "Metric", "Value", "Date", "TabletEntityId", "OS",
];

export const PRESSURE_RANGE_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["Brand", "PenInventoryId", "PenEntityId", "Metric", "Value", "Date", "TabletEntityId", "OS"],
  },
  { kind: "sort", field: "Date", direction: "desc" },
];
