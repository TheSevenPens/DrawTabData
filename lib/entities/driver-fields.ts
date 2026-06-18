import type { Driver } from "../drawtab-loader.js";
import { brandName } from "../drawtab-loader.js";
import type { FieldDisplayDef, Step } from "@thesevenpens/queriton";
import { BRANDS } from "../loader-shared.js";

export type { Driver } from "../drawtab-loader.js";

const OS_LABELS: Record<string, string> = { MACOS: "macOS", WINDOWS: "Windows" };

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_MONTH = 365.25 / 12; // ≈ 30.44
const DAYS_PER_YEAR = 365.25;

/** Whole days between a release date and now, or null if unparseable. */
function ageInDays(releaseDate: string | undefined): number | null {
  if (!releaseDate) return null;
  const t = new Date(releaseDate).getTime();
  if (isNaN(t)) return null;
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

/** One-decimal, trailing-".0" trimmed (e.g. 3.5 → "3.5", 2.0 → "2"). */
function trim1(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

/**
 * Human-friendly age string from a day count, picking the unit that reads
 * most naturally: days → weeks → months (one decimal) → "Y year(s) M month(s)".
 * Examples: "5 days", "1 week", "3.5 months", "1 year 4 months".
 */
export function formatAge(days: number): string {
  const d = Math.floor(days);
  if (d <= 0) return "today";
  if (d < 7) return `${d} day${d === 1 ? "" : "s"}`;
  if (d < 30) {
    const w = Math.round(d / 7);
    return `${w} week${w === 1 ? "" : "s"}`;
  }
  if (d < DAYS_PER_YEAR) {
    const months = trim1(d / DAYS_PER_MONTH);
    return `${months} month${months === "1" ? "" : "s"}`;
  }
  let years = Math.floor(d / DAYS_PER_YEAR);
  let months = Math.round((d - years * DAYS_PER_YEAR) / DAYS_PER_MONTH);
  if (months >= 12) {
    years += 1;
    months -= 12;
  }
  const yPart = `${years} year${years === 1 ? "" : "s"}`;
  return months > 0 ? `${yPart} ${months} month${months === 1 ? "" : "s"}` : yPart;
}

export const DRIVER_FIELD_GROUPS = ["Driver", "Links"];

export const DRIVER_FIELDS: FieldDisplayDef<Driver>[] = [
  // Driver
  { key: "EntityId", label: "Entity ID", getValue: (d) => d.EntityId, type: "string", group: "Driver" },
  { key: "Brand", label: "Brand", getValue: (d) => d.Brand, type: "enum", enumValues: [...BRANDS], group: "Driver" },
  { key: "DriverVersion", label: "Version", getValue: (d) => d.DriverVersion, type: "string", group: "Driver" },
  {
    key: "DriverName", label: "Name", computed: true, type: "string", group: "Driver",
    getValue: (d) => `${brandName(d.Brand)} Driver ${d.DriverVersion} for ${OS_LABELS[d.OSFamily] ?? d.OSFamily}`,
  },
  { key: "OSFamily", label: "OS", getValue: (d) => d.OSFamily, type: "enum", enumValues: ["MACOS", "WINDOWS"], group: "Driver" },
  { key: "ReleaseDate", label: "Release Date", getValue: (d) => d.ReleaseDate, type: "string", group: "Driver" },
  {
    // Sorts/filters by the underlying age in days (numeric); displays a
    // human-friendly span ("5 days", "1 week", "3.5 months", "1 year 4 months").
    key: "Age", label: "Age", computed: true, type: "number", group: "Driver",
    getValue: (d) => {
      const days = ageInDays(d.ReleaseDate);
      return days === null ? "" : String(days);
    },
    getDisplayValue: (d) => {
      const days = ageInDays(d.ReleaseDate);
      return days === null ? "" : formatAge(days);
    },
  },
  {
    key: "AgeInDays", label: "Age (days)", computed: true, type: "number", group: "Driver",
    getValue: (d) => {
      const days = ageInDays(d.ReleaseDate);
      return days === null ? "" : String(days);
    },
  },
  // Links
  { key: "DriverURLWacom", label: "Wacom URL", getValue: (d) => d.DriverURLWacom, type: "string", group: "Links" },
  { key: "DriverURLArchiveDotOrg", label: "Archive.org URL", getValue: (d) => d.DriverURLArchiveDotOrg, type: "string", group: "Links" },
  { key: "ReleaseNotesURL", label: "Release Notes URL", getValue: (d) => d.ReleaseNotesURL, type: "string", group: "Links" },
];

export const DRIVER_DEFAULT_COLUMNS = [
  "Brand", "DriverVersion", "DriverName", "OSFamily", "ReleaseDate", "Age",
];

export const DRIVER_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: [
      "Brand", "DriverVersion", "DriverName", "OSFamily", "ReleaseDate", "Age",
    ],
  },
  { kind: "sort", field: "ReleaseDate", direction: "desc" },
];
