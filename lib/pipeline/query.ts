// Fluent, lazy query builder over an in-memory collection. Backed by the
// pipeline engine — calls to filter/sort/take/summarize/etc. return a new
// Query with one Step appended; the underlying load and execution are
// deferred until toArray/find/count/distinct/keyBy.
//
// This module is the generic core of the future `queriton` package. It has
// no DrawTab-specific dependencies — the only knowledge it carries about a
// collection is the FieldDef array passed in at construction time.

import type {
  AnyFieldDef,
  Step,
  AggregatorSpec,
  SummaryRow,
  FilterExpr,
  JoinStep,
  SemijoinStep,
  AntijoinStep,
  LeftjoinStep,
  ConcatStep,
} from "./types.js";
import { executePipeline } from "./engine.js";

export type FilterOp =
  | "=="
  | "!="
  | "contains"
  | "notcontains"
  | "startswith"
  | "notstartswith"
  | "empty"
  | "notempty"
  | ">"
  | ">="
  | "<"
  | "<=";

export type SortDirection = "asc" | "desc";

/**
 * Ergonomic shape for `Query.summarize()`. Translates to one canonical
 * `SummarizeStep` with `groupBy` (always an array) and `aggs` (one entry
 * per requested aggregator). Examples:
 *
 *   { by: "Brand", count: true }
 *     → groupBy: ["Brand"], aggs: [{ name: "count", op: "count" }]
 *
 *   { by: ["Brand", "ModelType"], count: "tablets" }
 *     → groupBy: ["Brand", "ModelType"], aggs: [{ name: "tablets", op: "count" }]
 *
 *   { by: "Brand", avg: { avgYear: "ModelLaunchYear" } }
 *     → aggs: [{ name: "avgYear", op: "avg", field: "ModelLaunchYear" }]
 */
export interface SummarizeSpec {
  /** Field key(s) to group by. Omit for a single all-rows summary. */
  by?: string | string[];
  /** `true` → adds a `count` column; string → uses that column name. */
  count?: boolean | string;
  /** Map of output-column-name → field key. Empty/non-numeric skipped. */
  sum?: Record<string, string>;
  avg?: Record<string, string>;
  min?: Record<string, string>;
  max?: Record<string, string>;
  median?: Record<string, string>;
  /** Count of distinct non-empty values per group. */
  distinctCount?: Record<string, string>;
  /** First / last raw value in input order (includes empties). */
  first?: Record<string, string>;
  last?: Record<string, string>;
  /** Array of all raw values per group (input order, includes empties). */
  collect?: Record<string, string>;
}

export function summarizeSpecToAggs(spec: SummarizeSpec): AggregatorSpec[] {
  const aggs: AggregatorSpec[] = [];
  if (spec.count) {
    aggs.push({ name: spec.count === true ? "count" : spec.count, op: "count" });
  }
  const fieldedOps = ["sum", "avg", "min", "max", "median", "distinctCount", "first", "last", "collect"] as const;
  for (const op of fieldedOps) {
    for (const [name, field] of Object.entries(spec[op] ?? {})) {
      aggs.push({ name, op, field });
    }
  }
  return aggs;
}

/**
 * Lazy query over an entity collection. Calls to filter/sort/take/summarize
 * return a new Query with the step appended; the underlying load and
 * execution are deferred until toArray/find/count.
 */
export class Query<T> {
  constructor(
    private readonly load: () => Promise<T[]>,
    private readonly fields: AnyFieldDef[],
    private readonly steps: Step[] = [],
  ) {}

