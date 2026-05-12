import type {
  FieldDef,
  Step,
  FilterStep,
  SortStep,
  SummarizeStep,
  ProjectStep,
  PredicateStep,
  BoolFilterStep,
  FilterExpr,
  DeriveStep,
  UnrollStep,
  JoinResolvedStep,
  SemijoinResolvedStep,
  AntijoinResolvedStep,
  LeftjoinResolvedStep,
  ConcatResolvedStep,
  SummaryRow,
} from "./types.js";

// --- Field lookup ---

export function getFieldDef<T>(key: string, fields: FieldDef<T>[]): FieldDef<T> | undefined {
  return fields.find((f) => f.key === key);
}

// --- Operators ---

export function getOperatorsForField<T>(fieldDef: FieldDef<T>): { value: string; label: string }[] {
  if (fieldDef.type === "enum") {
    return [
      { value: "==", label: "equals" },
      { value: "!=", label: "not equals" },
      { value: "empty", label: "is empty" },
      { value: "notempty", label: "is not empty" },
    ];
  }
  if (fieldDef.type === "number") {
    return [
      { value: "==", label: "=" },
      { value: "!=", label: "!=" },
      { value: ">", label: ">" },
      { value: ">=", label: ">=" },
      { value: "<", label: "<" },
      { value: "<=", label: "<=" },
      { value: "empty", label: "is empty" },
      { value: "notempty", label: "is not empty" },
    ];
  }
  return [
    { value: "==", label: "equals" },
    { value: "!=", label: "not equals" },
    { value: "contains", label: "contains" },
    { value: "notcontains", label: "does not contain" },
    { value: "startswith", label: "starts with" },
    { value: "notstartswith", label: "does not start with" },
    { value: "empty", label: "is empty" },
    { value: "notempty", label: "is not empty" },
  ];
}

// --- Pipeline execution ---

export function executePipeline<T>(
  items: T[],
  steps: Step[],
  fields: FieldDef<T>[],
  defaultColumns: string[],
): { data: T[]; visibleFields: string[] } {
  // After a summarize step the row shape becomes SummaryRow, so internally
  // we widen to unknown[] / FieldDef<unknown>[] and let the caller cast.
  let data: unknown[] = [...items];
  let activeFields: FieldDef<unknown>[] = fields as unknown as FieldDef<unknown>[];
  let visibleFields: string[] | null = null;

  for (const step of steps) {
    switch (step.kind) {
      case "filter":
        data = applyFilter(data, step, activeFields);
        break;
      case "sort":
        data = applySort(data, step, activeFields);
        break;
      case "select":
        visibleFields = step.fields;
        break;
      case "take":
        data = data.slice(0, step.count);
        break;
      case "skip":
        data = data.slice(step.count);
        break;
      case "last":
        data = step.count <= 0 ? [] : data.slice(-step.count);
        break;
      case "reverse":
        data = [...data].reverse();
        break;
      case "summarize": {
        const { rows, fields: synthetic } = applySummarize(data, step, activeFields);
        data = rows;
        activeFields = synthetic;
        // Default visible columns for a summary result: groupBy then aggs.
        visibleFields = [...step.groupBy, ...step.aggs.map((a) => a.name)];
        break;
      }
      case "project": {
        const { rows, fields: synthetic } = applyProject(data, step, activeFields);
        data = rows;
        activeFields = synthetic;
        visibleFields = [...step.fields];
        break;
      }
      case "predicate":
        data = applyPredicate(data, step);
        break;
      case "boolFilter":
        data = applyBoolFilter(data, step, activeFields);
        break;
      case "derive": {
        const { rows, fields: extended } = applyDerive(data, step, activeFields);
        data = rows;
        activeFields = extended;
        break;
      }
      case "joinResolved": {
        const { rows, fields: extended } = applyJoin(data, step, activeFields);
        data = rows;
        activeFields = extended;
        break;
      }
      case "semijoinResolved":
        data = applySemijoin(data, step, activeFields);
        break;
      case "antijoinResolved":
        data = applyAntijoin(data, step, activeFields);
        break;
      case "leftjoinResolved": {
        const { rows, fields: extended } = applyLeftjoin(data, step, activeFields);
        data = rows;
        activeFields = extended;
        break;
      }
      case "concatResolved": {
        const { rows, fields: extended } = applyConcat(data, step, activeFields);
        data = rows;
        activeFields = extended;
        break;
      }
      case "unroll":
        data = applyUnroll(data, step);
        break;
      case "join":
      case "semijoin":
      case "antijoin":
      case "leftjoin":
      case "concat":
        // Unresolved join/concat — Query.toArray() should have replaced
        // these with their *Resolved counterparts before reaching the
        // engine. Seeing one here means a caller bypassed toArray().
        throw new Error(`Engine received unresolved ${step.kind} step. Did you forget to await Query.toArray()?`);
    }
  }

  return {
    data: data as T[],
    visibleFields: visibleFields ?? defaultColumns,
  };
}

