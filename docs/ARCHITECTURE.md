# Architecture

## Project structure

```
DrawTabData/
├── data/                    # JSON datasets partitioned by brand
│   └── tablets/             # Tablet data files (e.g. HUION-tablets.json)
├── lib/                     # TypeScript libraries
│   ├── drawtab-loader.ts    # Typed data loader (used by consumers)
│   ├── data-quality.ts      # Data quality validation library
│   └── run-data-quality.ts  # CLI runner for data quality checks
├── explorer/                # Data explorer web app
│   ├── index.html           # Entry point
│   └── main.ts              # App logic (imports from lib/)
├── docs/                    # Project documentation
│   ├── OVERVIEW.txt         # Project goals and scope
│   ├── FIELDS.txt           # Field definitions for all entities
│   ├── DATALAYOUT.txt       # Data file organization
│   ├── DECISIONS.txt        # Design decisions log
│   └── ARCHITECTURE.md      # This file
├── vite.config.ts           # Vite dev server configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # npm scripts and dependencies
```

## Key layers

### Data layer (`data/`)

Raw JSON files partitioned by brand (e.g. `HUION-tablets.json`). Each file
wraps an array of records under a top-level key (e.g. `{ "DrawingTablets": [...] }`).

Fields are a mix of flat string values, complex objects (dimensions, gamuts),
and system fields prefixed with `_`. See `docs/FIELDS.txt` for details.

### Library layer (`lib/`)

TypeScript libraries that abstract the data format for consumers.

**drawtab-loader.ts** — The primary consumer-facing library. Provides:
- Typed interfaces for all entities (`Tablet`, `Dimensions`, `ColorGamuts`)
- `loadTablets(baseUrl)` — fetches all brand files and returns a merged array
- Filter helpers: `filterByBrand()`, `filterByType()`, `getBrands()`

Consumers import from this library and never parse JSON directly. This lets
us change the underlying data format without breaking consumers.

**data-quality.ts** — Validation library that checks the dataset for:
- Missing required fields
- Invalid enum values
- Non-numeric values in numeric fields
- Malformed complex fields (dimensions, gamuts)
- EntityId consistency with Brand + ModelId
- Display fields appearing on pen tablets
- Unknown fields, whitespace issues, UUID format, date format
- Duplicate EntityIds across files

Run with `npm run data-quality`.

### Explorer (`explorer/`)

A simple HTML/TypeScript app that uses `drawtab-loader.ts` to display a
sortable, filterable table of tablets. This serves as both a data browser
and a proof-of-concept consumer of the library.

Run with `npm run dev`, then open http://localhost:5173.

## Vite configuration

The explorer uses Vite as a dev server. There are two things worth noting
about the setup:

**Root vs data directory**: Vite's root is set to `explorer/` so that
`index.html` is served directly. However, the data lives in `data/` at the
project root — outside Vite's root. To make the data accessible via HTTP:

1. `publicDir` is set to the project-level `data/` directory. This makes
   Vite serve data files as static assets (e.g. `/tablets/HUION-tablets.json`).

2. `server.fs.allow` includes the project root so that Vite can resolve
   TypeScript imports from `lib/` which also lives outside the explorer root.

**Library imports**: The explorer imports from `../lib/drawtab-loader.ts`.
Vite handles TypeScript transpilation automatically — no build step needed
for development. Note that type-only imports must use the `type` keyword
(e.g. `import { type Tablet }`) because `verbatimModuleSyntax` is enabled
in tsconfig.

## npm scripts

| Script         | Command                      | Purpose                          |
|----------------|------------------------------|----------------------------------|
| `dev`          | `vite`                       | Start the explorer dev server    |
| `data-quality` | `tsx lib/run-data-quality.ts` | Run data quality checks          |

## Dependencies

All dependencies are dev-only:

- **typescript** — Type checking
- **tsx** — Runs TypeScript files directly (used for CLI tools like data-quality)
- **vite** — Dev server for the explorer (handles TS transpilation in-browser)
- **@types/node** — Node.js type definitions (for lib/ which uses fs, path)
