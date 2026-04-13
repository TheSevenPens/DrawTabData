# Importing Tablet Specs from Web Pages

Guide for adding a new tablet to the dataset by extracting specs from a
manufacturer product page.

## Workflow

1. Find the product page (xp-pen.com, huion.com, wacom.com, etc.)
2. Extract specs and map them to our field names (see tables below)
3. Look up the included pen's PenId in the existing pen data
4. Add the tablet entry to `data/tablets/BRAND-tablets.json`
5. Run `npm run data-quality` to validate
6. If the pen isn't in the dataset yet, add it to `data/pens/BRAND-pens.json`
7. If the tablet has pen compatibility info, update `data/pen-compat/BRAND-pen-compat.json`

## Required fields

Every tablet record must have these fields:

| Field | Source | Example |
|---|---|---|
| `EntityId` | Construct: `BRAND.TABLET.ModelId` | `XPPEN.TABLET.CD100FH` |
| `Brand` | Known from manufacturer | `XPPEN` |
| `ModelId` | From product page or model number | `CD100FH` |
| `ModelName` | From product page | `Artist 10 GEN2` |
| `ModelLaunchYear` | From product page or press release | `2022` |
| `ModelType` | `PENTABLET`, `PENDISPLAY`, or `STANDALONE` | `PENDISPLAY` |
| `_id` | Generate a UUID v4 | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `_CreateDate` | Current ISO timestamp | `2026-04-13T00:00:00.000Z` |
| `_ModifiedDate` | Same as `_CreateDate` for new records | `2026-04-13T00:00:00.000Z` |

## Field mapping: product page to JSON

### Digitizer / Active area

| Product page label | JSON field | Unit | Conversion notes |
|---|---|---|---|
| Work Area / Active Area | `DigitizerDimensions` | mm | Object: `{ "Width": 224.49, "Height": 126.7 }`. Convert inches to mm if needed (multiply by 25.4) |
| Pressure Levels | `DigitizerPressureLevels` | — | String: `"8192"` or `"16384"` |
| Tilt | `DigitizerTilt` | degrees | String: `"60"` |
| Resolution / LPI | `DigitizerDensity` | LPmm | **Convert LPI to LPmm**: divide by 25.4. E.g. 5080 LPI = `"200"` LPmm |
| Report Rate | `DigitizerReportRate` | RPS | String: `"200"` |
| Accuracy (center) | `DigitizerAccuracyCenter` | mm | String: `"0.5"` |
| Accuracy (corner/edge) | `DigitizerAccuracyCorner` | mm | String: `"1"` |
| Reading Height / Hover | `DigitizerMaxHover` | mm | String: `"10"` |
| Touch Support | `DigitizerSupportsTouch` | — | `"YES"` or `"NO"` |
| Digitizer Type | `DigitizerType` | — | `"PASSIVE_EMR"` or `"ACTIVE_EMR"` |

### Display (pen displays only)

| Product page label | JSON field | Unit | Conversion notes |
|---|---|---|---|
| Resolution | `DisplayPixelDimensions` | pixels | Object: `{ "Width": 1920, "Height": 1080 }` |
| Panel Type | `DisplayPanelTech` | — | Allowed: `IPS`, `TFT`, `AHVA`, `OLED`, `H-IPS`, `MVA` |
| Brightness | `DisplayBrightness` | cd/m2 | String: `"250"` |
| Contrast Ratio | `DisplayContrast` | — | String: `"1000"` (for 1000:1) |
| Color Bit Depth | `DisplayColorBitDepth` | bits | Allowed: `"6"`, `"8"`, `"10"`. If page says "16.7 million colors" = 8-bit |
| Color Gamut | `DisplayColorGamuts` | % | Object with named gamuts: `{ "SRGB": 99, "ADOBERGB": 96, "DISPLAYP3": 96 }`. Allowed keys: `SRGB`, `ADOBERGB`, `DCIP3`, `DISPLAYP3`, `NTSC`, `REC709` |
| Lamination | `DisplayLamination` | — | `"YES"` or `"NO"`. "Full lamination" = `"YES"` |
| Anti-Glare | `DisplayAntiGlare` | — | Allowed: `"AGFILM"`, `"ETCHEDGLASS"`, `"FILM"` |
| Response Time | `DisplayResponseTime` | ms | String: `"25"` |
| Refresh Rate | `DisplayRefreshRate` | Hz | String: `"60"` |
| Viewing Angle | `DisplayViewingAngleHorizontal` / `DisplayViewingAngleVertical` | degrees | String: `"178"` each. Often listed as a single "178 degrees" |

### Physical

