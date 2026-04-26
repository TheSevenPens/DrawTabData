# Data Scripts

Utility scripts for querying and modifying tablet data. All scripts run
via `tsx` from the data-repo root.

## Query scripts (read-only)

### list-tablets

List tablets with key fields in a tab-separated table. Useful for
surveying data, identifying patterns, and planning family assignments.

```bash
npm run list-tablets                          # all tablets
npm run list-tablets -- --brand XPPEN         # filter by brand
npm run list-tablets -- --type PENDISPLAY     # filter by type
npm run list-tablets -- --brand HUION --type PENTABLET  # both
```

Output columns: Brand, ModelId, ModelName, Year, Type, Pen, Family, Diagonal(mm)

**When to use:** Surveying tablets before creating families, checking
which tablets exist for a brand, verifying data after bulk imports.

### show-tablet

Show all populated fields for a single tablet in a readable format.
Accepts EntityId or ModelId.

```bash
npm run show-tablet -- WACOM.TABLET.PTK870
npm run show-tablet -- PTK870
```

**When to use:** Comparing a tablet's stored data against a product page
before or after importing specs. Checking what fields are already
populated.

### find-unfamilied

List tablets that have no `ModelFamily` assigned, grouped by brand.

```bash
npm run find-unfamilied                       # all brands
npm run find-unfamilied -- --brand XPPEN      # single brand
```

**When to use:** After adding new tablets, to check which ones still
need a family assignment. When planning new family groupings.

### show-family

List all tablets belonging to a family. Run without arguments to see
available families.

```bash
npm run show-family                           # list all families
npm run show-family -- XPPenArtistGen2        # show members
```

**When to use:** Verifying family membership, checking if a new tablet
should join an existing family, reviewing family completeness.

## Modification scripts (write data)

### set-family

Assign `ModelFamily` to one or more tablets by ModelId. Validates that
the family exists before writing.

```bash
npm run set-family -- XPPenArtistGen2 CD100FH CD120FH CD130FH CD160FH
```

**When to use:** After identifying a group of tablets that belong to a
family. Replaces writing throwaway Node scripts for bulk assignment.

### add-tablet

Add a new tablet record. Reads a partial spec from a JSON file, auto-fills
`Meta` (EntityId, _id, _CreateDate, _ModifiedDate), validates the full
record against `TabletSchema`, and inserts into `data/tablets/<BRAND>-tablets.json`
preserving the existing wide-indent format.

```bash
npm run add-tablet -- spec.json
npm run add-tablet -- spec.json --dry-run    # preview without writing
```

See `docs/IMPORTING-TABLETS.md` for the spec file shape and field mapping.

**When to use:** any new tablet import. Replaces hand-formatting JSON
that would otherwise need to match PowerShell's wide-indent style by
hand.

### find-or-add-pen

Find a pen by name/id, or add a new one in a single command.

```bash
npm run find-or-add-pen -- "X3 Pro Pencil"                    # search
npm run find-or-add-pen -- --add XPPEN PD04B "X3 Note Pad Pen" --year 2024
npm run find-or-add-pen -- --add XPPEN PD04B "X3 Note Pad Pen" --dry-run
```

Search matches against PenName, PenId, and EntityId (alphanumerics,
case-insensitive). Add mode validates against `PenSchema` and writes
to `data/pens/<BRAND>-pens.json` preserving wide-indent format.

**When to use:** before adding a tablet, to confirm the included pen's
EntityId or scaffold a missing pen record.

### validate-brand

Run schema validation on a single brand's tablet file. Faster than the
full `data-quality` check when iterating on one brand's data.

```bash
npm run validate-brand -- XPPEN
npm run validate-brand -- HUION
```

**When to use:** After adding or modifying tablets for a specific brand.
Catches unknown fields, invalid enum values, and schema violations
without running the full cross-entity check.

## Existing scripts

| Script | Command | Purpose |
|---|---|---|
| `data-quality` | `tsx lib/run-data-quality.ts` | Full data quality checks across all entities |
| `version-info` | `tsx scripts/generate-version.ts` | Regenerate `data/version.json` |
| `build` | `tsc` | TypeScript compilation |

## Typical workflows

### Importing a new tablet from a product page

1. `npm run show-tablet -- ModelId` — check if it already exists
2. `npm run find-or-add-pen -- "<pen name>"` — confirm the included pen's EntityId
   (use `--add` if it's missing)
3. Author the spec JSON (see `docs/IMPORTING-TABLETS.md` for shape)
4. `npm run add-tablet -- spec.json --dry-run` — preview the auto-filled record
5. `npm run add-tablet -- spec.json` — write
6. `npm run find-unfamilied -- --brand BRAND` — check if it needs a family
7. `npm run set-family -- FamilyId ModelId` — assign family if needed
8. `npm run data-quality` — full validation before committing

### Creating a new tablet family

1. `npm run list-tablets -- --brand BRAND` — survey tablets by brand
2. Identify shared traits (pen, year, model ID prefix)
3. Add family to `data/tablet-families/BRAND-tablet-families.json`
4. `npm run set-family -- NewFamilyId ModelId1 ModelId2 ...` — assign members
5. `npm run show-family -- NewFamilyId` — verify
6. `npm run data-quality` — validate
