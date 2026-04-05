import type { Brand } from "../drawtab-loader.js";
import type { FieldDef, Step } from "../pipeline/types.js";

export type { Brand } from "../drawtab-loader.js";

export const BRAND_FIELD_GROUPS = ["Brand"];

export const BRAND_FIELDS: FieldDef<Brand>[] = [
  { key: "EntityId", label: "Entity ID", getValue: (b) => b.EntityId, type: "string", group: "Brand" },
  { key: "BrandId", label: "Brand ID", getValue: (b) => b.BrandId, type: "string", group: "Brand" },
  { key: "BrandName", label: "Name", getValue: (b) => b.BrandName, type: "string", group: "Brand" },
  { key: "SiteURL", label: "Site URL", getValue: (b) => b.SiteURL, type: "string", group: "Brand" },
  { key: "Country", label: "Country", getValue: (b) => b.Country, type: "string", group: "Brand" },
];

export const BRAND_DEFAULT_COLUMNS = [
  "EntityId", "BrandId", "BrandName", "SiteURL", "Country",
];

export const BRAND_DEFAULT_VIEW: Step[] = [
  {
    kind: "select",
    fields: ["BrandId", "BrandName", "SiteURL", "Country"],
  },
  { kind: "sort", field: "BrandName", direction: "asc" },
];
