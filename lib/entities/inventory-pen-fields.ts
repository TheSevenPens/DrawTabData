import type { FieldDef, Step } from "../pipeline/types.js";

export interface InventoryPen {
  PenEntityId: string;
  Brand: string;
  PenTech: string;
  PenTechSubtype: string;
  InventoryId: string;
  WithTabletInventoryId: string;
  Notes: string;
  Tags: string[];
  Defects?: Array<{ Kind: string; Notes: string }>;
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
  { key: "IsDefective", label: "Defective", getValue: (p) => (p.Defects?.length ?? 0) > 0 ? "YES" : "NO", type: "enum", enumValues: ["YES", "NO"], group: "Pen" },
  { key: "DefectKinds", label: "Defect Kinds", getValue: (p) => (p.Defects ?? []).map(d => d.Kind).join(", "), type: "string", group: "Pen" },
  // Acquisition
  { key: "WithTabletInventoryId", label: "Came With Tablet", getValue: (p) => p.WithTabletInventoryId, type: "string", group: "Acquisition" },
];

export const INVENTORY_PEN_DEFAULT_COLUMNS = [
  "InventoryId", "PenEntityId", "Brand", "PenTech", "WithTabletInventoryId",
];

export const INVENTORY_PEN_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["InventoryId", "PenEntityId", "Brand", "PenTech", "PenTechSubtype", "WithTabletInventoryId"],
  },
  // Multi-key sort. JS Array.sort is stable, so insert in reverse order
  // of significance: least → most significant. Final ordering: Brand,
  // then Pen, then InventoryId.
  { kind: "sort", field: "InventoryId", direction: "asc" },
  { kind: "sort", field: "PenEntityId", direction: "asc" },
  { kind: "sort", field: "Brand", direction: "asc" },
];
