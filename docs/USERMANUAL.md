# User Manual

This guide shows how to use DrawTabData in your own project.

## Setup

Add DrawTabData as a git submodule:

```bash
git submodule add https://github.com/TheSevenPens/DrawTabData.git data-repo
```

Your project can now import from `data-repo/lib/`.

## EntityId and relating entities

Every record in the dataset has an `EntityId` that uniquely identifies it
across the entire system. The format is `BRAND.ENTITYTYPE.ID`:

- `WACOM.TABLET.PTK870`
- `WACOM.PEN.KP501E`
- `WACOM.DRIVER.6.3.45-2_WINDOWS`
- `WACOM.PENFAMILY.WacomKPGEN3`
- `WACOM.TABLETFAMILY.WacomIntuosProGen8`

EntityIds are how you relate records across entity types — effectively
performing joins. Some fields on one entity reference the ID of another:

| Field | On entity | References |
|---|---|---|
| `ModelIncludedPen` | Tablet | PenId (e.g. `"KP-501E"`) |
| `ModelFamily` | Tablet | FamilyId on TabletFamily (e.g. `"WacomIntuosProGen8"`) |
| `PenFamily` | Pen | FamilyId on PenFamily (e.g. `"WacomKPGEN1"`) |
| `TabletId` | PenCompat | ModelId on Tablet (e.g. `"PTK-870"`) |
| `PenId` | PenCompat | PenId on Pen (e.g. `"KP-501E"`) |

The pen-compat entity is a join table — each row is a (TabletId, PenId)
pair representing that a specific pen works with a specific tablet. To
find all compatible pens for a tablet (or all compatible tablets for a pen),
filter pen-compat rows by the relevant ID, then look up the matching
records in the other entity.

See the examples below for how to do this in code.

## Two loaders

There are two loader modules depending on your environment:

- **`drawtab-loader.ts`** — fetch-based, works in browsers and Node.js 18+.
  Use this when loading data from a URL (your own server, a CDN, etc).

- **`drawtab-loader-node.ts`** — filesystem-based, Node.js only.
  Use this when reading the data files directly from the submodule on disk.

Both provide the same entity loaders and return the same types.

## Loading all entities

### From a URL (fetch-based, async)

Use this when loading data from a hosted server or CDN. The `baseUrl` is the
URL prefix where the JSON files are served. For example, if your files are at
`https://example.com/data/tablets/WACOM-tablets.json`, pass `"https://example.com/data"`.

```typescript
import {
  loadTabletsFromURL, loadPensFromURL, loadPenCompatFromURL,
  loadPenFamiliesFromURL, loadTabletFamiliesFromURL, loadDriversFromURL,
} from "./data-repo/lib/drawtab-loader.js";

const baseUrl = "https://your-server.com/data";

const tablets        = await loadTabletsFromURL(baseUrl);        // 250 tablets
const pens           = await loadPensFromURL(baseUrl);           // 51 pens
const penCompat      = await loadPenCompatFromURL(baseUrl);      // 535 compat rows
const penFamilies    = await loadPenFamiliesFromURL(baseUrl);    // 7 pen families
const tabletFamilies = await loadTabletFamiliesFromURL(baseUrl); // 18 tablet families
const drivers        = await loadDriversFromURL(baseUrl);        // 246 drivers
```

### From disk (Node.js, sync)

Use this when reading the data files directly from the submodule. The `dataDir`
is the path to the `data/` directory — if you added DrawTabData as a submodule
at `data-repo/`, that's `"./data-repo/data"`.

Disk loaders are synchronous — no `await` needed.

```typescript
import {
  loadTabletsFromDisk, loadPensFromDisk, loadPenCompatFromDisk,
  loadPenFamiliesFromDisk, loadTabletFamiliesFromDisk, loadDriversFromDisk,
} from "./data-repo/lib/drawtab-loader-node.js";

const dataDir = "./data-repo/data";

const tablets        = loadTabletsFromDisk(dataDir);
const pens           = loadPensFromDisk(dataDir);
const penCompat      = loadPenCompatFromDisk(dataDir);
const penFamilies    = loadPenFamiliesFromDisk(dataDir);
const tabletFamilies = loadTabletFamiliesFromDisk(dataDir);
const drivers        = loadDriversFromDisk(dataDir);
```

## Filtering tablets by brand

