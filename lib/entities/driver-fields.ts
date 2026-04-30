import type { Driver } from "../drawtab-loader.js";
import { brandName } from "../drawtab-loader.js";
import type { FieldDef, Step } from "../pipeline/types.js";
import { BRANDS } from "../loader-shared.js";

export type { Driver } from "../drawtab-loader.js";

const OS_LABELS: Record<string, string> = { MACOS: "macOS", WINDOWS: "Windows" };

export const DRIVER_FIELD_GROUPS = ["Driver", "Links"];

export const DRIVER_FIELDS: FieldDef<Driver>[] = [
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
    key: "Age", label: "Age (years)", computed: true, type: "number", group: "Driver",
    getValue: (d) => {
      if (!d.ReleaseDate) return "";
      const year = new Date(d.ReleaseDate).getFullYear();
      return isNaN(year) ? "" : String(new Date().getFullYear() - year);
    },
  },
  {
    key: "AgeInDays", label: "Age (days)", computed: true, type: "number", group: "Driver",
    getValue: (d) => {
      if (!d.ReleaseDate) return "";
      const releaseDate = new Date(d.ReleaseDate);
      if (isNaN(releaseDate.getTime())) return "";
      return String(Math.floor((Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24)));
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
