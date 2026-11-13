import type { Price } from "../schemas.js";
import type { FieldDisplayDef, Step } from "@thesevenpens/queriton";
import { BRANDS } from "../loader-shared.js";

export type { Price } from "../schemas.js";

export const PRICE_FIELD_GROUPS = ["Price", "Source"];

export const PRICE_FIELDS: FieldDisplayDef<Price>[] = [
  // Price
  { key: "EntityId", label: "Device", getValue: (p) => p.EntityId, type: "string", group: "Price" },
  { key: "Brand", label: "Brand", getValue: (p) => p.Brand, type: "enum", enumValues: [...BRANDS], group: "Price" },
  { key: "Kind", label: "Kind", getValue: (p) => p.Kind, type: "enum", enumValues: ["LAUNCH", "RETAIL", "LIST", "CURRENT"], group: "Price" },
  { key: "Amount", label: "Amount", getValue: (p) => p.Amount, type: "number", group: "Price" },
  { key: "Currency", label: "Currency", getValue: (p) => p.Currency, type: "string", group: "Price" },
  { key: "Date", label: "Date", getValue: (p) => p.Date ?? "", type: "string", group: "Price" },
  { key: "Primary", label: "Primary", getValue: (p) => String(p.Primary), type: "enum", enumValues: ["true", "false"], group: "Price" },
  // Source
  { key: "Seller", label: "Seller", getValue: (p) => p.Seller ?? "", type: "string", group: "Source" },
  { key: "Market", label: "Market", getValue: (p) => p.Market ?? "", type: "string", group: "Source" },
  { key: "CheckedOn", label: "Checked on", getValue: (p) => p.CheckedOn, type: "string", group: "Source" },
  { key: "Basis", label: "Basis", getValue: (p) => p.Basis ?? "", type: "string", group: "Source" },
  { key: "URL", label: "URL", getValue: (p) => p.URL ?? "", type: "string", group: "Source" },
  { key: "Note", label: "Note", getValue: (p) => p.Note ?? "", type: "string", group: "Source" },
];

export const PRICE_DEFAULT_COLUMNS = ["EntityId", "Brand", "Kind", "Amount", "Currency", "Date", "Seller"];

export const PRICE_DEFAULT_VIEW: Step[] = [
  { kind: "select", fields: PRICE_DEFAULT_COLUMNS },
  { kind: "sort", field: "EntityId", direction: "asc" },
];
