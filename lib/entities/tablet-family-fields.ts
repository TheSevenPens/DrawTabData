import type { FieldDef, Step } from "../pipeline/types.js";

export interface TabletFamily {
  EntityId: string;
  Brand: string;
  FamilyId: string;
  FamilyName: string;
  _id: string;
  _CreateDate: string;
  _ModifiedDate: string;
}

export const TABLET_FAMILY_FIELD_GROUPS = ["Tablet Family"];

export const TABLET_FAMILY_FIELDS: FieldDef<TabletFamily>[] = [
  { key: "EntityId", label: "Entity ID", getValue: (f) => f.EntityId, type: "string", group: "Tablet Family" },
  { key: "Brand", label: "Brand", getValue: (f) => f.Brand, type: "enum", enumValues: ["WACOM"], group: "Tablet Family" },
  { key: "FamilyId", label: "Family ID", getValue: (f) => f.FamilyId, type: "string", group: "Tablet Family" },
  { key: "FamilyName", label: "Name", getValue: (f) => f.FamilyName, type: "string", group: "Tablet Family" },
];

export const TABLET_FAMILY_DEFAULT_COLUMNS = [
  "EntityId", "Brand", "FamilyId", "FamilyName",
];

export const TABLET_FAMILY_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["EntityId", "FamilyId", "FamilyName"],
  },
  { kind: "sort", field: "FamilyId", direction: "asc" },
];
