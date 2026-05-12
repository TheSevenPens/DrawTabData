import type { FieldDef, Step, FilterStep, SortStep, SummarizeStep, SummaryRow } from "./types.js";

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
      case "summarize": {
        const { rows, fields: synthetic } = applySummarize(data, step, activeFields);
        data = rows;
        activeFields = synthetic;
        // Default visible columns for a summary result: groupBy then aggs.
        visibleFields = [...step.groupBy, ...step.aggs.map((a) => a.name)];
        break;
      }
    }
  }

  return {
    data: data as T[],
    visibleFields: visibleFields ?? defaultColumns,
  };
}

function applyFilter<T>(items: T[], step: FilterStep, fields: FieldDef<T>[]): T[] {
  const fieldDef = getFieldDef(step.field, fields);
  if (!fieldDef) return items;

  return items.filter((item) => {
    const val = fieldDef.getValue(item);
    switch (step.operator) {
      case "==": return val === step.value;
      case "!=": return val !== step.value;
      case "contains": return val.toLowerCase().includes(step.value.toLowerCase());
      case "notcontains": return !val.toLowerCase().includes(step.value.toLowerCase());
      case "startswith": return val.toLowerCase().startsWith(step.value.toLowerCase());
      case "notstartswith": return !val.toLowerCase().startsWith(step.value.toLowerCase());
      case "empty": return val === "";
      case "notempty": return val !== "";
      case ">": return val !== "" && Number(val) > Number(step.value);
      case ">=": return val !== "" && Number(val) >= Number(step.value);
      case "<": return val !== "" && Number(val) < Number(step.value);
      case "<=": return val !== "" && Number(val) <= Number(step.value);
      default: return true;
    }
  });
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
      type: "number" as const,
      group: "Aggregate",
    })),
  ];

  return { rows, fields: syntheticFields };
}

function computeAggregator(
  spec: SummarizeStep["aggs"][number],
  items: unknown[],
  fields: FieldDef<unknown>[],
): number {
  if (spec.op === "count") return items.length;
  if (!spec.field) return 0;
  const def = getFieldDef(spec.field, fields);
  if (!def) return 0;

  const nums: number[] = [];
  for (const it of items) {
    const raw = def.getValue(it);
    if (raw === "") continue;
    const n = Number(raw);
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
  }
}