```typescript
import { getBrands, filterByBrand } from "./data-repo/lib/drawtab-loader.js";

// List all brands
const brands = getBrands(tablets);
// => ["HUION", "WACOM", "XENCELABS", "XPPEN"]

// Get only Wacom tablets
const wacomTablets = filterByBrand(tablets, "WACOM");
```

Note: `getBrands`, `filterByBrand`, and `filterByType` are also available
from `drawtab-loader-node.js`.

## Filtering tablets by type

```typescript
import { filterByType } from "./data-repo/lib/drawtab-loader.js";

const penDisplays = filterByType(tablets, "PENDISPLAY");
const penTablets  = filterByType(tablets, "PENTABLET");
```

## Finding a tablet by EntityId

```typescript
const tablet = tablets.find(t => t.EntityId === "WACOM.TABLET.PTK870");
```

## For each tablet, list compatible pens

```typescript
// Build a lookup: tabletId -> set of compatible penIds
const compatMap = new Map<string, Set<string>>();
for (const row of penCompat) {
  const tabletId = row.TabletId as string;
  const penId = row.PenId as string;
  if (!compatMap.has(tabletId)) compatMap.set(tabletId, new Set());
  compatMap.get(tabletId)!.add(penId);
}

// Build a pen lookup by PenId
const penMap = new Map(pens.map(p => [p.PenId as string, p]));

// Print compatible pens for each tablet
for (const tablet of tablets) {
  const compatPenIds = compatMap.get(tablet.ModelId) ?? new Set();
  if (compatPenIds.size === 0) continue;

  console.log(`${tablet.ModelName} (${tablet.ModelId}):`);
  for (const penId of compatPenIds) {
    const pen = penMap.get(penId);
    const penName = pen ? (pen.PenName as string) : penId;
    console.log(`  - ${penName} (${penId})`);
  }
}
```

## For each pen, list compatible tablets

```typescript
// Build reverse lookup: penId -> set of tabletIds
const reverseMap = new Map<string, Set<string>>();
for (const row of penCompat) {
  const tabletId = row.TabletId as string;
  const penId = row.PenId as string;
  if (!reverseMap.has(penId)) reverseMap.set(penId, new Set());
  reverseMap.get(penId)!.add(tabletId);
}

const tabletMap = new Map(tablets.map(t => [t.ModelId, t]));

for (const pen of pens) {
  const penId = pen.PenId as string;
  const compatTabletIds = reverseMap.get(penId) ?? new Set();
  if (compatTabletIds.size === 0) continue;

  console.log(`${pen.PenName} (${penId}):`);
  for (const tabletId of compatTabletIds) {
    const tablet = tabletMap.get(tabletId);
    const name = tablet ? tablet.ModelName : tabletId;
    console.log(`  - ${name} (${tabletId})`);
  }
}
```

## Using the pipeline engine

The pipeline engine lets you filter, sort, and select data programmatically
using composable steps:

```typescript
import { executePipeline } from "./data-repo/lib/pipeline/index.js";
import { TABLET_FIELDS, TABLET_DEFAULT_COLUMNS } from "./data-repo/lib/entities/tablet-fields.js";
import type { Step } from "./data-repo/lib/pipeline/types.js";

const steps: Step[] = [
  { kind: "filter", field: "Brand", operator: "==", value: "WACOM" },
  { kind: "filter", field: "ModelType", operator: "==", value: "PENDISPLAY" },
  { kind: "sort", field: "ModelLaunchYear", direction: "desc" },
  { kind: "take", count: 10 },
];

const result = executePipeline(tablets, steps, TABLET_FIELDS, TABLET_DEFAULT_COLUMNS);
console.log(`Found ${result.data.length} tablets`);
for (const t of result.data) {
  console.log(`  ${t.ModelName} (${t.ModelLaunchYear})`);
}
```

## Unit conversion

Convert field values between metric and imperial:

```typescript
import { formatValue, getFieldLabel } from "./data-repo/lib/units.js";

// Convert mm to inches
formatValue("345.5", "mm", "imperial");   // => "13.60"

// Convert g to oz
formatValue("1145", "g", "imperial");     // => "40.38"

// Get the display label for a field
getFieldLabel("Diagonal (mm)", "mm", "imperial");  // => "Diagonal (in)"

// Metric values pass through unchanged
formatValue("345.5", "mm", "metric");     // => "345.5"
```

Supported conversions:
- mm → in
- g → oz
- LPmm → LPI
- px/mm → PPI
