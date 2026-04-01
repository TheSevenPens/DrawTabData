# DrawTabData

Unified JSON datasets and TypeScript libraries for drawing tablets, pens, drivers, and their relationships.

## What's in the box

| Entity | Records | Brands |
|---|---|---|
| Tablets | 283 | HUION, WACOM, XENCELABS, XPPEN |
| Pens | 65 | WACOM |
| Pen Families | 10 | WACOM |
| Tablet Families | 18 | WACOM |
| Pen Compatibility | 59 groups | WACOM |
| Drivers | 246 | WACOM |

## Quick start

### Option 1: Git submodule (recommended)

Pin a specific version of the data in your project:

```bash
git submodule add https://github.com/TheSevenPens/DrawTabData.git data-repo
```

### Option 2: Clone

```bash
git clone https://github.com/TheSevenPens/DrawTabData.git data-repo
```

### Option 3: Copy

Download and copy the `data/` and `lib/` folders directly into your project.

### Option 4: Fetch directly from GitHub

No local files needed — load data at runtime:

```typescript
// From GitHub Pages
const ds = await loadAllFromURL("https://thesevenpens.github.io/DrawTabData/data");

// From raw.githubusercontent
const ds = await loadAllFromURL("https://raw.githubusercontent.com/TheSevenPens/DrawTabData/master/data");
```

### Load everything (Node.js)

```typescript
import { loadAllFromDisk } from "./data-repo/lib/drawtab-all-node.js";

const ds = loadAllFromDisk("./data-repo/data");

console.log(`${ds.tablets.length} tablets`);
console.log(`${ds.pens.length} pens`);
console.log(`${ds.penCompat.length} compatibility pairs`);
```

### Load everything (browser / URL)

```typescript
import { loadAllFromURL } from "./data-repo/lib/drawtab-all.js";

const ds = await loadAllFromURL("https://your-server.com/data");
```

### What you get back

The `ds` object contains:

- `ds.tablets`, `ds.pens`, `ds.penCompat`, `ds.penFamilies`, `ds.tabletFamilies`, `ds.drivers` — all entity arrays
- `ds.tabletToPens` — Map: tablet ModelId to compatible Pen[]
- `ds.penToTablets` — Map: pen PenId to compatible Tablet[]
- `ds.includedPenMap` — Map: pen PenId to Tablet[] that include it

## EntityId

Every record has an `EntityId` that uniquely identifies it: `BRAND.ENTITYTYPE.ID`

- `WACOM.TABLET.PTK870`
- `WACOM.PEN.KP501E`
- `WACOM.DRIVER.6.3.45-2_WINDOWS`
- `WACOM.PENFAMILY.WacomKPGEN3`
- `WACOM.TABLETFAMILY.WacomIntuosProGen8`

## Relating entities

Fields on one entity reference IDs on another:

| Field | On entity | References |
|---|---|---|
| `ModelIncludedPen` | Tablet | PenId on Pen |
| `ModelFamily` | Tablet | FamilyId on TabletFamily |
| `PenFamily` | Pen | FamilyId on PenFamily |
| `TabletId` | PenCompat | ModelId on Tablet |
| `PenId` | PenCompat | PenId on Pen |

## Examples

### Filter Wacom pen displays

```typescript
import { filterByBrand, filterByType } from "./data-repo/lib/drawtab-loader-node.js";

const wacomDisplays = filterByType(filterByBrand(ds.tablets, "WACOM"), "PENDISPLAY");
```

### Compatible pens for a tablet

```typescript
const pens = ds.tabletToPens.get("PTK-870") ?? [];
for (const pen of pens) {
  console.log(`${pen.PenName} (${pen.PenId})`);
}
```

### Compatible tablets for a pen

```typescript
const tablets = ds.penToTablets.get("KP-501E") ?? [];
for (const tablet of tablets) {
  console.log(`${tablet.ModelName} (${tablet.ModelId})`);
}
```

### Search by name

