import type { PenCompat } from "../drawtab-loader.js";
import type { FieldDef, Step } from "../pipeline/types.js";

export type { PenCompat } from "../drawtab-loader.js";

export const PEN_COMPAT_FIELD_GROUPS = ["Compatibility"];

export const PEN_COMPAT_FIELDS: FieldDef<PenCompat>[] = [
  { key: "Brand", label: "Brand", getValue: (c) => c.Brand, type: "enum", enumValues: ["HUION", "WACOM", "XENCELABS", "XPPEN"], group: "Compatibility" },
  { key: "TabletId", label: "Tablet", getValue: (c) => c.TabletId, type: "string", group: "Compatibility" },
  { key: "PenId", label: "Pen", getValue: (c) => c.PenId, type: "string", group: "Compatibility" },
];

export const PEN_COMPAT_DEFAULT_COLUMNS = [
  "Brand", "TabletId", "PenId",
];

export const PEN_COMPAT_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["TabletId", "PenId"],
  },
  { kind: "sort", field: "TabletId", direction: "asc" },
];
