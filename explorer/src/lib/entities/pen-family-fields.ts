import type { FieldDef, Step } from "$lib/pipeline/types.js";

export interface PenFamily {
  EntityId: string;
  Brand: string;
  FamilyId: string;
  FamilyName: string;
  _id: string;
  _CreateDate: string;
  _ModifiedDate: string;
}

export const PEN_FAMILY_FIELD_GROUPS = ["Pen Family"];

export const PEN_FAMILY_FIELDS: FieldDef<PenFamily>[] = [
  { key: "EntityId", label: "Entity ID", getValue: (f) => f.EntityId, type: "string", group: "Pen Family" },
  { key: "Brand", label: "Brand", getValue: (f) => f.Brand, type: "enum", enumValues: ["WACOM"], group: "Pen Family" },
  { key: "FamilyId", label: "Family ID", getValue: (f) => f.FamilyId, type: "string", group: "Pen Family" },
  { key: "FamilyName", label: "Name", getValue: (f) => f.FamilyName, type: "string", group: "Pen Family" },
];

export const PEN_FAMILY_DEFAULT_COLUMNS = [
  "EntityId", "Brand", "FamilyId", "FamilyName",
];

export const PEN_FAMILY_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["FamilyId", "FamilyName"],
  },
  { kind: "sort", field: "FamilyId", direction: "asc" },
];