/**
 * Apply one operator from FilterOp to a single value pair. Factored out so
 * both `applyFilter` and the boolean-expression evaluator share semantics.
 *
 * The `contains` / `startswith` family and their `not*` counterparts are
 * case-insensitive by default — pass a value through the `*Strict` variant
 * to match case exactly.
 *
 * Multi-value operators (`in`, `notin`, `between`) encode their list in
 * `refValue` as pipe-separated strings: `'WACOM|HUION'`, `'2020|2025'`.
 */
export function matchesOperator(val: string, operator: string, refValue: string): boolean {
  switch (operator) {
    case "==":
      return val === refValue;
    case "!=":
      return val !== refValue;
    case "contains":
      return val.toLowerCase().includes(refValue.toLowerCase());
    case "notcontains":
      return !val.toLowerCase().includes(refValue.toLowerCase());
    case "startswith":
      return val.toLowerCase().startsWith(refValue.toLowerCase());
    case "notstartswith":
      return !val.toLowerCase().startsWith(refValue.toLowerCase());
    case "containsStrict":
      return val.includes(refValue);
    case "notcontainsStrict":
      return !val.includes(refValue);
    case "startswithStrict":
      return val.startsWith(refValue);
    case "notstartswithStrict":
      return !val.startsWith(refValue);
    case "in":
      return refValue.split("|").includes(val);
    case "notin":
      return !refValue.split("|").includes(val);
    case "between": {
      if (val === "") return false;
      const [lo, hi] = refValue.split("|").map(Number);
      const n = Number(val);
      return n >= lo && n <= hi;
    }
    case "empty":
      return val === "";
    case "notempty":
      return val !== "";
    case ">":
      return val !== "" && Number(val) > Number(refValue);
    case ">=":
      return val !== "" && Number(val) >= Number(refValue);
    case "<":
      return val !== "" && Number(val) < Number(refValue);
    case "<=":
      return val !== "" && Number(val) <= Number(refValue);
    default:
      return true;
  }
}

function applyFilter<T>(items: T[], step: FilterStep, fields: FieldDef<T>[]): T[] {
  const fieldDef = getFieldDef(step.field, fields);
  if (!fieldDef) return items;
  return items.filter((item) => matchesOperator(fieldDef.getValue(item), step.operator, step.value));
}

function applySort<T>(items: T[], step: SortStep, fields: FieldDef<T>[]): T[] {
  const fieldDef = getFieldDef(step.field, fields);
  if (!fieldDef) return items;

  return [...items].sort((a, b) => {
    const va = fieldDef.getValue(a);
    const vb = fieldDef.getValue(b);
    const cmp = va.localeCompare(vb, undefined, { numeric: true });
    return step.direction === "asc" ? cmp : -cmp;
  });
}

