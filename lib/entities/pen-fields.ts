import type { Pen } from "../drawtab-loader.js";
import type { FieldDef, Step } from "../pipeline/types.js";

export type { Pen } from "../drawtab-loader.js";

export const PEN_FIELD_GROUPS = ["Pen"];

export const PEN_FIELDS: FieldDef<Pen>[] = [
  { key: "EntityId", label: "Entity ID", getValue: (p) => p.EntityId, type: "string", group: "Pen" },
  { key: "Brand", label: "Brand", getValue: (p) => p.Brand, type: "enum", enumValues: ["HUION", "WACOM", "XENCELABS", "XPPEN"], group: "Pen" },
  { key: "PenId", label: "Pen ID", getValue: (p) => p.PenId, type: "string", group: "Pen" },
  { key: "PenName", label: "Name", getValue: (p) => p.PenName, type: "string", group: "Pen" },
  { key: "PenFamily", label: "Family", getValue: (p) => p.PenFamily, type: "string", group: "Pen" },
  { key: "PenYear", label: "Year", getValue: (p) => p.PenYear, type: "number", group: "Pen" },
];

export const PEN_DEFAULT_COLUMNS = [
  "EntityId", "Brand", "PenId", "PenName", "PenFamily", "PenYear",
];

export const PEN_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["EntityId", "PenId", "PenName", "PenFamily", "PenYear"],
  },
  { kind: "sort", field: "PenId", direction: "asc" },
];
