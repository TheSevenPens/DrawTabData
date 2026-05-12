import type { PenCompat } from "../drawtab-loader.js";
import type { FieldDef, Step } from "queriton";
import { BRANDS } from "../loader-shared.js";

export type { PenCompat } from "../drawtab-loader.js";

export interface EnrichedPenCompat extends PenCompat {
  TabletFullName: string;
  PenFullName: string;
}

export const PEN_COMPAT_FIELD_GROUPS = ["Compatibility"];

export const PEN_COMPAT_FIELDS: FieldDef<EnrichedPenCompat>[] = [
  { key: "Brand", label: "Brand", getValue: (c) => c.Brand, type: "enum", enumValues: [...BRANDS], group: "Compatibility" },
  { key: "TabletId", label: "Tablet ID", getValue: (c) => c.TabletId, type: "string", group: "Compatibility" },
  { key: "TabletFullName", label: "Tablet", getValue: (c) => c.TabletFullName, type: "string", group: "Compatibility" },
  { key: "PenId", label: "Pen ID", getValue: (c) => c.PenId, type: "string", group: "Compatibility" },
  { key: "PenFullName", label: "Pen", getValue: (c) => c.PenFullName, type: "string", group: "Compatibility" },
];

export const PEN_COMPAT_DEFAULT_COLUMNS = [
  "Brand", "TabletFullName", "PenFullName",
];

export const PEN_COMPAT_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["TabletFullName", "PenFullName"],
  },
  { kind: "sort", field: "TabletFullName", direction: "asc" },
];