function applySummarize(
  items: unknown[],
  step: SummarizeStep,
  fields: FieldDef<unknown>[],
): { rows: SummaryRow[]; fields: FieldDef<unknown>[] } {
  const groupDefs = step.groupBy.map((k) => getFieldDef(k, fields));
  const NUL = "\x00";

  // Bucket items by the joined groupBy values. Missing field-defs degrade to
  // an empty key segment so the engine doesn't blow up on a typo — same
  // forgiving behaviour as applyFilter.
  const groups = new Map<string, { keyValues: string[]; items: unknown[] }>();
  for (const item of items) {
    const keyValues = groupDefs.map((d) => (d ? d.getValue(item) : ""));
    const key = keyValues.join(NUL);
    let g = groups.get(key);
    if (!g) {
      g = { keyValues, items: [] };
      groups.set(key, g);
    }
    g.items.push(item);
  }

  const rows: SummaryRow[] = [];
  for (const g of groups.values()) {
    const row: SummaryRow = {};
    step.groupBy.forEach((k, i) => {
      row[k] = g.keyValues[i];
    });
    for (const a of step.aggs) {
      row[a.name] = computeAggregator(a, g.items, fields);
    }
    rows.push(row);
  }

  // Synthetic field-defs over the new row shape so downstream sort/filter/take
  // can target groupBy keys and aggregator output columns.
  const syntheticFields: FieldDef<unknown>[] = [
    ...step.groupBy.map((k) => ({
      key: k,
      label: k,
      getValue: (row: unknown) => String((row as SummaryRow)[k] ?? ""),
      type: "string" as const,
      group: "GroupBy",
    })),
    ...step.aggs.map((a) => ({
      key: a.name,
      label: a.name,
      getValue: (row: unknown) => String((row as SummaryRow)[a.name] ?? ""),
      // Numeric ops produce numbers; first/last produce raw strings;
      // collect produces an array which stringifies to a CSV when read
      // back through getValue (good enough for filter/sort fallthrough).
      type:
        a.op === "first" || a.op === "last" || a.op === "collect"
          ? ("string" as const)
          : ("number" as const),
      group: "Aggregate",
    })),
  ];

  return { rows, fields: syntheticFields };
}

