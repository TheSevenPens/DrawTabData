# Architecture

## Project structure

```
DrawTabData/
├── data/                         # JSON datasets partitioned by brand
│   ├── tablets/                  # HUION, WACOM, XENCELABS, XPPEN
│   ├── pens/                     # WACOM
│   ├── pen-families/             # WACOM
│   ├── tablet-families/          # WACOM
│   ├── pen-compat/               # WACOM (tablet-pen compatibility pairs)
│   └── drivers/                  # WACOM
├── lib/
│   ├── drawtab-loader.ts         # Typed interfaces + data loaders
│   ├── data-quality.ts           # Data validation library
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
│   │   └── pen-compat-fields.ts
│   └── units.ts                  # Unit conversion (metric/imperial)
├── docs/
│   ├── OVERVIEW.txt
│   ├── FIELDS.txt                # Tablet field documentation
│   ├── DATALAYOUT.txt
│   ├── DECISIONS.txt
│   └── ARCHITECTURE.md           # This file
├── tsconfig.json
└── package.json
```

## Data layer (`data/`)

JSON files partitioned by brand. Each file wraps an array under a
top-level key (e.g. `{ "DrawingTablets": [...] }`, `{ "Drivers": [...] }`).

Fields are a mix of flat string values, complex objects (dimensions,
gamuts), and system fields prefixed with `_`. See `docs/FIELDS.txt`.

## Loader (`lib/drawtab-loader.ts`)

- Typed interfaces for all entities (`Tablet`, `Dimensions`, `ColorGamuts`)
- Generic `loadBrandPartitionedData<T>()` fetches and merges brand files
- Entity-specific loaders: `loadTablets()`, `loadDrivers()`, `loadPens()`, etc.
- Accessor helpers: `getBrands()`, `filterByBrand()`, `filterByType()`

## Pipeline engine (`lib/pipeline/`)

Generic query engine usable by any consumer:
- `FieldDef<T>` — typed field metadata with `getValue`, `type`, `group`, `unit`
- `executePipeline<T>()` — runs filter/sort/select/take steps against data
- `getOperatorsForField()` — returns valid operators based on field type

## Entity field definitions (`lib/entities/`)

Per-entity `FieldDef[]` arrays with field metadata, computed fields,
default columns, and default views. Each file exports:
- `*_FIELDS` — field definitions
- `*_FIELD_GROUPS` — group names for column picker
- `*_DEFAULT_COLUMNS` — fallback visible columns
- `*_DEFAULT_VIEW` — default pipeline steps

## Unit conversion (`lib/units.ts`)

Converts between metric and imperial:
- mm → in, g → oz, LPmm → LPI, px/mm → PPI
- `formatValue()` — converts a raw value based on preference
- `getFieldLabel()` — updates column header with active unit

## Data quality (`lib/data-quality.ts`)

Validates tablet data. Run with `npm run data-quality`. Checks:
- Required fields, enum values, numeric fields
- Complex field structure (dimensions, gamuts)
- EntityId consistency, UUID format, date format
- Display fields on pen tablets, unknown fields, whitespace

## npm scripts

| Script         | Command                      | Purpose                |
|----------------|------------------------------|------------------------|
| `data-quality` | `tsx lib/run-data-quality.ts` | Run data quality checks |

## Dependencies

- **typescript** — Type checking
- **tsx** — Runs TypeScript directly (CLI tools)
- **@types/node** — Node.js type definitions
