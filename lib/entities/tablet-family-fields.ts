import type { TabletFamily } from "../drawtab-loader.js";
import type { FieldDef, Step } from "../pipeline/types.js";

export type { TabletFamily } from "../drawtab-loader.js";

export const TABLET_FAMILY_FIELD_GROUPS = ["Tablet Family"];

export const TABLET_FAMILY_FIELDS: FieldDef<any>[] = [
  { key: "EntityId", label: "Entity ID", getValue: (f) => f.EntityId, type: "string", group: "Tablet Family" },
  { key: "Brand", label: "Brand", getValue: (f) => f.Brand, type: "enum", enumValues: ["WACOM"], group: "Tablet Family" },
  { key: "FamilyId", label: "Family ID", getValue: (f) => f.FamilyId, type: "string", group: "Tablet Family" },
  { key: "FamilyName", label: "Name", getValue: (f) => f.FamilyName, type: "string", group: "Tablet Family" },
  { key: "ModelPattern", label: "Model Pattern", getValue: (f) => f.ModelPattern ?? '', type: "string", group: "Tablet Family" },
  { key: "TabletCount", label: "Tablets", getValue: (f) => f._tabletCount ?? 0, type: "number", group: "Tablet Family" },
  { key: "EarliestYear", label: "Year", getValue: (f) => f._earliestYear ?? '', type: "string", group: "Tablet Family" },
];

export const TABLET_FAMILY_DEFAULT_COLUMNS = [
  "Brand", "FamilyName", "ModelPattern", "TabletCount", "EarliestYear",
];

export const TABLET_FAMILY_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["FamilyName", "ModelPattern", "TabletCount", "EarliestYear"],
  },
  { kind: "sort", field: "FamilyName", direction: "asc" },
];