function computeAggregator(
  spec: SummarizeStep["aggs"][number],
  items: unknown[],
  fields: FieldDef<unknown>[],
): number | string | string[] {
  if (spec.op === "count") return items.length;
  if (!spec.field) return 0;
  const def = getFieldDef(spec.field, fields);
  if (!def) {
    // Unknown field: return a sensible empty for each op so a typo doesn't
    // throw. Numeric aggs → 0; first/last → ""; collect → [].
    if (spec.op === "first" || spec.op === "last") return "";
    if (spec.op === "collect") return [];
    return 0;
  }

  // Raw values in input order — used by first/last/collect (which include
  // empties) and as the source for the numeric / distinct paths.
  const raw: string[] = items.map((it) => def.getValue(it));

  switch (spec.op) {
    case "first":
      return raw.length > 0 ? raw[0] : "";
    case "last":
      return raw.length > 0 ? raw[raw.length - 1] : "";
    case "collect":
      return raw;
    case "distinctCount": {
      const set = new Set<string>();
      for (const v of raw) if (v !== "") set.add(v);
      return set.size;
    }
  }

  // Numeric path — sum / avg / min / max / median. Skip empties and
  // non-numeric values.
  const nums: number[] = [];
  for (const v of raw) {
    if (v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    nums.push(n);
  }
  if (nums.length === 0) return 0;

  switch (spec.op) {
    case "sum":
      return nums.reduce((s, n) => s + n, 0);
    case "avg":
      return nums.reduce((s, n) => s + n, 0) / nums.length;
    case "min":
      return Math.min(...nums);
    case "max":
      return Math.max(...nums);
    case "median": {
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = sorted.length >> 1;
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }
  }
}

function applyProject(
  items: unknown[],
  step: ProjectStep,
  fields: FieldDef<unknown>[],
): { rows: SummaryRow[]; fields: FieldDef<unknown>[] } {
  const defs = step.fields.map((k) => ({ key: k, def: getFieldDef(k, fields) }));
  const rows: SummaryRow[] = items.map((item) => {
    const row: SummaryRow = {};
    for (const { key, def } of defs) {
      row[key] = def ? def.getValue(item) : "";
    }
    return row;
  });

  const syntheticFields: FieldDef<unknown>[] = step.fields.map((k) => ({
    key: k,
    label: k,
    getValue: (row: unknown) => String((row as SummaryRow)[k] ?? ""),
    type: "string" as const,
    group: "Project",
  }));

  return { rows, fields: syntheticFields };
}

function applyPredicate(items: unknown[], step: PredicateStep): unknown[] {
  return items.filter((item) => step.fn(item));
}

/**
 * Recursively evaluates a FilterExpr against a single row. Leaves read
 * `field` via the active field-defs and apply the operator semantics from
 * `matchesOperator`.
 */
function evalFilterExpr(
  expr: FilterExpr,
  item: unknown,
  fields: FieldDef<unknown>[],
): boolean {
  if ("and" in expr) return expr.and.every((c) => evalFilterExpr(c, item, fields));
  if ("or" in expr) return expr.or.some((c) => evalFilterExpr(c, item, fields));
  if ("not" in expr) return !evalFilterExpr(expr.not, item, fields);
  const def = getFieldDef(expr.field, fields);
  if (!def) return true; // forgiving — typo in field key doesn't drop everything
  return matchesOperator(def.getValue(item), expr.op, expr.value);
}

function applyBoolFilter(
  items: unknown[],
  step: BoolFilterStep,
  fields: FieldDef<unknown>[],
): unknown[] {
  return items.filter((item) => evalFilterExpr(step.expr, item, fields));
}

function applyDerive(
  items: unknown[],
  step: DeriveStep,
  fields: FieldDef<unknown>[],
): { rows: unknown[]; fields: FieldDef<unknown>[] } {
  const colNames = Object.keys(step.cols);
  // Shallow-clone each item with the derived keys merged in. We drop any
  // non-enumerable methods (relationship helpers) — that's a deliberate
  // tradeoff; derive is for analysis pipelines, not record traversal.
  const rows = items.map((item) => {
    const out: Record<string, unknown> = { ...(item as object) };
    for (const k of colNames) {
      out[k] = step.cols[k](item);
    }
    return out;
  });

  // The derived columns become synthetic field-defs whose getValue reads
  // the merged property. Original fields keep working because the clone
  // still has the entity's nested structure.
  const derivedFields: FieldDef<unknown>[] = colNames.map((k) => ({
    key: k,
    label: k,
    getValue: (row: unknown) => String((row as Record<string, unknown>)[k] ?? ""),
    type: "string" as const,
    group: "Derive",
  }));

  return { rows, fields: [...fields, ...derivedFields] };
}

function applyJoin(
  items: unknown[],
  step: JoinResolvedStep,
  leftFields: FieldDef<unknown>[],
): { rows: unknown[]; fields: FieldDef<unknown>[] } {
  const leftDef = getFieldDef(step.leftKey, leftFields);
  const rightDef = getFieldDef(step.rightKey, step.rightFields);

  // Bucket the right side by its key value for O(L + R) join cost.
  const rightByKey = new Map<string, unknown[]>();
  for (const r of step.rightRows) {
    const k = rightDef ? rightDef.getValue(r) : "";
    let bucket = rightByKey.get(k);
    if (!bucket) {
      bucket = [];
      rightByKey.set(k, bucket);
    }
    bucket.push(r);
  }

  // Inner join: cross-product of matching left and right rows. Right-side
  // columns overwrite left-side on name collisions (documented quirk).
  const joined: unknown[] = [];
  for (const left of items) {
    const lk = leftDef ? leftDef.getValue(left) : "";
    const matches = rightByKey.get(lk);
    if (!matches) continue;
    for (const right of matches) {
      joined.push({ ...(left as object), ...(right as object) });
    }
  }

  return { rows: joined, fields: [...leftFields, ...step.rightFields] };
}

function applySemijoin(
  items: unknown[],
  step: SemijoinResolvedStep,
  leftFields: FieldDef<unknown>[],
): unknown[] {
  const leftDef = getFieldDef(step.leftKey, leftFields);
  const rightDef = getFieldDef(step.rightKey, step.rightFields);

  const keys = new Set<string>();
  for (const r of step.rightRows) {
    keys.add(rightDef ? rightDef.getValue(r) : "");
  }

  return items.filter((item) => keys.has(leftDef ? leftDef.getValue(item) : ""));
}

function applyAntijoin(
  items: unknown[],
  step: AntijoinResolvedStep,
  leftFields: FieldDef<unknown>[],
): unknown[] {
  const leftDef = getFieldDef(step.leftKey, leftFields);
  const rightDef = getFieldDef(step.rightKey, step.rightFields);

  const keys = new Set<string>();
  for (const r of step.rightRows) {
    keys.add(rightDef ? rightDef.getValue(r) : "");
  }

  return items.filter((item) => !keys.has(leftDef ? leftDef.getValue(item) : ""));
}

function applyLeftjoin(
  items: unknown[],
  step: LeftjoinResolvedStep,
  leftFields: FieldDef<unknown>[],
): { rows: unknown[]; fields: FieldDef<unknown>[] } {
  const leftDef = getFieldDef(step.leftKey, leftFields);
  const rightDef = getFieldDef(step.rightKey, step.rightFields);

  const rightByKey = new Map<string, unknown[]>();
  for (const r of step.rightRows) {
    const k = rightDef ? rightDef.getValue(r) : "";
    let bucket = rightByKey.get(k);
    if (!bucket) {
      bucket = [];
      rightByKey.set(k, bucket);
    }
    bucket.push(r);
  }

  // For each left row: emit cross-product of matches if any, otherwise
  // pass the left row through unchanged. Distinguishes left from inner
  // by always keeping unmatched left rows.
  const joined: unknown[] = [];
  for (const left of items) {
    const lk = leftDef ? leftDef.getValue(left) : "";
    const matches = rightByKey.get(lk);
    if (!matches) {
      joined.push(left);
      continue;
    }
    for (const right of matches) {
      joined.push({ ...(left as object), ...(right as object) });
    }
  }

  return { rows: joined, fields: mergeFieldDefs(leftFields, step.rightFields) };
}

function applyConcat(
  items: unknown[],
  step: ConcatResolvedStep,
  leftFields: FieldDef<unknown>[],
): { rows: unknown[]; fields: FieldDef<unknown>[] } {
  return {
    rows: [...items, ...step.rightRows],
    fields: mergeFieldDefs(leftFields, step.rightFields),
  };
}

function applyUnroll(items: unknown[], step: UnrollStep): unknown[] {
  const out: unknown[] = [];
  for (const item of items) {
    const value = (item as Record<string, unknown>)[step.field];
    if (Array.isArray(value)) {
      // Empty array → drop the row (matches Arquero / dplyr `unnest`).
      for (const el of value) {
        out.push({ ...(item as object), [step.field]: el });
      }
    } else {
      // Non-array value → pass through unchanged. Allows mixed shapes.
      out.push(item);
    }
  }
  return out;
}

/** Merge two field-def lists, keeping the first definition on key collision. */
function mergeFieldDefs(
  left: FieldDef<unknown>[],
  right: FieldDef<unknown>[],
): FieldDef<unknown>[] {
  const seen = new Set(left.map((f) => f.key));
  return [...left, ...right.filter((f) => !seen.has(f.key))];
}
