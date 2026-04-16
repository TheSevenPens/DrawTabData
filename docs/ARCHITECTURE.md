# Architecture

## Project structure

```
DrawTabData/
├── data/                         # JSON datasets
│   ├── brands/                   # brands.json (all brands)
│   ├── tablets/                  # GAOMON, HUION, UGEE, WACOM, XENCELABS, XPPEN
│   ├── pens/                     # HUION, SAMSUNG, WACOM, XENCELABS, XPPEN
│   ├── pen-families/             # WACOM
│   ├── tablet-families/          # WACOM
│   ├── pen-compat/               # HUION, SAMSUNG, WACOM, XENCELABS, XPPEN
│   ├── drivers/                  # WACOM
│   ├── pressure-response/        # HUION, SAMSUNG, WACOM, XENCELABS, XPPEN
│   ├── inventory/                # Per-user (sevenpens)
│   └── reference/                # Controlled vocabularies (defect-kinds, paper sizes)
├── lib/
│   ├── schemas.ts                # Valibot schemas (single source of truth for shape + types)
│   ├── drawtab-loader.ts         # URL-based loaders (types re-exported from schemas)
│   ├── drawtab-loader-node.ts    # Filesystem-based loaders (Node.js)
│   ├── loader-shared.ts          # Shared brand lists, expandPenCompat, parseStringArray
│   ├── drawtab-all.ts            # Load everything from URL
│   ├── drawtab-all-node.ts       # Load everything from disk
│   ├── compat-helpers.ts         # Compatibility map builders + findSimilarTablets
│   ├── data-quality.ts           # Schema-driven validation across all entities
│   ├── run-data-quality.ts       # CLI runner for data quality
│   ├── pipeline/                 # Generic query engine
│   │   ├── types.ts              # Step, FieldDef<T> types
│   │   ├── engine.ts             # executePipeline, filter, sort
│   │   └── index.ts              # Barrel re-export
│   ├── entities/                 # Entity field definitions
│   │   ├── tablet-fields.ts
│   │   ├── driver-fields.ts
│   │   ├── pen-fields.ts
│   │   ├── pen-family-fields.ts
│   │   ├── tablet-family-fields.ts
│   │   ├── pen-compat-fields.ts
│   │   ├── pressure-response-fields.ts
│   │   ├── inventory-pen-fields.ts
│   │   └── inventory-tablet-fields.ts
│   └── units.ts                  # Unit conversion (metric/imperial)
├── docs/
│   ├── OVERVIEW.txt
│   ├── FIELDS.txt
│   ├── DATALAYOUT.txt
│   ├── DECISIONS.txt
│   ├── DEFECTS.md                # Defects field and defect-kinds vocabulary
│   ├── USERMANUAL.md
│   └── ARCHITECTURE.md           # This file
├── _config.yml                   # Jekyll config for GitHub Pages
├── README.md
├── tsconfig.json
└── package.json
```

## Data layer (`data/`)

JSON files partitioned by brand. Each file wraps an array under a
top-level key (e.g. `{ "DrawingTablets": [...] }`).

Inventory files are partitioned by user instead of brand.

Pressure response files contain measurement sessions with `[gf, percent]`
data point arrays.

## Loaders

Two loader variants for each environment:

- **URL-based** (`drawtab-loader.ts`) — uses `fetch`, works in browsers and Node 18+
- **Disk-based** (`drawtab-loader-node.ts`) — uses `fs`, Node.js only

Both provide typed interfaces for all entities and return identical types.
Shared metadata (brand lists, `PenCompatGrouped`, `expandPenCompat`,
`parseStringArray`) lives in `loader-shared.ts` and is imported by both
loader variants to avoid duplication.

`drawtab-all.ts` / `drawtab-all-node.ts` load everything in one call
and pre-build compatibility maps.

Inventory loaders take a `userId` parameter instead of loading by brand.

## Helpers

- `compat-helpers.ts` — builds tablet-to-pen and pen-to-tablet maps,
  the included-pen map from `Model.IncludedPen`, and `findSimilarTablets`
  for the tablet detail page's "compare to similar" feature
- `containsText`, `equalsText` — case-insensitive string helpers
- `getDiagonal`, `formatDimensions` — dimension utilities
- `formatValue`, `getFieldLabel` — metric/imperial conversion

## Schemas (`lib/schemas.ts`)

