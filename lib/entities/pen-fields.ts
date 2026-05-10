import type { Pen } from "../drawtab-loader.js";
import { brandName } from "../drawtab-loader.js";
import type { FieldDef, Step } from "../pipeline/types.js";
import { BRANDS } from "../loader-shared.js";

export type { Pen } from "../drawtab-loader.js";

// Pages can call setPenFamilyNames() with an EntityId -> FamilyName map
// loaded from the pen-families data so that the "Family" column shows
// the human-readable name instead of the raw EntityId. Falls back to the
// raw EntityId when no map is set or the family is unknown.
let penFamilyNames: Record<string, string> = {};
export function setPenFamilyNames(map: Record<string, string>): void {
  penFamilyNames = map;
}
function resolvePenFamily(id: string): string {
  return penFamilyNames[id] ?? id;
}

/** True when the pen's PenId is already present in its PenName (as the
 * full string or as a whole token). Used to suppress a redundant
 * "(PenId)" suffix when formatting full names like
 * "Asus ProArt Pen MPA01 (MPA01)". */
export function penIdRedundantInName(pen: Pick<Pen, 'PenName' | 'PenId'>): boolean {
  const id = pen.PenId ?? '';
  const name = pen.PenName ?? '';
  if (!id || !name) return false;
  if (name === id) return true;
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:[^A-Za-z0-9]|$)`, 'i').test(name);
}

export const PEN_FIELD_GROUPS = ["Model", "Sensors", "Controls", "Physical"];

export const PEN_FIELDS: FieldDef<Pen>[] = [
  // Model
  { key: "EntityId", label: "Entity ID", getValue: (p) => p.EntityId, type: "string", group: "Model" },
  { key: "FullName", label: "Full Name", getValue: (p) => penIdRedundantInName(p) ? `${brandName(p.Brand)} ${p.PenName}` : `${brandName(p.Brand)} ${p.PenName} (${p.PenId})`, type: "string", group: "Model", computed: true },
  { key: "Brand", label: "Brand", getValue: (p) => brandName(p.Brand), type: "enum", enumValues: [...BRANDS], group: "Model" },
  { key: "PenId", label: "Pen ID", getValue: (p) => p.PenId, type: "string", group: "Model" },
  { key: "PenName", label: "Name", getValue: (p) => p.PenName, type: "string", group: "Model" },
  { key: "PenFamily", label: "Family", getValue: (p) => resolvePenFamily(p.PenFamily), type: "string", group: "Model" },
  { key: "PenTech", label: "Tech", getValue: (p) => p.PenTech ?? '', type: "string", group: "Model" },
  { key: "PenYear", label: "Year", getValue: (p) => p.PenYear, type: "number", group: "Model" },
  { key: "Notes", label: "Notes", getValue: (p) => p.Notes ?? '', type: "string", group: "Model" },
  { key: "Tags", label: "Tags", getValue: (p) => (p.Tags ?? []).join(', '), type: "string", group: "Model" },
  // Sensors
  { key: "PressureSensitive", label: "Pressure Sensitive", getValue: (p) => p.PressureSensitive ?? '', type: "string", group: "Sensors" },
  { key: "PressureLevels", label: "Pressure Levels", getValue: (p) => p.PressureLevels ?? '', type: "number", group: "Sensors" },
  { key: "Tilt", label: "Tilt", getValue: (p) => p.Tilt ?? '', type: "string", group: "Sensors" },
  { key: "BarrelRotation", label: "Barrel Rotation", getValue: (p) => p.BarrelRotation ?? '', type: "string", group: "Sensors" },
  { key: "Hover", label: "Hover", getValue: (p) => p.Hover ?? '', type: "string", group: "Sensors" },
  // Controls
  { key: "ButtonCount", label: "Button Count", getValue: (p) => p.ButtonCount ?? '', type: "number", group: "Controls" },
  { key: "Wheel", label: "Wheel", getValue: (p) => p.Wheel ?? '', type: "string", group: "Controls" },
  { key: "Eraser", label: "Eraser", getValue: (p) => p.Eraser ?? '', type: "string", group: "Controls" },
  // Physical
  { key: "Shape", label: "Shape", getValue: (p) => p.Shape ?? '', type: "string", group: "Physical" },
  { key: "Weight", label: "Weight (g)", getValue: (p) => p.Weight ?? '', type: "number", group: "Physical" },
  { key: "Length", label: "Length (mm)", getValue: (p) => p.Length ?? '', type: "number", group: "Physical" },
  { key: "Diameter", label: "Diameter (mm)", getValue: (p) => p.Diameter ?? '', type: "number", group: "Physical" },
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
