import type { FieldDef, Step } from "../pipeline/types.js";

export interface InventoryPen {
  PenEntityId: string;
  Brand: string;
  PenTech: string;
  PenTechSubtype: string;
  InventoryId: string;
  WithTabletEntityId: string;
  Notes: string;
  Tags: string[];
  _id: string;
  _CreateDate: string;
  _ModifiedDate: string;
}

export const INVENTORY_PEN_FIELD_GROUPS = ["Pen", "Acquisition"];

export const INVENTORY_PEN_FIELDS: FieldDef<InventoryPen>[] = [
  { key: "InventoryId", label: "Inventory ID", getValue: (p) => p.InventoryId, type: "string", group: "Pen" },
  { key: "PenEntityId", label: "Pen", getValue: (p) => p.PenEntityId, type: "string", group: "Pen" },
  { key: "Brand", label: "Brand", getValue: (p) => p.Brand, type: "string", group: "Pen" },
  { key: "PenTech", label: "Tech", getValue: (p) => p.PenTech, type: "enum", enumValues: ["EMR", "APPLE"], group: "Pen" },
  { key: "PenTechSubtype", label: "Tech Subtype", getValue: (p) => p.PenTechSubtype, type: "string", group: "Pen" },
  { key: "Notes", label: "Notes", getValue: (p) => p.Notes, type: "string", group: "Pen" },
  // Acquisition
  { key: "WithTabletEntityId", label: "Came With Tablet", getValue: (p) => p.WithTabletEntityId, type: "string", group: "Acquisition" },
];

export const INVENTORY_PEN_DEFAULT_COLUMNS = [
  "InventoryId", "PenEntityId", "Brand", "PenTech", "WithTabletEntityId",
];

export const INVENTORY_PEN_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["InventoryId", "PenEntityId", "Brand", "PenTech", "PenTechSubtype", "WithTabletEntityId"],
  },
  { kind: "sort", field: "InventoryId", direction: "asc" },
];
