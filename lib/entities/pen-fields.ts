import type { Pen } from "../drawtab-loader.js";
import { brandName } from "../drawtab-loader.js";
import type { FieldDisplayDef, Step } from "@thesevenpens/queriton";
import { BRANDS } from "../loader-shared.js";
import { brandPrefixesName, tokenAppearsInName } from "./name-formatting.js";

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

/** Public lookup for the human-readable pen-family name. Returns the
 * EntityId itself if no map has been wired or the family is unknown,
 * matching `resolvePenFamily`'s fallback. */
export function getPenFamilyName(entityId: string): string {
  return penFamilyNames[entityId] ?? entityId;
}

// Pages (typically +layout.ts) call setPressureSessionCountByPenEntityId()
// with a PenEntityId -> count map so the `PressureSessionCount` computed
// FieldDef reflects how many pressure-response sessions exist for each
// pen model. Defaults to an empty map so unwired consumers see 0 for
// every row. Wire this at +layout.ts so every list page inherits accurate
// values without per-page plumbing.
let pressureSessionCountByPenEntityId: ReadonlyMap<string, number> = new Map();
export function setPressureSessionCountByPenEntityId(
  map: ReadonlyMap<string, number>,
): void {
  pressureSessionCountByPenEntityId = map;
}

// Same pattern for `UnitsInInventory`: PenEntityId -> count of physical
// units we own of that model. Populated from InventoryPens in +layout.ts.
let inventoryUnitCountByPenEntityId: ReadonlyMap<string, number> = new Map();
export function setInventoryUnitCountByPenEntityId(
  map: ReadonlyMap<string, number>,
): void {
  inventoryUnitCountByPenEntityId = map;
}

/** True when the pen's PenId is already present in its PenName (as the
 * full string or as a whole token). Used to suppress a redundant
 * "(PenId)" suffix when formatting full names like
 * "Asus ProArt Pen MPA01 (MPA01)". */
export function penIdRedundantInName(pen: Pick<Pen, 'PenName' | 'PenId'>): boolean {
  return tokenAppearsInName(pen.PenName ?? '', pen.PenId ?? '');
}

/** True when the pen's PenName already starts with the brand display
 * name (case-insensitive). Used to suppress a redundant brand prefix
 * when formatting full names like "Wacom Wacom One Pen" or
 * "Apple Apple Pencil Pro". */
export function penBrandRedundantInName(pen: Pick<Pen, 'PenName' | 'Brand'>): boolean {
  return brandPrefixesName(brandName(pen.Brand) ?? '', pen.PenName ?? '');
}

/** "Brand Name (Id)" with the brand prefix and/or "(Id)" suffix dropped
 * when redundant. */
export function penFullName(pen: Pen): string {
  const brand = brandName(pen.Brand);
  const namePart = penBrandRedundantInName(pen)
    ? pen.PenName
    : `${brand} ${pen.PenName}`;
  return penIdRedundantInName(pen) ? namePart : `${namePart} (${pen.PenId})`;
}

/** "Brand Name" with the brand prefix dropped when redundant. */
export function penBrandAndName(pen: Pen): string {
  return penBrandRedundantInName(pen)
    ? pen.PenName
    : `${brandName(pen.Brand)} ${pen.PenName}`;
}

/** "Name (Id)" with the "(Id)" suffix dropped when redundant. No brand. */
export function penNameAndId(pen: Pick<Pen, 'PenName' | 'PenId'>): string {
  return penIdRedundantInName(pen) ? pen.PenName : `${pen.PenName} (${pen.PenId})`;
}

export const PEN_FIELD_GROUPS = ["Model", "Sensors", "Controls", "Physical"];

export const PEN_FIELDS: FieldDisplayDef<Pen>[] = [
  // Model
  { key: "EntityId", label: "Entity ID", getValue: (p) => p.EntityId, type: "string", group: "Model" },
  { key: "FullName", label: "Full Name", getValue: (p) => penFullName(p), type: "string", group: "Model", computed: true },
  { key: "Brand", label: "Brand", getValue: (p) => brandName(p.Brand), type: "enum", enumValues: [...BRANDS], group: "Model" },
  { key: "PenId", label: "Pen ID", getValue: (p) => p.PenId, type: "string", group: "Model" },
  { key: "PenName", label: "Name", getValue: (p) => p.PenName, type: "string", group: "Model" },
  { key: "PenFamily", label: "Family", getValue: (p) => resolvePenFamily(p.PenFamily), type: "string", group: "Model" },
  { key: "PenTech", label: "Tech", getValue: (p) => p.PenTech ?? '', type: "enum", enumValues: ["PASSIVE_EMR", "ACTIVE_EMR"], group: "Model" },
  { key: "PenYear", label: "Year", getValue: (p) => p.PenYear, type: "number", group: "Model" },
  { key: "Notes", label: "Notes", getValue: (p) => p.Notes ?? '', type: "string", group: "Model" },
  { key: "Tags", label: "Tags", getValue: (p) => (p.Tags ?? []).join(', '), type: "string", group: "Model" },
  {
    key: "UnitsInInventory", label: "Units in Inventory",
    computed: true, type: "number", group: "Model",
    getValue: (p) => String(inventoryUnitCountByPenEntityId.get(p.EntityId) ?? 0),
  },
  // Sensors
  { key: "PressureSensitive", label: "Pressure Sensitive", getValue: (p) => p.PressureSensitive ?? '', type: "string", group: "Sensors" },
  { key: "PressureLevels", label: "Pressure Levels", getValue: (p) => p.PressureLevels ?? '', type: "number", group: "Sensors" },
  { key: "Tilt", label: "Tilt", getValue: (p) => p.Tilt ?? '', type: "string", group: "Sensors" },
  { key: "BarrelRotation", label: "Barrel Rotation", getValue: (p) => p.BarrelRotation ?? '', type: "string", group: "Sensors" },
  { key: "Hover", label: "Hover", getValue: (p) => p.Hover ?? '', type: "string", group: "Sensors" },
  { key: "IAF", label: "IAF (gf)", getValue: (p) => p.IAF ?? '', type: "number", group: "Sensors", unit: "gf" },
  {
    key: "PressureSessionCount", label: "Pressure Sessions",
    computed: true, type: "number", group: "Sensors",
    getValue: (p) => String(pressureSessionCountByPenEntityId.get(p.EntityId) ?? 0),
  },
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
  "PressureLevels", "ButtonCount", "Eraser", "UnitsInInventory",
];

export const PEN_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["Brand", "PenName", "PenId", "PenFamily", "PenYear", "PenTech", "PressureLevels", "ButtonCount", "Eraser", "UnitsInInventory"],
  },
  { kind: "sort", field: "PenId", direction: "asc" },
];
