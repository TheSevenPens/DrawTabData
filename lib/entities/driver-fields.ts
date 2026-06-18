import type { Driver } from "../drawtab-loader.js";
import { brandName } from "../drawtab-loader.js";
import type { FieldDisplayDef, Step } from "@thesevenpens/queriton";
import { BRANDS } from "../loader-shared.js";
import { ageInDays, formatAge } from "./age-format.js";

export type { Driver } from "../drawtab-loader.js";

const OS_LABELS: Record<string, string> = { MACOS: "macOS", WINDOWS: "Windows" };

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