[Valibot](https://valibot.dev) schemas are the single source of truth
for entity shape, validation rules, and TypeScript types. Each entity
type has a strict-object schema that:

- Lists every allowed field (unknown keys are flagged at parse time)
- Marks each field optional / required, with the right primitive type
- Constrains enums via `v.picklist`
- Validates UUIDs and ISO timestamps via piped checks
- Catches whitespace, malformed numbers, and bad UUIDs in one pass

TS types are derived via `v.InferOutput<typeof FooSchema>` and
re-exported from `drawtab-loader.ts` for convenience, so consumers
keep importing `Tablet`, `Pen`, etc. from the loader as before.

The PENTABLET-cannot-have-display-fields rule is enforced as a
`v.rawCheck` on `TabletSchema` instead of a discriminated union, so
downstream code can still read display fields without narrowing.

`data-quality.ts` runs `v.safeParse` over every record in every entity
file and converts schema issues into the existing `Issue` shape.
Cross-record business rules (derived `EntityId` matching, duplicate
`EntityId` detection) live alongside the schema check as small
plain-TS helpers.

## Pipeline engine (`lib/pipeline/`)

Generic query engine with `FieldDef<T>` typed field metadata.
Executes filter/sort/select/take steps against any entity data.

## Entity field definitions (`lib/entities/`)

Per-entity `FieldDef[]` arrays with field metadata, computed fields,
default columns, and default views. Includes:
- Tablets, Pens, Drivers, Pen Families, Tablet Families, Pen Compat
- Pressure Response, Inventory Pens, Inventory Tablets

## npm scripts

| Script         | Command                      | Purpose                |
|----------------|------------------------------|------------------------|
| `data-quality` | `tsx lib/run-data-quality.ts` | Run data quality checks |
| `version-info` | `tsx scripts/generate-version.ts` | Regenerate `data/version.json` |
| `build`        | `tsc`                        | TypeScript compilation  |

## Dependencies

- **valibot** — Schema validation library; powers `lib/schemas.ts` and
  `lib/data-quality.ts`. Chosen over Zod for its smaller footprint
  (~10 KB) with the same ergonomics.
- **typescript** — Type checking
- **tsx** — Runs TypeScript directly (CLI tools)
- **@types/node** — Node.js type definitions

## Versioning (`data/version.json`)

`data/version.json` is a small metadata file that lets consumers
identify exactly which snapshot of the data they're looking at.
It is regenerated by `npm run version-info` (which calls
`scripts/generate-version.ts`) and contains:

- `schemaVersion` — bumped on incompatible schema changes; consumers
  should refuse to load data with an unexpected major
- `version` — date-based string (`YYYY.MM.DD`) derived from the last
  commit's date
- `commit` / `shortCommit` / `commitDate` — git metadata
- `counts` — per-entity record counts, useful as a sanity check that
  the right files were loaded

Consumers fetch it via `loadVersionFromURL(dataBaseUrl)`. The
`VersionInfo` type is inferred from `VersionInfoSchema` in
`schemas.ts` like every other entity.

Per-record `_DataVersion` stamps were considered and rejected:
git history already records who/when/what for every change, and
adding a version field to every record would multiply churn for
marginal value.

## Mental model: not really a database

What lives in this repo isn't a "database" in the conventional sense.
It's better described as a **typed, statically-deployed, read-only
data corpus with schema-validated access**. The closest analogues
are not Postgres or Mongo — they're things like GraphQL with file-
based resolvers, Sanity CMS in static mode, or Astro's content
collections.

This shapes which libraries make sense and which don't:

- **Storage = git-tracked JSON files.** Free version control, free
  diffs, free PR review of data changes, free static deployment.
  Replacing this with a real DB server would forfeit all of that.
- **Schema = valibot.** Single source of truth for shape, validation,
  and TypeScript types. Catches malformed/typo'd data at parse time
  with precise paths and messages.
- **Query layer = the small `lib/pipeline/` engine.** Hand-written
  filter/sort/select/take steps over typed `FieldDef<T>` metadata.
  Tailored to the UI; no third-party query DSL.
- **Reactive bindings = Svelte 5 runes** (`$state`, `$derived`).
  Adding a separate reactive store library would mean two reactive
  systems fighting each other.

## Library decisions (and rejections)

### Adopted

- **Valibot** for schemas — see above. The win was concrete:
  ~280 lines of hand-rolled validation deleted from `data-quality.ts`
  and `drawtab-loader.ts`, plus runtime validation on every load,
  plus a single source of truth for shape and types. The migration
  immediately surfaced four pre-existing data bugs (invalid UUID,
  three pen-family records missing `_id`/dates).

### Considered and rejected (with reasons, so future you remembers why)

- **Arquero** — dplyr-style table ops over arrays of objects. Genuinely
  good for groupby/rollup/joins, but our pipeline is small, typed, and
  tailored to the UI. Replacing it would cost ~50 KB and abandon our
  `FieldDef<T>` metadata. Reconsider only if we start writing the same
  manual `reduce`/`groupBy` logic in multiple places.
- **AlaSQL** — actual SQL over JS arrays. Heavy, poor TypeScript story.
  Skip.
- **LokiJS** — in-memory document DB with Mongo-style queries.
  Designed for exactly this shape, but largely unmaintained. Skip.
- **TinyBase** — relational + reactive store. Speculative for our
  needs; would conflict with Svelte 5 runes. Skip.
- **PGlite / sql.js / wa-sqlite** — real SQL engines compiled to WASM.
  Overkill for a few thousand records and very few join operations.
  Skip unless we hit a specific need for cross-entity joins or
  transactional writes.
- **A real database server** (Postgres, Mongo) — kills the
  "data is just JSON files in a git repo" superpower. Skip.
- **An ORM** (Prisma, Drizzle) — pointless without a backing DB. Skip.

### Potentially worth revisiting later

- **`idb-keyval`** (~1 KB) for persisting user state (saved views,
  column widths, filter preferences) in IndexedDB instead of
  `localStorage`. Only worth it if we hit storage quotas or want
  offline-first PWA behavior. Today, `localStorage` is fine.
- **A small fluent pipeline builder** (`pipeline(tablets).filter(...).
  sort(...).select(...)`). Pure code, no dependency, ~30 lines. Worth
  doing when we start building features that construct pipelines
  programmatically (e.g., user-saved query templates or the
  "user-suggested edits" feature in `FUTURES.txt`).

### Watch for these signals

The architecture is sound today. Two concrete signals would justify
revisiting library choices:

1. **Repeated manual `reduce`/`groupBy` loops.** Time to add either
   Arquero or a small in-house `aggregate()` step on the pipeline.
2. **Real cross-entity joins** (not just lookup maps). Time to add a
   `join()` step on the pipeline, or revisit AlaSQL/PGlite if joins
   become a recurring pattern.

Until those signals appear, the biggest lever for future productivity
is the schema layer we already have — it makes user-driven data edits
(see `FUTURES.txt`) materially safer because every proposed change
can be schema-validated before it lands.