| Product page label | JSON field | Unit | Conversion notes |
|---|---|---|---|
| Weight | `PhysicalWeight` | grams | String: `"1447"`. Convert kg to g (multiply by 1000) |
| Dimensions | `PhysicalDimensions` | mm | Object: `{ "Width": 442.91, "Height": 279.91, "Depth": 12.9 }`. Width = longest side |

### Model metadata

| Product page label | JSON field | Notes |
|---|---|---|
| Included Stylus / Pen | `ModelIncludedPen` | Array of PenId strings: `["PD21"]`. Look up the pen in `data/pens/BRAND-pens.json` to get the correct PenId |
| Product URL | `ModelProductLink` | Full URL to product page |
| Target Audience | `ModelAudience` | `"Consumer"`, `"Enthusiast"`, or `"Professional"` |
| Family | `ModelFamily` | FamilyId from `data/tablet-families/`. Leave out if no family exists yet |

## Fields to NOT import

These are computed at display time and must not appear in the JSON:

- FullName, Age, Diagonal, Aspect Ratio, Aspect Ratio (fraction),
  Size Category, Display Diagonal, Display Density, Resolution Category

## Display fields on pen tablets

The schema enforces that PENTABLET records cannot have display fields
(`DisplayPixelDimensions`, `DisplayBrightness`, etc.). If you add
display fields to a pen tablet, data quality checks will fail.

## Common unit conversions

| From (product page) | To (JSON) | Formula |
|---|---|---|
| LPI | LPmm | LPI / 25.4 |
| inches | mm | inches x 25.4 |
| kg | g | kg x 1000 |
| oz | g | oz x 28.35 |

## Common gotchas

- **All numeric fields are strings** in the JSON (e.g., `"8192"` not `8192`),
  except for dimension sub-fields (`Width`, `Height`, `Depth`) and color
  gamut percentages which are numbers.
- **Fields not in the schema will fail validation.** We hit this with
  `DisplayShortcutKeys` — shortcut key count is not a recognized field.
  Run data quality checks before committing.
- **Color gamut key names are specific.** Use `SRGB` not `sRGB`, `ADOBERGB`
  not `AdobeRGB`, `DISPLAYP3` not `Display P3`.
- **Pen lookup:** The `ModelIncludedPen` value must match a `PenId` in the
  pens dataset, not the pen's display name. Check
  `data/pens/BRAND-pens.json` first.
- **ModelId consistency:** Check existing tablets from the same brand to
  match naming patterns (e.g., XP-Pen uses `CD100FH`, `CD120FH` for
  consumer Artist GEN2 line; `MD160QH` for pro GEN2 line).

## Validation

After adding a tablet, run:

```bash
npm run data-quality
```

This validates all fields against the schema. Exit code 0 means no
issues. Any unknown fields, invalid enum values, missing required
fields, or malformed data will be reported.

## Example: adding XP-Pen Artist 10 GEN2

Source: https://www.xp-pen.com/product/artist-10-2nd-gen.html

```json
{
  "EntityId": "XPPEN.TABLET.CD100FH",
  "Brand": "XPPEN",
  "ModelId": "CD100FH",
  "ModelName": "Artist 10 GEN2",
  "ModelType": "PENDISPLAY",
  "ModelLaunchYear": "2022",
  "ModelFamily": "XPPenArtistGen2",
  "ModelIncludedPen": ["X3ELITE"],
  "ModelProductLink": "https://www.xp-pen.com/product/artist-10-2nd-gen.html",
  "DigitizerType": "PASSIVE_EMR",
  "DigitizerSupportsTouch": "NO",
  "DigitizerPressureLevels": "8192",
  "DigitizerTilt": "60",
  "DigitizerDensity": "200",
  "DigitizerAccuracyCenter": "0.5",
  "DigitizerAccuracyCorner": "1",
  "DigitizerMaxHover": "10",
  "DigitizerDimensions": { "Width": 224.49, "Height": 126.7 },
  "DisplayPixelDimensions": { "Width": 1920, "Height": 1080 },
  "DisplayColorGamuts": { "NTSC": 85, "SRGB": 120, "ADOBERGB": 88 },
  "DisplayContrast": "1000",
  "DisplayLamination": "YES",
  "DisplayViewingAngleHorizontal": "178",
  "DisplayViewingAngleVertical": "178",
  "PhysicalDimensions": { "Width": 299, "Height": 173.3, "Depth": 12.9 },
  "_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "_CreateDate": "2026-04-13T00:00:00.000Z",
  "_ModifiedDate": "2026-04-13T00:00:00.000Z"
}
```

Key decisions made during this import:
- LPI 5080 converted to LPmm 200 (5080 / 25.4)
- Pen lookup: "X3 Elite" stylus matched to PenId `X3ELITE` in XPPEN-pens.json
- Physical weight not listed on product page, so omitted
- `DisplayShortcutKeys` was initially added but removed because it's not in the schema
