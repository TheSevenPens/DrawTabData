import type { Rating, RecommendationNote, RecommendationList } from "../schemas.js";
import { RATINGS } from "../schemas.js";
import type { FieldDisplayDef, Step } from "@thesevenpens/queriton";
import { BRANDS } from "../loader-shared.js";

export type { Rating, RecommendationNote, RecommendationList } from "../schemas.js";

// EntityId is the stored id of the tablet or pen; pages draw a label through cellLinks.

export const RATING_FIELD_GROUPS = ["Rating"];

export const RATING_FIELDS: FieldDisplayDef<Rating>[] = [
  { key: "EntityId", label: "Device", getValue: (r) => r.EntityId, type: "string", group: "Rating" },
  { key: "Brand", label: "Brand", getValue: (r) => r.Brand, type: "enum", enumValues: [...BRANDS], group: "Rating" },
  { key: "Rating", label: "Rating", getValue: (r) => r.Rating, type: "enum", enumValues: [...RATINGS], group: "Rating" },
  { key: "Date", label: "Date", getValue: (r) => r.Date, type: "string", group: "Rating" },
  { key: "OriginalRating", label: "Original label", getValue: (r) => r.OriginalRating ?? "", type: "string", group: "Rating" },
  { key: "Context", label: "Context", getValue: (r) => r.Context ?? "", type: "string", group: "Rating" },
  { key: "Basis", label: "Basis", getValue: (r) => r.Basis ?? "", type: "enum", enumValues: ["SPECS_ONLY"], group: "Rating" },
  { key: "Source", label: "Source", getValue: (r) => r.Source, type: "string", group: "Rating" },
];

export const RATING_DEFAULT_COLUMNS = ["EntityId", "Brand", "Rating", "Date", "Context"];

export const RATING_DEFAULT_VIEW: Step[] = [
  { kind: "select", fields: RATING_DEFAULT_COLUMNS },
  { kind: "sort", field: "Date", direction: "desc" },
];

export const RECOMMENDATION_NOTE_FIELDS: FieldDisplayDef<RecommendationNote>[] = [
  { key: "EntityId", label: "Device", getValue: (n) => n.EntityId, type: "string", group: "Note" },
  { key: "Brand", label: "Brand", getValue: (n) => n.Brand, type: "enum", enumValues: [...BRANDS], group: "Note" },
  { key: "Kind", label: "Kind", getValue: (n) => n.Kind, type: "enum", enumValues: ["INFO", "TIP", "WARNING"], group: "Note" },
  { key: "Text", label: "Text", getValue: (n) => n.Text, type: "string", group: "Note" },
  { key: "Date", label: "Date", getValue: (n) => n.Date, type: "string", group: "Note" },
];

export const RECOMMENDATION_LIST_FIELDS: FieldDisplayDef<RecommendationList>[] = [
  { key: "EntityId", label: "Device", getValue: (l) => l.EntityId, type: "string", group: "List" },
  { key: "Brand", label: "Brand", getValue: (l) => l.Brand, type: "enum", enumValues: [...BRANDS], group: "List" },
  { key: "List", label: "List", getValue: (l) => l.List, type: "enum", enumValues: ["BEGINNER"], group: "List" },
  { key: "Date", label: "Date", getValue: (l) => l.Date, type: "string", group: "List" },
];
