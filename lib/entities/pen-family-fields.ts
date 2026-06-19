import type { PenFamily } from "../drawtab-loader.js";
import type { FieldDisplayDef, Step } from "@thesevenpens/queriton";
import { BRANDS } from "../loader-shared.js";

export type { PenFamily } from "../drawtab-loader.js";

// Pages can call setPenFamilyMemberCounts() with an EntityId -> count
// map so the PenCount column shows the number of pens that belong to
// each family. Defaults to empty (column shows 0) when not set.
let penFamilyMemberCounts: Record<string, number> = {};
export function setPenFamilyMemberCounts(map: Record<string, number>): void {
  penFamilyMemberCounts = map;
}

// Pages can call setPenFamilyInventoryCounts() with an EntityId -> count map
// so the InventoryCount column shows how many physical inventory pen units
// belong to each family. Defaults to empty (column shows 0) when not set.
let penFamilyInventoryCounts: Record<string, number> = {};
export function setPenFamilyInventoryCounts(map: Record<string, number>): void {
  penFamilyInventoryCounts = map;
}

export const PEN_FAMILY_FIELD_GROUPS = ["Pen Family"];

export const PEN_FAMILY_FIELDS: FieldDisplayDef<PenFamily>[] = [
  { key: "EntityId", label: "Entity ID", getValue: (f) => f.EntityId, type: "string", group: "Pen Family" },
  { key: "Brand", label: "Brand", getValue: (f) => f.Brand, type: "enum", enumValues: [...BRANDS], group: "Pen Family" },
  { key: "FamilyName", label: "Name", getValue: (f) => f.FamilyName, type: "string", group: "Pen Family" },
  { key: "PenCount", label: "Pens", computed: true, type: "number", group: "Pen Family",
    getValue: (f) => String(penFamilyMemberCounts[f.EntityId] ?? 0) },
  { key: "InventoryCount", label: "In Inventory", computed: true, type: "number", group: "Pen Family",
    getValue: (f) => String(penFamilyInventoryCounts[f.EntityId] ?? 0) },
];

export const PEN_FAMILY_DEFAULT_COLUMNS = [
  "Brand", "FamilyName", "PenCount", "InventoryCount",
];

export const PEN_FAMILY_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["Brand", "FamilyName", "PenCount", "InventoryCount"],
  },
  { kind: "sort", field: "FamilyName", direction: "asc" },
];
