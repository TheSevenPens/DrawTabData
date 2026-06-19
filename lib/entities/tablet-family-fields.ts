import type { TabletFamily } from "../drawtab-loader.js";
import type { FieldDisplayDef, Step } from "@thesevenpens/queriton";
import { BRANDS } from "../loader-shared.js";

export type { TabletFamily } from "../drawtab-loader.js";

export const TABLET_FAMILY_FIELD_GROUPS = ["Tablet Family"];

export const TABLET_FAMILY_FIELDS: FieldDisplayDef<any>[] = [
  { key: "EntityId", label: "Entity ID", getValue: (f) => f.EntityId, type: "string", group: "Tablet Family" },
  { key: "Brand", label: "Brand", getValue: (f) => f.Brand, type: "enum", enumValues: [...BRANDS], group: "Tablet Family" },
  { key: "FamilyName", label: "Name", getValue: (f) => f.FamilyName, type: "string", group: "Tablet Family" },
  { key: "ModelPattern", label: "Model Pattern", getValue: (f) => f.ModelPattern ?? '', type: "string", group: "Tablet Family" },
  { key: "TabletCount", label: "Tablets", getValue: (f) => f._tabletCount ?? 0, type: "number", group: "Tablet Family" },
  // Number of physical inventory tablet units that belong to this family
  // (set by the route loader from InventoryTablets × Tablets.Model.Family).
  { key: "InventoryCount", label: "In Inventory", getValue: (f) => f._inventoryCount ?? 0, type: "number", group: "Tablet Family" },
  { key: "EarliestYear", label: "Year", getValue: (f) => f._earliestYear ?? '', type: "string", group: "Tablet Family" },
];

export const TABLET_FAMILY_DEFAULT_COLUMNS = [
  "Brand", "FamilyName", "ModelPattern", "TabletCount", "InventoryCount", "EarliestYear",
];

export const TABLET_FAMILY_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["Brand", "FamilyName", "ModelPattern", "TabletCount", "InventoryCount", "EarliestYear"],
  },
  { kind: "sort", field: "FamilyName", direction: "asc" },
];
