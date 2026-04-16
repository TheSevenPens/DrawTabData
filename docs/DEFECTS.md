# Defects

Inventory records can carry per-unit defect information. This is
**per physical unit**, not per model — two copies of the same pen
model can have different defects, or one can be fine while another
is dead.

Defects are tracked on inventory records using a controlled vocabulary
of defect Kinds defined in `data/reference/defect-kinds.json`.

## The Defects field

On a pen or tablet inventory record, `Defects` is an optional array of
`{ Kind, Notes }` entries. Absent or empty means the unit has no
recorded defects. Each entry describes one way in which the unit is
defective.

```json
{
  "InventoryId": "WAP.0004",
  "PenEntityId": "WACOM.PEN.PROPEN2KP504E",
  "Defects": [
    { "Kind": "pressure-outlier-max", "Notes": "Reports only ~25% of nominal max pressure." }
  ]
}
```

- **`Kind`** — required. Must be one of the `Kind` values defined in
  `data/reference/defect-kinds.json`.
- **`Notes`** — required (may be the empty string). Free-text detail
  about the specific observation on this unit.

A unit can have multiple defect entries if it is defective in more than
one way.

## The defect vocabulary

`data/reference/defect-kinds.json` is the single source of truth for
defect `Kind` values. Each entry in the `DefectKinds` array has:

- **`Kind`** — a short, stable, lowercase-hyphenated identifier used
  as the `Defects[].Kind` value (e.g. `pressure-outlier-max`).
- **`AppliesTo`** — an array of `"pen"` and/or `"tablet"`, indicating
  which inventory entity types this Kind is meaningful for. Tools that
  offer a defect picker should filter the list by the current entity
  type, and validators should flag a pen-only Kind applied to a tablet
  (or vice versa).
- **`Description`** — human-readable description of what this Kind
  means.

### Current Kinds

| Kind | Applies to | Description |
|---|---|---|
| `dead` | pen, tablet | Completely non-functional. |
| `pressure-outlier-max` | pen | Reported maximum pressure is far outside the expected range for this model. |
| `pressure-stuck` | pen | Pressure reading is stuck at a single value regardless of applied force. |
| `pressure-outlier-iaf` | pen | Initial activation force is far outside the expected range — the pen requires an unusually hard (or light) press to begin registering pressure. |
| `no-tilt` | pen | Pen does not report tilt data, or tilt data is entirely unreliable. |

The list is intentionally minimal. New Kinds are added to
`defect-kinds.json` as real defects are observed; the current set
covers what has actually been seen across the inventory, not a
speculative catalogue of all possible failure modes.

## How consumers use this

**Is a unit defective?**

```typescript
const isDefective = (item) => Array.isArray(item.Defects) && item.Defects.length > 0;
```

**Filter inventory to defective units:**

```typescript
const defective = inventory.filter(isDefective);
```

**Group by Kind:**

```typescript
const byKind = new Map();
for (const item of inventory) {
  for (const d of item.Defects ?? []) {
    if (!byKind.has(d.Kind)) byKind.set(d.Kind, []);
    byKind.get(d.Kind).push(item);
  }
}
```

**Validate Kind values against the vocabulary:**

```typescript
const knownKinds = new Set(defectKinds.DefectKinds.map(k => k.Kind));
for (const item of inventory) {
  for (const d of item.Defects ?? []) {
    if (!knownKinds.has(d.Kind)) {
      console.warn(`Unknown defect Kind "${d.Kind}" on ${item.InventoryId}`);
    }
  }
}
```

## Design notes

- **Per unit, not per model.** Defects describe the specific physical
  unit identified by `InventoryId`. Pen and tablet model records never
  carry a `Defects` field.
- **No status/condition wrapper.** Presence of entries in `Defects` is
  the signal that something is wrong; there is no separate `Status`
  field to keep in sync. A healthy unit simply omits `Defects`.
- **Severity lives in `Notes`.** The same `Kind` can be mild or severe
  (e.g. a pen reporting 95% of max pressure vs 25%). Keep the
  distinction descriptive rather than adding a severity enum, until
  there is a concrete consumer that needs to filter by severity.
- **Controlled vocabulary in the data repo.** Keeping the Kind list
  in `data/reference/defect-kinds.json` lets every consumer (this
  inventory app, DrawTabDataExplorer, any future tool) agree on the
  same set of Kinds and offer consistent filtering.
