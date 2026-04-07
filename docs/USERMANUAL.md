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
| `ModelIncludedPen` | Tablet | Array of PenIds (e.g. `["KP-501E"]` or `["PW600", "PW600S"]`) |
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
  loadVersionFromURL,
} from "./data-repo/lib/drawtab-loader.js";

const baseUrl = "https://your-server.com/data";

const version        = await loadVersionFromURL(baseUrl);        // schemaVersion, date, SHA, counts
const tablets        = await loadTabletsFromURL(baseUrl);        // 300 tablets
const pens           = await loadPensFromURL(baseUrl);           // 125 pens
const penCompat      = await loadPenCompatFromURL(baseUrl);      // 535 compat rows
const penFamilies    = await loadPenFamiliesFromURL(baseUrl);    // 13 pen families
const tabletFamilies = await loadTabletFamiliesFromURL(baseUrl); // 18 tablet families
const drivers        = await loadDriversFromURL(baseUrl);        // 246 drivers
```

`loadVersionFromURL` returns a `VersionInfo` object — see
`data/version.json` for the shape, and check `version.schemaVersion`
to refuse loading data with an incompatible schema major.

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
import { buildTabletToPenCompatMap } from "./data-repo/lib/compat-helpers.js";

// Build map once: tabletModelId -> Pen[]
const tabletToPens = buildTabletToPenCompatMap(penCompat, pens);

for (const tablet of tablets) {
  const compatPens = tabletToPens.get(tablet.ModelId) ?? [];
  console.log(`${tablet.ModelName} (${tablet.ModelId}):`);
  for (const pen of compatPens) {
    console.log(`  - ${pen.PenName} (${pen.PenId})`);
  }
}
```

## For each pen, list compatible tablets

```typescript
import { buildPenToTabletCompatMap } from "./data-repo/lib/compat-helpers.js";

// Build map once: penId -> Tablet[]
const penToTablets = buildPenToTabletCompatMap(penCompat, tablets);

for (const pen of pens) {
  const compatTablets = penToTablets.get(pen.PenId) ?? [];
  console.log(`${pen.PenName} (${pen.PenId}):`);
  for (const tablet of compatTablets) {
    console.log(`  - ${tablet.ModelName} (${tablet.ModelId})`);
  }
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

---

## Practical examples

### Load everything and build compatibility maps

The simplest way to get started: one call loads all entities and builds
all compatibility maps.

**From disk:**
```typescript
import { loadAllFromDisk } from "./data-repo/lib/drawtab-all-node.js";

const ds = loadAllFromDisk("./data-repo/data");
```

**From URL:**
```typescript
import { loadAllFromURL } from "./data-repo/lib/drawtab-all.js";

const ds = await loadAllFromURL("https://your-server.com/data");
```

The returned `ds` object contains:
- `ds.tablets`, `ds.pens`, `ds.penCompat`, `ds.penFamilies`, `ds.tabletFamilies`, `ds.drivers`
- `ds.tabletToPens` — Map: tablet ModelId → compatible Pen[]
- `ds.penToTablets` — Map: pen PenId → compatible Tablet[]
- `ds.includedPenMap` — Map: pen PenId → Tablet[] that include it

```typescript
console.log(`Loaded:`);
console.log(`  ${ds.tablets.length} tablets`);
console.log(`  ${ds.pens.length} pens`);
console.log(`  ${ds.penCompat.length} compatibility pairs`);
console.log(`  ${ds.penFamilies.length} pen families`);
console.log(`  ${ds.tabletFamilies.length} tablet families`);
console.log(`  ${ds.drivers.length} drivers`);
console.log(`  ${ds.tabletToPens.size} tablets with known pen compatibility`);
console.log(`  ${ds.penToTablets.size} pens with known tablet compatibility`);
```

### Find all Wacom pens released in the 2010s

```typescript
const pens2010s = pens.filter(p =>
  p.Brand === "WACOM" && p.PenYear >= "2010" && p.PenYear <= "2019"
);

for (const pen of pens2010s) {
  console.log(`${pen.PenName} (${pen.PenId}) - ${pen.PenYear}`);
}
```

### List all Wacom pens that were never included with a tablet

These are pens that had to be purchased separately.

```typescript
import { buildIncludedPenMap } from "./data-repo/lib/compat-helpers.js";

const includedPenMap = buildIncludedPenMap(tablets);
const separatePens = pens.filter(p => !includedPenMap.has(p.PenId));

for (const pen of separatePens) {
  console.log(`${pen.PenName} (${pen.PenId})`);
}
```

### List all tablets that support touch

```typescript
const touchTablets = tablets.filter(t => t.DigitizerSupportsTouch === "YES");

for (const tablet of touchTablets) {
  console.log(`${tablet.ModelName} (${tablet.ModelId}) - ${tablet.Brand}`);
}
```

### List the top 10 largest Wacom tablets by digitizer diagonal

```typescript
import { getDiagonal, formatDimensions, filterByBrand } from "./data-repo/lib/drawtab-loader-node.js";
import { formatValue } from "./data-repo/lib/units.js";

const wacomWithDiag = filterByBrand(tablets, "WACOM")
  .map(t => ({ tablet: t, diag: getDiagonal(t.DigitizerDimensions) }))
  .filter(({ diag }) => diag !== null)
  .sort((a, b) => b.diag! - a.diag!)
  .slice(0, 10);

for (const { tablet, diag } of wacomWithDiag) {
  const mm = diag!.toFixed(1);
  const inches = formatValue(mm, "mm", "imperial");
  const dims = formatDimensions(tablet.DigitizerDimensions);
  console.log(`${tablet.ModelName} (${tablet.ModelId}) - ${dims} mm - diagonal: ${mm} mm / ${inches} in`);
}
```

### List pens for which we have no compatibility info

```typescript
const pensNoCompat = ds.pens.filter(p => !ds.penToTablets.has(p.PenId));

for (const pen of pensNoCompat) {
  console.log(`${pen.PenName} (${pen.PenId})`);
}
```

### List all tablets with "16" and "Pro" in the name

```typescript
import { containsText } from "./data-repo/lib/drawtab-loader-node.js";

const matches = ds.tablets.filter(t =>
  containsText(t.ModelName, "16") && containsText(t.ModelName, "pro")
);

for (const tablet of matches) {
  console.log(`${tablet.ModelName} (${tablet.ModelId}) - ${tablet.Brand}`);
}
```
