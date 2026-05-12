// --- Step types ---

export type StepKind =
  | "filter"
  | "sort"
  | "select"
  | "take"
  | "summarize"
  | "project"
  | "predicate"
  | "boolFilter"
  | "derive"
  | "join"
  | "joinResolved"
  | "semijoin"
  | "semijoinResolved";

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

/**
 * An aggregator that consumes the items of a group and produces a value.
 *
 * - `count` — group row count; ignores `field`.
 * - `sum` / `avg` / `min` / `max` / `median` — numeric reductions over
 *   `field`; empties and non-numeric values are skipped.
 * - `distinctCount` — count of distinct non-empty values of `field`.
 * - `first` / `last` — raw value of `field` from the first / last item in
 *   input order (including empty strings).
 * - `collect` — array of all raw `field` values in input order
 *   (including empties).
 */
export type AggregatorOp =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "median"
  | "first"
  | "last"
  | "distinctCount"
  | "collect";

export interface AggregatorSpec {
  /** Output column name in the summary rows. */
  name: string;
  op: AggregatorOp;
  /** Field key to read; ignored when op is "count". */
  field?: string;
}

/**
 * Reduces the input items to one row per distinct combination of `groupBy`
 * field values. Each row has one column per groupBy field plus one column
 * per aggregator (named by `AggregatorSpec.name`). After a summarize step,
 * subsequent filter/sort/take operate on the synthetic summary rows, not
 * the original entities.
 */
export interface SummarizeStep {
  kind: "summarize";
  groupBy: string[];
  aggs: AggregatorSpec[];
}

/**
 * Projects each row into an object with only the requested fields, reading
 * values via the active field-defs. Unknown fields degrade to empty
 * strings. Distinct from `SelectStep`, which only tags visible columns in
 * UI metadata and does not transform the row shape.
 */
export interface ProjectStep {
  kind: "project";
  fields: string[];
}

/**
 * Runs an arbitrary predicate function against each row. Not serialisable
 * — these steps are dropped by URL state / saved views.
 */
export interface PredicateStep {
  kind: "predicate";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (item: any) => boolean;
}

/**
 * A boolean expression tree over field/op/value leaves. Used by
 * `BoolFilterStep` to support OR / NOT / nested combinations that the
 * flat AND-chain of `.filter(field, op, value)` cannot express.
 */
export type FilterExpr =
  | { field: string; op: string; value: string }
  | { and: FilterExpr[] }
  | { or: FilterExpr[] }
  | { not: FilterExpr };

export interface BoolFilterStep {
  kind: "boolFilter";
  expr: FilterExpr;
}

/**
 * Adds computed columns to each row via user-supplied functions. Like
 * `predicate`, not serialisable. The engine performs a shallow clone per
 * row and attaches the derived keys; downstream field-defs are appended.
 */
export interface DeriveStep {
  kind: "derive";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cols: Record<string, (item: any) => string | number>;
}

/**
 * Construction-time join step. `other` is the right-hand Query whose
 * rows will be materialised by `Query.toArray()` and replaced with a
 * `joinResolved` step before the synchronous engine runs.
 */
export interface JoinStep {
  kind: "join";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  other: unknown; // Query<unknown> — typed loosely to avoid a circular import.
  leftKey: string;
  rightKey: string;
}

export interface JoinResolvedStep {
  kind: "joinResolved";
  leftKey: string;
  rightKey: string;
  rightRows: unknown[];
  rightFields: FieldDef<unknown>[];
}

export interface SemijoinStep {
  kind: "semijoin";
  other: unknown;
  leftKey: string;
  rightKey: string;
}

export interface SemijoinResolvedStep {
  kind: "semijoinResolved";
  leftKey: string;
  rightKey: string;
  rightRows: unknown[];
  rightFields: FieldDef<unknown>[];
}

export type Step =
  | FilterStep
  | SortStep
  | SelectStep
  | TakeStep
  | SummarizeStep
  | ProjectStep
  | PredicateStep
  | BoolFilterStep
  | DeriveStep
  | JoinStep
  | JoinResolvedStep
  | SemijoinStep
  | SemijoinResolvedStep;

/**
 * Shape of rows produced by a `summarize` or `project` step. Keys are the
 * groupBy / projected field names. Values are typically strings (groupBy
 * keys, projected getValue results), numbers (numeric aggregators), or
 * arrays of strings (`collect` aggregator).
 */
export type SummaryRow = Record<string, string | number | string[]>;

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
