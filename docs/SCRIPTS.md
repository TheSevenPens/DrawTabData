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

### find-unfamilied

List tablets that have no `Model.Family` assigned, grouped by brand.

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

Assign `Model.Family` (the family EntityId) to one or more tablets by ModelId or tablet EntityId. Validates that
the family exists before writing.

```bash
npm run set-family -- XPPenArtistGen2 CD100FH CD120FH CD130FH CD160FH
```

**When to use:** After identifying a group of tablets that belong to a
family. Replaces writing throwaway Node scripts for bulk assignment.

### format-data

Check, or normalize, the formatting of every managed data file (RFC #45).
Canonical form is defined by `formatDataJson()` in `lib/data-json.ts`:
UTF-8 without BOM, LF, `JSON.stringify(value, null, 2) + "
"`.

```bash
npx tsx scripts/format-data.ts            # check only; exit 1 on any issue (runs in CI)
npx tsx scripts/format-data.ts --write    # rewrite non-canonical files
```

**Rule for every script that edits `data/`:** read with `readDataJson`,
write with `writeDataJson`. Never splice text at an indentation or
round-trip through PowerShell `ConvertTo-Json` (#43).

### generate

Regenerate the tablet, pen and pressure-response brand bundles from
`source/` (RFC #45).

```bash
npx tsx scripts/generate.ts            # check only; exit 1 on drift (CI runs this first)
npx tsx scripts/generate.ts --write    # after editing source/
```

`--write` refuses to write anything while a source file has problems
(wrong name, wrong brand directory, duplicate EntityId, bad JSON), and
deletes a bundle no source produces any more.

### split-sources

The ONE-TIME migration per collection that created `source/<collection>/`
from its bundles (tablets + pens `e3cf06e`, pressure-response `44eb0cb`).
Kept as the record of how each split was made; it refuses a collection
that is already split.

### edit

Edit one tablet, pen or pressure session by EntityId — the "edit this
EntityId" command RFC #45 left for later. It finds the source file, applies
the assignments, validates the record against its schema, bumps
`_ModifiedDate`, writes and regenerates.

```bash
npm run edit -- wacom.pen.kp504e ReleaseYear=2016
npm run edit -- xppen.tablet.g430s Digitizer.Tilt=60 'Model.AlternateNames:=["Star G430S OSU"]'
npm run edit -- wacom.tablet.fb630 --unset Model.IncludedPen
npm run edit -- <EntityId> ... --dry-run
```

- `Field=value` sets a string (a number where the field already holds one);
  `Field:=json` sets any JSON value; `--unset Field` removes one.
- A bare name resolves against the schema when unambiguous
  (`ReleaseYear` on a tablet is `Model.ReleaseYear`), so a field the
  record doesn't have yet still works; otherwise give the dotted path.
- Refuses identity fields (EntityId, Brand, model id, session identity):
  changing those is a migration, not an edit.
- After writing it runs data-quality. If the edit caused a new issue —
  on this record or on one that references it, e.g. re-dating a pen after a
  tablet that ships it — it puts the file back. `--force` keeps it.

### verify-snapshot

Checks a published snapshot — a `version.json` plus the bundles it lists —
against this repository (RFC #45). See CONSUMERS.md "Verifying a
published snapshot".

```bash
npm run verify-snapshot -- https://thesevenpens.github.io/DrawTabDataExplorer/version.json
npm run verify-snapshot -- path/to/version.json --json
```

Read-only: nothing is fetched and the checkout isn't touched. The
Explorer's CI runs it on every build's own `version.json`.

### add-driver-record

The write half of `Add-WacomDriver.ps1`. It takes a JSON file of new
driver entries and inserts them into `data/drivers/<BRAND>-drivers.json`
through `writeDataJson`. Each entry is validated against `DriverSchema`,
and a DriverUID or EntityId that already exists is refused.
`--after-version-prefix 6.4.` inserts after the last matching entry.
The `.ps1` calls it; you rarely need to run it directly.

### add-tablet

Add a new tablet record. Reads a partial spec from a JSON file, auto-fills
`Meta` (EntityId, _id, _CreateDate, _ModifiedDate), validates the full
record against `TabletSchema`, writes it to its source file
`source/tablets/<brand>/<EntityId>.json` and regenerates `data/tablets/<BRAND>-tablets.json`
through `writeDataJson` (canonical format, so the diff is just the new
record). New records are ordered `Meta`, `Model`, then the spec's sections.

```bash
npm run add-tablet -- spec.json
npm run add-tablet -- spec.json --dry-run    # preview without writing
```

See `docs/IMPORTING-TABLETS.md` for the spec file shape and field mapping.

**When to use:** any new tablet import. Replaces hand-editing the brand
file.

### find-or-add-pen

Find a pen by name/id, or add a new one in a single command.

```bash
npm run find-or-add-pen -- "X3 Pro Pencil"                    # search
npm run find-or-add-pen -- --add XPPEN PD04B "X3 Note Pad Pen" --year 2024
npm run find-or-add-pen -- --add XPPEN PD04B "X3 Note Pad Pen" --dry-run
```

Search matches against PenName, PenId, and EntityId (alphanumerics,
case-insensitive). Add mode validates against `PenSchema` and writes
the pen to its source file `source/pens/<brand>/<EntityId>.json` and
regenerates `data/pens/<BRAND>-pens.json`.

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

## Reference capture scripts (third-party data)

Scripts that mirror somebody else's published data into `data/<source>/`.
Two rules make these safe to re-run and safe to trust:

- **The capture is never edited by hand.** Re-run the script to refresh and
  let `git diff` show what the source changed.
- **Our reading of the data lives in a separate annotations file.** The
  capture stays a faithful mirror; the mapping to our EntityIds is a layer
  laid beside it, joined by record id.

### extract-otd-configs

Pulls OpenTabletDriver's per-model configurations from GitHub into
`data/otd/otd-tablets.json` - the authoritative OTD model `Name`, physical
and pen specs, and USB identifiers for every tablet OTD supports.

```bash
node scripts/extract-otd-configs.mjs            # latest master
node scripts/extract-otd-configs.mjs <ref|sha>  # pin to a ref or SHA
GITHUB_TOKEN=... node scripts/extract-otd-configs.mjs   # raise the API rate limit
```

It resolves the ref to a commit SHA and pins every file read to it, so
re-running against an unchanged OTD rewrites an identical file - provenance
is the commit, not the wall clock. The model key is the config's top-level
`Name`, **not** the filename and **not** ProductID (many models share a
VendorID+ProductID pair; see GitHub #308).

The sibling `data/otd/otd-entity-audit.json` is not written by this script:
it is our OTD-model-to-EntityId curation, saved from the `/otd-audit` page in
the Explorer.

**When to use:** to refresh the OTD mirror after upstream adds or corrects
configurations.

### capture-machollywood

Captures the MacHollywood page ["Wacom Tablets and Cintiqs with Compatible
Pens"](https://machollywood.com/blogs/news/wacom-tablets-and-cintiqs-with-compatible-pens)
into `data/machollywood/` as `machollywood-pen-compat.txt` (the article text,
verbatim) and `machollywood-pen-compat.json` (a structured view of that text).

```bash
npm run capture-machollywood                    # fetch and rewrite both files
npm run capture-machollywood -- --check         # has the page changed? (exit 1 if so)
npm run capture-machollywood -- --html page.html  # parse a saved copy instead
```

The `.txt` is the source of truth and the `.json` is derived from it: the
script refuses to write unless the JSON reconstructs the text byte for byte,
so the structured view can never quietly disagree with the page.

**When to use:** to refresh the capture, or on a schedule via `--check` to
notice that the page was updated.

### annotate-machollywood

Maps the model and pen codes printed on that page to our EntityIds, writing
`machollywood-pen-compat-annotations.json`.

```bash
npm run annotate-machollywood                 # write annotations
npm run annotate-machollywood -- --report     # print the summary only
npm run annotate-machollywood -- --unmatched  # list what did not resolve cleanly
```

Each mapping carries how confident it is:

| Match | Meaning |
|---|---|
| `EXACT` | the page code and our Id agree once punctuation is ignored |
| `PREFIX` | the page code is our Id plus a suffix (usually colour/variant, e.g. `DTH3220K0` -> `DTH-3220`) |
| `PARTIAL` | our Id is the page code plus a suffix (we are the more specific one) |
| `AMBIGUOUS` | several of our entities are equally good candidates; left unresolved |
| `NONE` | nothing in our data looks like it |

**Only `EXACT` is settled.** `PREFIX` and `PARTIAL` carry an `entityId` but
are proposals to review - prefix matching is genuinely wrong sometimes (the
page's Colorelli `FT-0405U10` prefix-matches our Volito `FT-0405-U`). To pin a
human decision, edit the entry and set `"manual": true`; re-runs preserve
those verbatim and regenerate everything else.

### Where commentary goes

Three note fields, and the difference between them is the point:

| Field | Where | Written by | For |
|---|---|---|---|
| `pageNotes` | on a record (`string[]`) | generated | what the **page** says about the model - its `description` lines and `bullets`, verbatim |
| `notes` | on a record (`string[]`) | by hand | what **we** say: a caveat, a decision, a fact worth carrying forward |
| `note` | on a mapping (`string`) | by hand | why this one code maps the way it does |

`pageNotes` is a projection of the capture, refreshed on every run - **never
edit it**, the edit would be overwritten. It is duplicated here on purpose:
this file is where you decide what to carry into an entity's `Model.Notes`,
and that decision is easier with the page's own words sitting next to the
mapping.

The two hand-written fields survive a re-run even when the match around them
is recomputed, so a note can explain an `AMBIGUOUS` entry without freezing
it. To freeze the match itself, add `"manual": true`.

Two worked examples are seeded:

- **`colorelli-ft-0405u10-discontinued`** - a wrong auto-match, pinned to
  `NONE` with a note saying why (its SKU prefix-matches our `FT-0405-U`,
  which is the Volito the page lists separately).
- **`intuos2-xd`** - a note quoting the page's own SKU legend, which explains
  why every XD code there is `AMBIGUOUS` between our `-R` and `-U` variants.

Anything of ours belongs here rather than in the capture: the `.txt` and the
structured `.json` are rewritten wholesale on every refresh, and the point of
those two files is that they say exactly what the page says, nothing more.

**When to use:** after a capture refresh, or after adding Wacom tablets/pens
that the page references.

## Existing scripts

| Script | Command | Purpose |
|---|---|---|
| `data-quality` | `tsx lib/run-data-quality.ts` | Full data quality checks across all entities |
| `version-info` | `tsx scripts/generate-version.ts` | Regenerate `data/version.json` (the Explorer builds its own via `lib/version-info.ts`) |
| `build` | `tsc` | TypeScript compilation |

## Typical workflows

### Importing a new tablet from a product page

1. `npm run list-tablets` — check the model isn't already present
2. `npm run find-or-add-pen -- "<pen name>"` — confirm the included pen's EntityId
   (use `--add` if it's missing)
3. Author the spec JSON (see `docs/IMPORTING-TABLETS.md` for shape)
4. `npm run add-tablet -- spec.json --dry-run` — preview the auto-filled record
5. `npm run add-tablet -- spec.json` — write
6. `npm run find-unfamilied -- --brand BRAND` — check if it needs a family
7. `npm run set-family -- <family> ModelId` — assign family if needed
8. `npm run data-quality` — full validation before committing

### Creating a new tablet family

1. `npm run list-tablets -- --brand BRAND` — survey tablets by brand
2. Identify shared traits (pen, year, model ID prefix)
3. Add family to `data/tablet-families/BRAND-tablet-families.json`
4. `npm run set-family -- <new-family> ModelId1 ModelId2 ...` — assign members
5. `npm run show-family -- <new-family>` — verify
6. `npm run data-quality` — validate
