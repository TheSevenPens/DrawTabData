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
| `version-info` | `tsx scripts/generate-version.ts` | Regenerate `data/version.json` |
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
7. `npm run set-family -- FamilyId ModelId` — assign family if needed
8. `npm run data-quality` — full validation before committing

### Creating a new tablet family

1. `npm run list-tablets -- --brand BRAND` — survey tablets by brand
2. Identify shared traits (pen, year, model ID prefix)
3. Add family to `data/tablet-families/BRAND-tablet-families.json`
4. `npm run set-family -- NewFamilyId ModelId1 ModelId2 ...` — assign members
5. `npm run show-family -- NewFamilyId` — verify
6. `npm run data-quality` — validate
