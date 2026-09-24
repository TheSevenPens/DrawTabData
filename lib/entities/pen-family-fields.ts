import type { PenFamily } from "../drawtab-loader.js";
import type { FieldDisplayDef, Step } from "@thesevenpens/queriton";
import { BRANDS } from "../loader-shared.js";
import { computedOf } from "../computed.js";

export type { PenFamily } from "../drawtab-loader.js";

// PenCount, InventoryCount and ModelIds come from the Pens and InventoryPens
// collections; the DrawTabDataSet computes them while loading PenFamilies
// (see ../computed.ts, #346). They used to be set only by the /pen-families
// page, so a pen-family detail page reached any other way showed 0.

export const PEN_FAMILY_FIELD_GROUPS = ["Pen Family"];

export const PEN_FAMILY_FIELDS: FieldDisplayDef<PenFamily>[] = [
  { key: "EntityId", label: "Entity ID", getValue: (f) => f.EntityId, type: "string", group: "Pen Family" },
  { key: "Brand", label: "Brand", getValue: (f) => f.Brand, type: "enum", enumValues: [...BRANDS], group: "Pen Family" },
  { key: "FamilyName", label: "Name", getValue: (f) => f.FamilyName, type: "string", group: "Pen Family" },
  { key: "PenCount", label: "Pens", computed: true, type: "number", group: "Pen Family",
    getValue: (f) => String(computedOf(f).PenCount ?? 0) },
  { key: "InventoryCount", label: "In Inventory", computed: true, type: "number", group: "Pen Family",
    getValue: (f) => String(computedOf(f).InventoryCount ?? 0) },
  { key: "ModelIds", label: "Model IDs", computed: true, type: "string", group: "Pen Family",
    getValue: (f) => computedOf(f).ModelIds ?? "" },
];

export const PEN_FAMILY_DEFAULT_COLUMNS = [
  "Brand", "FamilyName", "PenCount", "InventoryCount", "ModelIds",
];

export const PEN_FAMILY_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["Brand", "FamilyName", "PenCount", "InventoryCount", "ModelIds"],
  },
  { kind: "sort", field: "FamilyName", direction: "asc" },
];