  /**
   * Three accepted forms:
   *
   * - `.filter(field, op, value)` — flat AND-chain, serialisable to URL state.
   * - `.filter(expr)` — boolean expression tree with `and` / `or` / `not`,
   *   also serialisable.
   * - `.filter(item => ...)` — arbitrary predicate function. NOT serialisable —
   *   such steps are dropped by saved-view / URL-state persistence.
   */
  filter(predicate: (item: T) => boolean): Query<T>;
  filter(expr: FilterExpr): Query<T>;
  filter(field: string, operator: FilterOp, value: string | number): Query<T>;
  filter(
    a: string | ((item: T) => boolean) | FilterExpr,
    b?: FilterOp,
    c?: string | number,
  ): Query<T> {
    if (typeof a === "string") {
      return new Query(this.load, this.fields, [
        ...this.steps,
        { kind: "filter", field: a, operator: b as FilterOp, value: String(c) },
      ]);
    }
    if (typeof a === "function") {
      return new Query(this.load, this.fields, [
        ...this.steps,
        { kind: "predicate", fn: a as (item: unknown) => boolean },
      ]);
    }
    return new Query(this.load, this.fields, [
      ...this.steps,
      { kind: "boolFilter", expr: a },
    ]);
  }

  /**
   * Two forms:
   *
   * - `.sort(field, direction?)` — single key sort.
   * - `.sort([{field, direction?}, ...])` — multi-key sort. The array is
   *   primary-first, matching SQL `ORDER BY a, b` (`a` primary). Internally
   *   it translates to single-key sort steps in reverse order so JS's stable
   *   sort makes the first array entry primary.
   *
   * Chained `.sort()` calls also compose via stable sort, but the **last**
   * call becomes primary — opposite of the array form. Prefer the array
   * form for multi-key sorts.
   */
  sort(fields: Array<{ field: string; direction?: SortDirection }>): Query<T>;
  sort(field: string, direction?: SortDirection): Query<T>;
  sort(
    a: string | Array<{ field: string; direction?: SortDirection }>,
    direction: SortDirection = "asc",
  ): Query<T> {
    if (Array.isArray(a)) {
      // Reverse so the first entry becomes primary (last sort wins via JS
      // Array.sort stability — see method doc above).
      let q: Query<T> = this;
      for (let i = a.length - 1; i >= 0; i--) {
        q = q.sort(a[i].field, a[i].direction ?? "asc");
      }
      return q;
    }
    return new Query(this.load, this.fields, [
      ...this.steps,
      { kind: "sort", field: a, direction },
    ]);
  }

  take(count: number): Query<T> {
    return new Query(this.load, this.fields, [
      ...this.steps,
      { kind: "take", count },
    ]);
  }

  /** Drops the first `count` rows. Pairs with `.take()` for pagination. */
  skip(count: number): Query<T> {
    return new Query(this.load, this.fields, [
      ...this.steps,
      { kind: "skip", count },
    ]);
  }

  /** Keeps the last `count` rows in current order. Mirror of `.take()`. */
  last(count: number): Query<T> {
    return new Query(this.load, this.fields, [
      ...this.steps,
      { kind: "last", count },
    ]);
  }

  /** Reverses the current row order without re-sorting. */
  reverse(): Query<T> {
    return new Query(this.load, this.fields, [...this.steps, { kind: "reverse" }]);
  }

  /**
   * Shorthand for `.filter({ or: values.map(v => ({field, op:'==', value:v})) })`.
   * Same effect as a SQL `WHERE field IN (...)`.
   */
  filterIn(field: string, values: Array<string | number>): Query<T> {
    return this.filter({
      or: values.map((v) => ({ field, op: "==", value: String(v) })),
    });
  }

  /** Inverse of `.filterIn()`. */
  filterNotIn(field: string, values: Array<string | number>): Query<T> {
    return this.filter({
      not: { or: values.map((v) => ({ field, op: "==", value: String(v) })) },
    });
  }

  /**
   * Explodes a top-level array-valued column into one row per element. For
   * nested arrays on entities (`Model.AlternateNames`) call `.derive()` first
   * to lift the array to a top-level column.
   */
  unroll(field: string): Query<T> {
    return new Query(this.load, this.fields, [...this.steps, { kind: "unroll", field }]);
  }

