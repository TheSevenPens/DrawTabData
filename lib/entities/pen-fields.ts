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

export const PEN_FIELD_GROUPS = ["Pen", "Physical"];

export const PEN_FIELDS: FieldDef<Pen>[] = [
  { key: "EntityId", label: "Entity ID", getValue: (p) => p.EntityId, type: "string", group: "Pen" },
  { key: "FullName", label: "Full Name", getValue: (p) => p.PenName === p.PenId ? `${brandName(p.Brand)} ${p.PenId}` : `${brandName(p.Brand)} ${p.PenName} (${p.PenId})`, type: "string", group: "Pen", computed: true },
  { key: "Brand", label: "Brand", getValue: (p) => brandName(p.Brand), type: "enum", enumValues: ["GAOMON", "HUION", "SAMSUNG", "UGEE", "WACOM", "XENCELABS", "XPPEN"], group: "Pen" },
  { key: "PenId", label: "Pen ID", getValue: (p) => p.PenId, type: "string", group: "Pen" },
  { key: "PenName", label: "Name", getValue: (p) => p.PenName, type: "string", group: "Pen" },
  { key: "PenFamily", label: "Family", getValue: (p) => resolvePenFamily(p.PenFamily), type: "string", group: "Pen" },
  { key: "PenTech", label: "Tech", getValue: (p) => p.PenTech ?? '', type: "string", group: "Pen" },
  { key: "PenYear", label: "Year", getValue: (p) => p.PenYear, type: "number", group: "Pen" },
  { key: "ButtonCount", label: "Button Count", getValue: (p) => p.ButtonCount ?? '', type: "number", group: "Pen" },
  { key: "PressureSensitive", label: "Pressure Sensitive", getValue: (p) => p.PressureSensitive ?? '', type: "string", group: "Pen" },
  { key: "PressureLevels", label: "Pressure Levels", getValue: (p) => p.PressureLevels ?? '', type: "number", group: "Pen" },
  { key: "Tilt", label: "Tilt", getValue: (p) => p.Tilt ?? '', type: "string", group: "Pen" },
  { key: "Roller", label: "Roller", getValue: (p) => p.Roller ?? '', type: "string", group: "Pen" },
  { key: "Eraser", label: "Eraser", getValue: (p) => p.Eraser ?? '', type: "string", group: "Pen" },
  { key: "BarrelRotation", label: "Barrel Rotation", getValue: (p) => p.BarrelRotation ?? '', type: "string", group: "Pen" },
  { key: "Shape", label: "Shape", getValue: (p) => p.Shape ?? '', type: "string", group: "Pen" },
  { key: "Weight", label: "Weight (g)", getValue: (p) => p.Weight ?? '', type: "number", group: "Physical" },
];

export const PEN_DEFAULT_COLUMNS = [
  "Brand", "PenId", "PenName", "PenFamily", "PenTech", "PenYear",
];

export const PEN_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["FullName", "PenFamily", "PenYear"],
  },
  { kind: "sort", field: "PenId", direction: "asc" },
];