```typescript
import { containsText } from "./data-repo/lib/drawtab-loader-node.js";

const matches = ds.tablets.filter(t =>
  containsText(t.ModelName, "16") && containsText(t.ModelName, "pro")
);
```

### Top 10 largest tablets by diagonal

```typescript
import { getDiagonal, formatDimensions } from "./data-repo/lib/drawtab-loader-node.js";
import { formatValue } from "./data-repo/lib/units.js";

const largest = ds.tablets
  .map(t => ({ tablet: t, diag: getDiagonal(t.DigitizerDimensions) }))
  .filter(({ diag }) => diag !== null)
  .sort((a, b) => b.diag! - a.diag!)
  .slice(0, 10);

for (const { tablet, diag } of largest) {
  const mm = diag!.toFixed(1);
  const inches = formatValue(mm, "mm", "imperial");
  console.log(`${tablet.ModelName} - ${formatDimensions(tablet.DigitizerDimensions)} mm (${mm} mm / ${inches} in diagonal)`);
}
```

### Unit conversion

```typescript
import { formatValue, getFieldLabel } from "./data-repo/lib/units.js";

formatValue("345.5", "mm", "imperial");   // "13.60"
formatValue("1145", "g", "imperial");     // "40.38"
getFieldLabel("Diagonal (mm)", "mm", "imperial");  // "Diagonal (in)"
```

Supported: mm to in, g to oz, LPmm to LPI, px/mm to PPI.

## Helper functions

| Function | Module | Description |
|---|---|---|
| `loadAllFromDisk(dataDir)` | `drawtab-all-node` | Load everything from disk (sync) |
| `loadAllFromURL(baseUrl)` | `drawtab-all` | Load everything from URL (async) |
| `filterByBrand(items, brand)` | `drawtab-loader` | Case-insensitive brand filter (generic) |
| `filterByType(tablets, type)` | `drawtab-loader` | Case-insensitive type filter |
| `containsText(value, search)` | `drawtab-loader` | Case-insensitive substring match |
| `equalsText(value, search)` | `drawtab-loader` | Case-insensitive equality |
| `getDiagonal(dimensions)` | `drawtab-loader` | Compute diagonal from Width/Height |
| `formatDimensions(dimensions)` | `drawtab-loader` | Format as "W x H" or "W x H x D" string |
| `formatValue(value, unit, pref)` | `units` | Convert metric/imperial |
| `getFieldLabel(label, unit, pref)` | `units` | Update label with active unit |
| `buildTabletToPenCompatMap(compat, pens)` | `compat-helpers` | Map: tabletId to Pen[] |
| `buildPenToTabletCompatMap(compat, tablets)` | `compat-helpers` | Map: penId to Tablet[] |
| `buildIncludedPenMap(tablets)` | `compat-helpers` | Map: penId to Tablet[] (included) |

## Data explorer

A live explorer UI is available at **[thesevenpens.github.io/DrawTabDataExplorer](https://thesevenpens.github.io/DrawTabDataExplorer/)**.

Source: [github.com/TheSevenPens/DrawTabDataExplorer](https://github.com/TheSevenPens/DrawTabDataExplorer)

## Data layout

```
data/
  tablets/          HUION, WACOM, XENCELABS, XPPEN
  pens/             WACOM
  pen-families/     WACOM
  tablet-families/  WACOM
  pen-compat/       WACOM (pen -> tablet[] grouped format)
  drivers/          WACOM
```

Files are partitioned by brand: `BRAND-entitytype.json` (e.g. `WACOM-tablets.json`).

## Documentation

- [User Manual](docs/USERMANUAL.md) — detailed guide with all examples
- [Architecture](docs/ARCHITECTURE.md) — project structure and library design
- [Fields](docs/FIELDS.txt) — tablet field definitions with formats and units
- [Data Layout](docs/DATALAYOUT.txt) — JSON file organization
- [Decisions](docs/DECISIONS.txt) — design decision log
- [Futures](docs/FUTURES.txt) — roadmap

## License

ISC
