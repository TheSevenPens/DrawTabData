// Per-row computed values, owned by the DrawTabDataSet that loaded the row
// (TheSevenPens/DrawTabDataExplorer#346).
//
// Several FieldDefs show values derived from *other* collections — a pen's
// UnitsInInventory, a session's IsDefective, a pen family's PenCount. Those
// used to read module-level maps that each app had to fill by calling
// setters (setPenFamilyNames, setInventoryUnitCountByPenEntityId, …) before
// querying. Every page therefore preloaded ~1.6 MB it might not need, and
// any consumer that skipped the setup silently read 0 / NO.
//
// Now the dataset computes those values while loading the collection that
// needs them and stores them on each row under a Symbol key:
//
//   - enumerable, so a spread copy (queriton's derive / join) keeps them;
//   - a Symbol, so JSON.stringify and Object.keys ignore them and exports
//     look exactly as before.
//
// FieldDefs read them with computedOf(row). A row that didn't come from a
// DrawTabDataSet has none, and each field falls back to its empty value.

export const COMPUTED: unique symbol = Symbol.for("drawtabdata.computed");

export interface ComputedValues {
  // Pen
  UnitsInInventory?: number;
  PressureSessionCount?: number;
  FamilyName?: string;
  // Tablet (UnitsInInventory, shared key)
  // Pen family
  PenCount?: number;
  InventoryCount?: number;
  ModelIds?: string;
  // Pressure-response session
  IsDefective?: boolean;
}

type WithComputed = { [COMPUTED]?: ComputedValues };

/** The computed values the dataset attached to `row`, or `{}`. */
export function computedOf(row: unknown): ComputedValues {
  if (row === null || typeof row !== "object") return {};
  return (row as WithComputed)[COMPUTED] ?? {};
}

/** Attach computed values to `row` (mutates and returns it). */
export function attachComputed<T extends object>(row: T, values: ComputedValues): T {
  (row as T & WithComputed)[COMPUTED] = values;
  return row;
}
