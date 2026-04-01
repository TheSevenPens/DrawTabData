import type { FieldDef, Step } from "../pipeline/types.js";

export interface InventoryTablet {
  TabletEntityId: string;
  Brand: string;
  ModelId: string;
  ModelName: string;
  TabletType: string;
  InventoryId: string;
  Vendor: string;
  OrderDate: string;
  Notes: string;
  Tags: string[];
  _id: string;
  _CreateDate: string;
  _ModifiedDate: string;
}

export const INVENTORY_TABLET_FIELD_GROUPS = ["Tablet", "Acquisition"];

export const INVENTORY_TABLET_FIELDS: FieldDef<InventoryTablet>[] = [
  { key: "InventoryId", label: "Inventory ID", getValue: (t) => t.InventoryId, type: "string", group: "Tablet" },
  { key: "TabletEntityId", label: "Tablet", getValue: (t) => t.TabletEntityId, type: "string", group: "Tablet" },
  { key: "Brand", label: "Brand", getValue: (t) => t.Brand, type: "string", group: "Tablet" },
  { key: "ModelId", label: "Model ID", getValue: (t) => t.ModelId, type: "string", group: "Tablet" },
  { key: "ModelName", label: "Name", getValue: (t) => t.ModelName, type: "string", group: "Tablet" },
  { key: "TabletType", label: "Type", getValue: (t) => t.TabletType, type: "enum", enumValues: ["PENTABLET", "PENDISPLAY", "STANDALONE"], group: "Tablet" },
  { key: "Notes", label: "Notes", getValue: (t) => t.Notes, type: "string", group: "Tablet" },
  // Acquisition
  { key: "Vendor", label: "Vendor", getValue: (t) => t.Vendor, type: "string", group: "Acquisition" },
  { key: "OrderDate", label: "Order Date", getValue: (t) => t.OrderDate, type: "string", group: "Acquisition" },
];

export const INVENTORY_TABLET_DEFAULT_COLUMNS = [
  "InventoryId", "TabletEntityId", "Brand", "ModelName", "TabletType", "Vendor", "OrderDate",
];

export const INVENTORY_TABLET_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["InventoryId", "TabletEntityId", "Brand", "ModelName", "TabletType", "Vendor", "OrderDate"],
  },
  { kind: "sort", field: "InventoryId", direction: "asc" },
];
