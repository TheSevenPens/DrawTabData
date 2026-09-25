# Bulk-filling data via worksheet + one-shot script

A repeatable workflow for filling many fields across many records —
e.g. setting `PenTech` on every Wacom pen that starts with `XP-`, or
populating every Huion pen's sensor / control / physical block from a
spec sheet.

This is faster than field-by-field chat or editing JSON by hand, and
the worksheet round-trips cleanly through a chat / paste flow.

## When to use it

- You have 5+ records to update. For one or two, use `npm run edit --
  <EntityId> Field=value` instead (docs/SCRIPTS.md → edit).
- The fields are well-defined (in the Valibot schema) or you're willing
  to add a schema slot for any new ones.
- You're filling at most a few dozen fields per record. (For deeper
  hierarchical edits, just edit JSON directly.)

## The workflow

### 1. Survey current state

Show what's already set, what's still empty, and the schema-supported
optional fields with their enum / numeric / string types. For example:

```js
// Reading the generated bundle is fine for a survey.
const j = require('./data-repo/data/pens/HUION-pens.json');
const fields = {};
for (const p of j.Pens) for (const k of Object.keys(p)) fields[k] = (fields[k] ?? 0) + 1;
console.log(fields);
```

Cross-reference with `data-repo/lib/schemas.ts` for the canonical field
list and any picklist values.

### 2. Build a chat worksheet

One mini-section per record. Every field listed by name with an empty
placeholder. Easy for a human to fill, easy to parse mechanically:

```
=== PE150 (PE150)
PenTech:
PressureSensitive:
PressureLevels:
Tilt:
BarrelRotation:
Hover:
ButtonCount:
Wheel:
Eraser:
Shape:
Weight:
Length:
Diameter:
PenFamily:
ReleaseYear:
Notes:

=== PE330 (PE330)
PenTech:
...
```

Include a tiny "accepted values" reference at the bottom (enum picks,
unit hints).

### 3. Triage the filled paste before applying

Before any write:
- Flag typos that don't match the enum (e.g. `MER` vs `EMR`).
- Flag fields that aren't in the schema yet (e.g. `IAF:` before there
  was a slot for it). Decide: add a schema field, stash in Notes, or
  drop.
- Confirm with the user, then apply.

### 4. Apply via a one-shot node script

Write a script in `scripts/` that:

1. Reads the records. **Tablets, pens and pressure sessions** come from their per-record
   source files (`source/<collection>/<brand>/<EntityId>.json`, RFC #45);
   every other collection is still a `data/` file.
2. Merges values per record (look up by `PenId` / `Model.Id` / EntityId).
3. Bumps each touched record's `_ModifiedDate` to `new Date().toISOString()`.
4. Writes back: tablets/pens/sessions with `writeSourceRecord` then one
   `regenerate()` (lib/sources.ts); other collections with
   `writeDataJson` (lib/data-json.ts). Both write the canonical format,
   so the diff is just what you changed. **Never edit a generated
   tablet/pen/session bundle, hand-roll `JSON.stringify`, or go through
   PowerShell** — see "Pitfalls".

```js
// Run with: npx tsx scripts/<one-shot>.mjs  (from data-repo/)
import { readSources, regenerate, sourceCollection, writeSourceRecord } from '../lib/sources.ts';

const pens = sourceCollection('pens');
const { records } = readSources('.', pens);

const updates = {
  PE150: { PenTech: 'PASSIVE_EMR', Hover: 'YES', ButtonCount: '2' /* ... */ },
  // ...
};

const now = new Date().toISOString();
for (const { record } of records) {
  const u = updates[record.PenId];
  if (!u) continue;
  Object.assign(record, u);
  record._ModifiedDate = now;
  writeSourceRecord('.', pens, record); // canonical, one file per record
}
regenerate('.'); // rebuild data/pens/*-pens.json from the sources
```

For a collection that isn't split (e.g. pen-families), use
`readDataJson` / `writeDataJson` from `lib/data-json.ts` on the `data/` file.

### 5. Verify

- `npx tsx scripts/generate.ts` — bundles match their sources.
- `npm run data-quality` — should be clean (or down to pre-existing
  issues only).
- `npm test --prefix=data-repo` — Vitest covers DrawTabDataSet.
- Browser preview a couple of affected detail pages to spot-check.

### 6. Delete the one-shot script

These are throwaway artifacts; keeping them in `scripts/` clutters the
folder over time. The git history is the record of what was done; the
script itself doesn't need to ship.

### 7. Commit + bump submodule + push

- Two commits: one inside `data-repo/` (the actual JSON change), one
  in the outer repo (the submodule pointer bump).
- The data-repo commit message documents what changed, which records
  were touched, and links to any closed issue with `Closes #NN`.

## Prior examples

- **Huion pen spec fill** ([5b71253](https://github.com/TheSevenPens/DrawTabData/commit/5b71253))
  — all 19 Huion pens got sensors / controls / physical from a worksheet,
  plus a new `IAF` schema field.
- **Wacom `PenTech: PASSIVE_EMR` batch** (multiple commits across XP-*, UP-*,
  KP-*, GP-*, LP-*, EP-*, ACP-*, ZP-* prefixes) — the same script template
  reused per prefix, ~60+ records updated in total.

## Pitfalls

- **Never round-trip through PowerShell `ConvertTo-Json`.** It read
  BOM-less UTF-8 as ANSI and double-encoded non-ASCII text (#43), escaped
  `&` and `'` as `&` / `'`, and re-indented every record.
  `writeDataJson` works the same on every OS. `npx tsx
  scripts/format-data.ts` checks the whole dataset (it runs in CI too).
- **Don't run the script via `add-tablet.ts`.** That script is for
  adding new tablets one at a time and has its own validation flow.
- **Schema changes go first.** If your worksheet introduces a field
  the schema doesn't know about, add the optional field to the schema
  and to the field def in `lib/entities/` before applying the data —
  otherwise data-quality will reject every touched record.
