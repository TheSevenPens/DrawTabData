import type { FieldDef, Step } from "$lib/pipeline/types.js";

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

export const PEN_FIELD_GROUPS = ["Pen"];

export const PEN_FIELDS: FieldDef<Pen>[] = [
  { key: "EntityId", label: "Entity ID", getValue: (p) => p.EntityId, type: "string", group: "Pen" },
  { key: "Brand", label: "Brand", getValue: (p) => p.Brand, type: "enum", enumValues: ["WACOM"], group: "Pen" },
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
    fields: ["PenId", "PenName", "PenFamily", "PenYear"],
  },
  { kind: "sort", field: "PenId", direction: "asc" },
];
