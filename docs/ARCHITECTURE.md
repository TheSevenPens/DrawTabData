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
│   └── inventory/                # Per-user (sevenpens)
├── lib/
│   ├── drawtab-loader.ts         # Typed interfaces + URL-based loaders
│   ├── drawtab-loader-node.ts    # Filesystem-based loaders (Node.js)
│   ├── drawtab-all.ts            # Load everything from URL
│   ├── drawtab-all-node.ts       # Load everything from disk
│   ├── compat-helpers.ts         # Compatibility map builders
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

`drawtab-all.ts` / `drawtab-all-node.ts` load everything in one call
and pre-build compatibility maps.

Inventory loaders take a `userId` parameter instead of loading by brand.

## Helpers

- `compat-helpers.ts` — builds tablet-to-pen and pen-to-tablet maps,
  plus included-pen map from `ModelIncludedPen`
- `containsText`, `equalsText` — case-insensitive string helpers
- `getDiagonal`, `formatDimensions` — dimension utilities
- `formatValue`, `getFieldLabel` — metric/imperial conversion

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
| `build`        | `tsc`                        | TypeScript compilation  |

## Dependencies

- **typescript** — Type checking
- **tsx** — Runs TypeScript directly (CLI tools)
- **@types/node** — Node.js type definitions
