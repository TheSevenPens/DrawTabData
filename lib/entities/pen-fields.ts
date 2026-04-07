import type { Pen } from "../drawtab-loader.js";
import { brandName } from "../drawtab-loader.js";
import type { FieldDef, Step } from "../pipeline/types.js";

export type { Pen } from "../drawtab-loader.js";

// Pages can call setPenFamilyNames() with a FamilyId -> FamilyName map
// loaded from the pen-families data so that the "Family" column shows
// the human-readable name instead of the raw id. Falls back to the raw
// id when no map is set or the family is unknown.
let penFamilyNames: Record<string, string> = {};
export function setPenFamilyNames(map: Record<string, string>): void {
  penFamilyNames = map;
}
function resolvePenFamily(id: string): string {
  return penFamilyNames[id] ?? id;
}

export const PEN_FIELD_GROUPS = ["Pen"];

export const PEN_FIELDS: FieldDef<Pen>[] = [
  { key: "EntityId", label: "Entity ID", getValue: (p) => p.EntityId, type: "string", group: "Pen" },
  { key: "FullName", label: "Full Name", getValue: (p) => p.PenName === p.PenId ? `${brandName(p.Brand)} ${p.PenId}` : `${brandName(p.Brand)} ${p.PenName} (${p.PenId})`, type: "string", group: "Pen", computed: true },
  { key: "Brand", label: "Brand", getValue: (p) => p.Brand, type: "enum", enumValues: ["GAOMON", "HUION", "SAMSUNG", "UGEE", "WACOM", "XENCELABS", "XPPEN"], group: "Pen" },
  { key: "PenId", label: "Pen ID", getValue: (p) => p.PenId, type: "string", group: "Pen" },
  { key: "PenName", label: "Name", getValue: (p) => p.PenName, type: "string", group: "Pen" },
  { key: "PenFamily", label: "Family", getValue: (p) => resolvePenFamily(p.PenFamily), type: "string", group: "Pen" },
  { key: "PenYear", label: "Year", getValue: (p) => p.PenYear, type: "number", group: "Pen" },
];

export const PEN_DEFAULT_COLUMNS = [
  "EntityId", "Brand", "PenId", "PenName", "PenFamily", "PenYear",
];

export const PEN_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["EntityId", "FullName", "PenFamily", "PenYear"],
  },
  { kind: "sort", field: "PenId", direction: "asc" },
];
