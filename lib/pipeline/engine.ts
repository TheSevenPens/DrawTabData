import type { FieldDef, Step, FilterStep, SortStep } from "./types.js";

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
  let data = [...items];
  let visibleFields: string[] | null = null;

  for (const step of steps) {
    switch (step.kind) {
      case "filter":
        data = applyFilter(data, step, fields);
        break;
      case "sort":
        data = applySort(data, step, fields);
        break;
      case "select":
        visibleFields = step.fields;
        break;
      case "take":
        data = data.slice(0, step.count);
        break;
    }
  }

  return { data, visibleFields: visibleFields ?? defaultColumns };
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
