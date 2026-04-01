# Architecture

## Project structure

```
DrawTabData/
├── data/                         # JSON datasets partitioned by brand
│   └── tablets/                  # Tablet data files (e.g. HUION-tablets.json)
├── lib/                          # TypeScript libraries (shared by explorer and consumers)
│   ├── drawtab-loader.ts         # Typed data loader
│   ├── data-quality.ts           # Data quality validation library
│   └── run-data-quality.ts       # CLI runner for data quality checks
├── explorer/                     # SvelteKit data explorer app
│   ├── src/
│   │   ├── app.html              # HTML shell
│   │   ├── routes/
│   │   │   ├── +layout.ts        # CSR-only, no SSR
│   │   │   └── +page.svelte      # Main page with pipeline UI
│   │   └── lib/
│   │       ├── pipeline.ts       # Pipeline engine, field defs, computed fields
│   │       ├── views.ts          # Saved views (localStorage persistence)
│   │       └── components/       # Svelte components
│   │           ├── FilterStep.svelte
│   │           ├── SortStep.svelte
│   │           ├── SelectStep.svelte
│   │           ├── TakeStep.svelte
│   │           ├── ResultsTable.svelte
│   │           └── SavedViews.svelte
│   └── static/
│       └── tablets/              # Junction -> ../../data/tablets/
├── docs/                         # Project documentation
│   ├── OVERVIEW.txt
│   ├── FIELDS.txt
│   ├── DATALAYOUT.txt
│   ├── DECISIONS.txt
│   └── ARCHITECTURE.md           # This file
├── svelte.config.js              # SvelteKit configuration
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # npm scripts and dependencies
```

## Key layers

### Data layer (`data/`)

Raw JSON files partitioned by brand (e.g. `HUION-tablets.json`). Each file
wraps an array of records under a top-level key (`{ "DrawingTablets": [...] }`).

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

A SvelteKit app (Svelte 5) with a KQL-inspired visual pipeline builder.

**Pipeline engine** (`explorer/src/lib/pipeline.ts`):
- Defines all field metadata including computed fields (Age, diagonals, density)
- Fields are grouped (Model, Digitizer, Display, Physical) for the column picker
- Executes a chain of steps (filter, sort, select, take) against the tablet data

**Saved views** (`explorer/src/lib/views.ts`):
- Named pipeline configurations persisted in localStorage
- A built-in Default view is always available and loads on startup
- Users can create, rename, and delete custom views

**Components**: Each pipeline step type has its own Svelte component with
appropriate controls (enum dropdowns, numeric inputs, grouped checkboxes).

Run with `npm run dev`.

## SvelteKit configuration

The SvelteKit config (`svelte.config.js`) points kit file paths into the
`explorer/` directory:
- `routes` → `explorer/src/routes`
- `lib` → `explorer/src/lib` (accessible as `$lib` in imports)
- `appTemplate` → `explorer/src/app.html`
- `assets` → `explorer/static`

The app uses `adapter-static` with CSR-only rendering (`ssr: false`).

## Data serving

The `data/` directory at the project root is the single source of truth.
A Windows directory junction at `explorer/static/tablets/` points to
`data/tablets/`, so SvelteKit serves the data files without duplication.
The junction contents are gitignored.

## Vite configuration

`server.fs.allow` includes the project root so that Vite can resolve
TypeScript imports from `lib/` which lives outside the SvelteKit root.

## Svelte 5 notes

- Step components use `$bindable()` props so parent can bind to step state
- Svelte 5 reactive proxies cannot be passed to `structuredClone()`;
  use `JSON.parse(JSON.stringify(...))` instead for deep copying

## npm scripts

| Script         | Command                      | Purpose                          |
|----------------|------------------------------|----------------------------------|
| `dev`          | `vite dev`                   | Start the explorer dev server    |
| `build`        | `vite build`                 | Build static site                |
| `preview`      | `vite preview`               | Preview built site               |
| `data-quality` | `tsx lib/run-data-quality.ts` | Run data quality checks          |

## Dependencies

All dependencies are dev-only:

- **svelte** — UI framework (v5)
- **@sveltejs/kit** — Application framework
- **@sveltejs/vite-plugin-svelte** — Vite integration for Svelte
- **@sveltejs/adapter-static** — Static site adapter
- **typescript** — Type checking
- **tsx** — Runs TypeScript files directly (used for CLI tools)
- **vite** — Dev server and bundler
- **@types/node** — Node.js type definitions (for lib/ which uses fs, path)
