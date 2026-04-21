// --- Step types ---

export type StepKind = "filter" | "sort" | "select" | "take";

export interface FilterStep {
  kind: "filter";
  field: string;
  operator: string;
  value: string;
}

export interface SortStep {
  kind: "sort";
  field: string;
  direction: "asc" | "desc";
}

export interface SelectStep {
  kind: "select";
  fields: string[];
}

export interface TakeStep {
  kind: "take";
  count: number;
}

export type Step = FilterStep | SortStep | SelectStep | TakeStep;

// --- Convenience alias ---

/**
 * A FieldDef where the item type is not statically known.
 * Use this in generic UI components (EntityExplorer, ResultsTable, etc.) that
 * accept field definitions for any entity type. Callers with a concrete entity
 * type should continue to use FieldDef<T> directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFieldDef = FieldDef<any>;

// --- Field metadata ---

export interface FieldDef<T> {
  key: string;
  label: string;
  getValue: (item: T) => string;
  /** Override display text shown in DetailView (does not affect filtering/sorting). */
  getDisplayValue?: (item: T) => string;
  /** Return an internal href (no base prefix needed) to render the value as a link in DetailView. */
  getHref?: (item: T) => string | null;
  type: "string" | "number" | "enum";
  enumValues?: string[];
  computed?: boolean;
  group: string;
  unit?: string;
  /**
   * When true, this field is always included in text search even when it is
   * not in the user's visible columns. Use for fields like AlternateNames that
   * should be findable but don't need to appear as a column by default.
   */
  alwaysSearch?: boolean;
}
