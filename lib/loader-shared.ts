// Shared metadata and helpers used by both URL and disk loaders.

import type { PenCompat } from "./drawtab-loader.js";
import type { PenCompatGrouped } from "./schemas.js";

export const BRANDS = ["GAOMON", "HUION", "SAMSUNG", "UGEE", "WACOM", "XENCELABS", "XPPEN"];
export const WACOM_ONLY = ["WACOM"];
export const PRESSURE_RESPONSE_BRANDS = ["HUION", "SAMSUNG", "WACOM", "XENCELABS", "XPPEN"];

export type { PenCompatGrouped };

export function expandPenCompat(grouped: PenCompatGrouped[]): PenCompat[] {
  const rows: PenCompat[] = [];
  for (const entry of grouped) {
    for (const tabletId of entry.TabletIds) {
      rows.push({
        Brand: entry.Brand,
        TabletId: tabletId,
        PenId: entry.PenId,
        _id: "",
        _CreateDate: "",
        _ModifiedDate: "",
      });
    }
  }
  return rows;
}

/**
 * Parse a multi-valued field that may be either an array of strings or a
 * comma-separated string. Always returns a string[] (possibly empty).
 *
 * Used for backwards-compatibility with hand-edited JSON or legacy data
 * sources where multi-valued fields are sometimes encoded as CSV.
 */
export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}
