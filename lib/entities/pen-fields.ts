import type { Pen } from "../drawtab-loader.js";
import { brandName } from "../drawtab-loader.js";
import type { FieldDisplayDef, Step } from "@thesevenpens/queriton";
import { BRANDS } from "../loader-shared.js";
import { brandPrefixesName, tokenAppearsInName } from "./name-formatting.js";
import { computedOf } from "../computed.js";

export type { Pen } from "../drawtab-loader.js";

// Family name, inventory count and session count come from other
// collections; the DrawTabDataSet computes them while loading Pens and
// attaches them to each row (see ../computed.ts, #346). A pen that didn't
// come from a dataset shows the raw family EntityId and 0 counts.

/** Human-readable family name for a pen, falling back to the EntityId. */
export function penFamilyName(pen: Pick<Pen, "PenFamily">): string {
  return computedOf(pen).FamilyName ?? pen.PenFamily ?? "";
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
  // getValue is the stored code ("XPPEN"), getDisplayValue the label ("XP-Pen") —
  // the same split as the tablet Brand field. It used to return the label,
  // so a filter on the advertised enum value (Brand == WACOM) matched nothing.
  { key: "Brand", label: "Brand", getValue: (p) => p.Brand, getDisplayValue: (p) => brandName(p.Brand), getHref: (p) => `/brands/${p.Brand}`, type: "enum", enumValues: [...BRANDS], group: "Model" },
  { key: "PenId", label: "Pen ID", getValue: (p) => p.PenId, type: "string", group: "Model" },
  { key: "PenName", label: "Name", getValue: (p) => p.PenName, type: "string", group: "Model" },
  // getValue is the family EntityId; only the display uses the name. When
  // getValue returned the name, a query meant different things depending on
  // whether the name lookup had been set up (#332).
  { key: "PenFamily", label: "Family", getValue: (p) => p.PenFamily ?? "", getDisplayValue: (p) => penFamilyName(p), type: "string", group: "Model" },
  { key: "PenTech", label: "Tech", getValue: (p) => p.PenTech ?? '', type: "enum", enumValues: ["PASSIVE_EMR", "ACTIVE_EMR"], group: "Model" },
  { key: "ReleaseYear", label: "Year", getValue: (p) => p.ReleaseYear, type: "number", group: "Model" },
  // Free-form prose (often markdown) — see the ModelNotes note in tablet-fields.
  { key: "Notes", label: "Notes", getValue: (p) => p.Notes ?? '', type: "string", group: "Model", multiline: true },
  { key: "Tags", label: "Tags", getValue: (p) => (p.Tags ?? []).join(', '), type: "string", group: "Model" },
  { key: "LinkCount", label: "Links", getValue: (p) => { const n = (p.Links ?? []).length; return n ? String(n) : ''; }, type: "number", group: "Model" },
  {
    key: "UnitsInInventory", label: "Units in Inventory",
    computed: true, type: "number", group: "Model",
    getValue: (p) => String(computedOf(p).UnitsInInventory ?? 0),
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
    getValue: (p) => String(computedOf(p).PressureSessionCount ?? 0),
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
  "Brand", "PenId", "PenName", "PenFamily", "PenTech", "ReleaseYear",
  "PressureLevels", "ButtonCount", "Eraser", "UnitsInInventory",
];

export const PEN_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["Brand", "PenName", "PenId", "PenFamily", "ReleaseYear", "PenTech", "PressureLevels", "ButtonCount", "Eraser", "UnitsInInventory"],
  },
  { kind: "sort", field: "PenId", direction: "asc" },
];