  /**
   * Project each row to only the listed fields, reading values via the
   * active field-defs. Returns a Query whose row shape is `SummaryRow`,
   * so subsequent `.sort()` / `.filter()` / `.take()` operate on the
   * projected columns. Unknown field keys degrade to empty strings.
   */
  select(fields: string[]): Query<SummaryRow> {
    return new Query<SummaryRow>(
      this.load as unknown as () => Promise<SummaryRow[]>,
      this.fields,
      [...this.steps, { kind: "project", fields }],
    );
  }

  /**
   * Distinct non-empty values of a single field, sorted naturally. Equivalent
   * to `.summarize({ by: field }).toArray().map(r => r[field])` with empties
   * dropped and natural sort applied.
   */
  async distinct(field: string): Promise<string[]> {
    const rows = await this.summarize({ by: field }).toArray();
    return rows
      .map((r) => String(r[field] ?? ""))
      .filter((v) => v !== "")
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  /** Synonym for `.distinct()`. */
  values(field: string): Promise<string[]> {
    return this.distinct(field);
  }

  /**
   * Group rows by zero or more fields and compute aggregators per group.
   * Returns a new Query whose row shape is `SummaryRow` — subsequent
   * `.sort()` / `.filter()` / `.take()` target groupBy keys and aggregator
   * output columns (e.g. `.sort("count", "desc").take(5)`).
   */
  summarize(spec: SummarizeSpec): Query<SummaryRow> {
    const groupBy =
      spec.by === undefined ? [] : Array.isArray(spec.by) ? spec.by : [spec.by];
    const aggs = summarizeSpecToAggs(spec);
    return new Query<SummaryRow>(
      // The load function still returns the raw entities — the summarize step
      // collapses them at execution time. We widen its return through unknown
      // because the executor handles the row-shape transition.
      this.load as unknown as () => Promise<SummaryRow[]>,
      this.fields,
      [...this.steps, { kind: "summarize", groupBy, aggs }],
    );
  }

  /**
   * Adds computed columns to each row. The functions are evaluated against
   * the *current* row shape — call `.derive()` before `.summarize()` /
   * `.project()` if you want the derived values available in those steps.
   * Returns a Query whose row shape is widened to include the new keys.
   */
  derive<K extends string>(
    cols: Record<K, (item: T) => string | number>,
  ): Query<T & Record<K, string | number>> {
    return new Query(this.load as unknown as () => Promise<(T & Record<K, string | number>)[]>, this.fields, [
      ...this.steps,
      { kind: "derive", cols: cols as Record<string, (item: unknown) => string | number> },
    ]);
  }

  /**
   * Inner join with another Query. Matching pairs of rows are merged
   * (right-side columns overwrite left on name collisions). The right-side
   * Query is materialised lazily at `.toArray()` time.
   */
  join<U>(other: Query<U>, leftKey: string, rightKey: string): Query<T & U> {
    return new Query(this.load as unknown as () => Promise<(T & U)[]>, this.fields, [
      ...this.steps,
      { kind: "join", other, leftKey, rightKey } as JoinStep,
    ]);
  }

  /**
   * Semi-join: keeps left rows that have at least one matching row on
   * the right side. The right side's columns are *not* merged in — the
   * row shape stays as `T`.
   */
  semijoin<U>(other: Query<U>, leftKey: string, rightKey: string): Query<T> {
    return new Query(this.load, this.fields, [
      ...this.steps,
      { kind: "semijoin", other, leftKey, rightKey } as SemijoinStep,
    ]);
  }

  /**
   * Anti-join: keeps left rows that have **no** matching row on the right
   * side. The inverse of `.semijoin()`. Useful for data-quality patterns
   * ("tablets with no compat entries", "pens not paired with any tablet").
   */
  antijoin<U>(other: Query<U>, leftKey: string, rightKey: string): Query<T> {
    return new Query(this.load, this.fields, [
      ...this.steps,
      { kind: "antijoin", other, leftKey, rightKey } as AntijoinStep,
    ]);
  }

  /**
   * Left-join: keeps **all** left rows. Matches merge right-side columns
   * (right wins on name collisions, same as `.join()`); rows with no
   * match pass through unchanged.
   */
  leftjoin<U>(other: Query<U>, leftKey: string, rightKey: string): Query<T & Partial<U>> {
    return new Query(this.load as unknown as () => Promise<(T & Partial<U>)[]>, this.fields, [
      ...this.steps,
      { kind: "leftjoin", other, leftKey, rightKey } as LeftjoinStep,
    ]);
  }

  /**
   * Appends rows from another Query — semantically SQL `UNION ALL` (no
   * deduplication). For dedup, chain `.distinct(...)` afterwards.
   */
  concat<U>(other: Query<U>): Query<T | U> {
    return new Query(this.load as unknown as () => Promise<(T | U)[]>, this.fields, [
      ...this.steps,
      { kind: "concat", other } as ConcatStep,
    ]);
  }

  /** Synonym for `.concat()`. */
  union<U>(other: Query<U>): Query<T | U> {
    return this.concat(other);
  }

  /**
   * Materialise the query and bucket rows by a single field value. Last
   * row wins on collision. Pre-summarize uses entity field-defs;
   * post-summarize / post-project falls back to direct property access.
   */
  async keyBy(field: string): Promise<Record<string, T>> {
    const items = await this.toArray();
    const getKey = this.keyReader(field);
    const out: Record<string, T> = {};
    for (const item of items) {
      const k = getKey(item);
      if (k !== "") out[k] = item;
    }
    return out;
  }

  /** Like `keyBy` but collects every row per key into an array. */
  async collectBy(field: string): Promise<Record<string, T[]>> {
    const items = await this.toArray();
    const getKey = this.keyReader(field);
    const out: Record<string, T[]> = {};
    for (const item of items) {
      const k = getKey(item);
      if (k === "") continue;
      (out[k] ??= []).push(item);
    }
    return out;
  }

  /**
   * Returns a function that reads `field` off a row. Uses the entity's
   * FieldDef.getValue when present (handles nesting). After a summarize /
   * project step the row shape is flat — fall back to direct property
   * access so post-transform keyBy still works.
   */
  private keyReader(field: string): (item: T) => string {
    const isPostTransform = this.steps.some(
      (s) => s.kind === "summarize" || s.kind === "project",
    );
    if (!isPostTransform) {
      const def = this.fields.find((f) => f.key === field);
      if (def) return (item) => def.getValue(item);
    }
    return (item) => String((item as Record<string, unknown>)[field] ?? "");
  }

  async toArray(): Promise<T[]> {
    const items = await this.load();
    if (this.steps.length === 0) return items;
    // Resolve any join/semijoin/antijoin/leftjoin/concat steps by
    // materialising the right side first — the synchronous engine cannot
    // await. Each resolution shape just adds `rightRows` + `rightFields`.
    const resolved: Step[] = [];
    for (const step of this.steps) {
      if (
        step.kind === "join" ||
        step.kind === "semijoin" ||
        step.kind === "antijoin" ||
        step.kind === "leftjoin"
      ) {
        const right = step.other as Query<unknown>;
        const rightRows = await right.toArray();
        resolved.push({
          kind: `${step.kind}Resolved` as
            | "joinResolved"
            | "semijoinResolved"
            | "antijoinResolved"
            | "leftjoinResolved",
          leftKey: step.leftKey,
          rightKey: step.rightKey,
          rightRows,
          rightFields: right.fields,
        });
      } else if (step.kind === "concat") {
        const right = step.other as Query<unknown>;
        const rightRows = await right.toArray();
        resolved.push({
          kind: "concatResolved",
          rightRows,
          rightFields: right.fields,
        });
      } else {
        resolved.push(step);
      }
    }
    return executePipeline(items, resolved, this.fields, []).data;
  }

  async find(predicate: (item: T) => boolean): Promise<T | undefined> {
    return (await this.toArray()).find(predicate);
  }

  async count(): Promise<number> {
    return (await this.toArray()).length;
  }
}
