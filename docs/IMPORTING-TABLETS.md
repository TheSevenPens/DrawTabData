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

## Record structure

Tablet records use nested JSON groups. The top-level keys are:

```
{
  "Meta":       { ... },   -- identity and timestamps
  "Model":      { ... },   -- product classification
  "Digitizer":  { ... },   -- drawing surface (all tablets)
  "Display":    { ... },   -- screen (PENDISPLAY and STANDALONE only)
  "Physical":   { ... },   -- physical dimensions and weight (all tablets)
  "Standalone": { ... }    -- compute/battery/connectivity (STANDALONE only)
}
```

## Required fields

Every tablet record must have these fields:

| Group | Field | Source | Example |
|---|---|---|---|
| Meta | `EntityId` | Construct: `BRAND.TABLET.ModelId` | `XPPEN.TABLET.CD100FH` |
| Meta | `_id` | Generate a UUID v4 | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| Meta | `_CreateDate` | Current ISO timestamp | `2026-04-13T00:00:00.000Z` |
| Meta | `_ModifiedDate` | Same as `_CreateDate` for new records | `2026-04-13T00:00:00.000Z` |
| Model | `Brand` | Known from manufacturer | `XPPEN` |
| Model | `Id` | From product page or model number | `CD100FH` |
| Model | `Name` | From product page | `Artist 10 GEN2` |
| Model | `LaunchYear` | From product page or press release | `2022` |
| Model | `Type` | `PENTABLET`, `PENDISPLAY`, or `STANDALONE` | `PENDISPLAY` |

## Field mapping: product page to JSON

### Digitizer / Active area

| Product page label | JSON field | Unit | Conversion notes |
|---|---|---|---|
| Work Area / Active Area | `Digitizer.Dimensions` | mm | Object: `{ "Width": 224.49, "Height": 126.7 }`. Convert inches to mm if needed (multiply by 25.4) |
| Pressure Levels | `Digitizer.PressureLevels` | — | String: `"8192"` or `"16384"` |
| Tilt | `Digitizer.Tilt` | degrees | String: `"60"` |
| Resolution / LPI | `Digitizer.Density` | LPmm | **Convert LPI to LPmm**: divide by 25.4. E.g. 5080 LPI = `"200"` LPmm |
| Report Rate | `Digitizer.ReportRate` | RPS | String: `"200"` |
| Accuracy (center) | `Digitizer.AccuracyCenter` | mm | String: `"0.5"` |
| Accuracy (corner/edge) | `Digitizer.AccuracyCorner` | mm | String: `"1"` |
| Reading Height / Hover | `Digitizer.MaxHover` | mm | String: `"10"` |
| Touch Support | `Digitizer.SupportsTouch` | — | `"YES"` or `"NO"` |
| Digitizer Type | `Digitizer.Type` | — | `"PASSIVE_EMR"` or `"ACTIVE_EMR"` |

### Display (pen displays only)

| Product page label | JSON field | Unit | Conversion notes |
|---|---|---|---|
| Resolution | `Display.PixelDimensions` | pixels | Object: `{ "Width": 1920, "Height": 1080 }` |
| Panel Type | `Display.PanelTech` | — | Allowed: `IPS`, `TFT`, `AHVA`, `OLED`, `H-IPS`, `MVA` |
| Brightness | `Display.Brightness` | cd/m2 | String: `"250"` |
| Contrast Ratio | `Display.Contrast` | — | String: `"1000"` (for 1000:1) |
| Color Bit Depth | `Display.ColorBitDepth` | bits | Allowed: `"6"`, `"8"`, `"10"`. If page says "16.7 million colors" = 8-bit |
| Color Gamut | `Display.ColorGamuts` | % | Object with named gamuts: `{ "SRGB": 99, "ADOBERGB": 96, "DISPLAYP3": 96 }`. Allowed keys: `SRGB`, `ADOBERGB`, `DCIP3`, `DISPLAYP3`, `NTSC`, `REC709` |
| Lamination | `Display.Lamination` | — | `"YES"` or `"NO"`. "Full lamination" = `"YES"` |
| Anti-Glare | `Display.AntiGlare` | — | Allowed: `"AGFILM"`, `"ETCHEDGLASS"`, `"FILM"` |
| Response Time | `Display.ResponseTime` | ms | String: `"25"` |
| Refresh Rate | `Display.RefreshRate` | Hz | String: `"60"` |
| Viewing Angle | `Display.ViewingAngleHorizontal` / `Display.ViewingAngleVertical` | degrees | String: `"178"` each. Often listed as a single "178 degrees" |

### Physical

| Product page label | JSON field | Unit | Conversion notes |
|---|---|---|---|
| Weight | `Physical.Weight` | grams | String: `"1447"`. Convert kg to g (multiply by 1000) |
| Dimensions | `Physical.Dimensions` | mm | Object: `{ "Width": 442.91, "Height": 279.91, "Depth": 12.9 }`. Width = longest side |

### Model metadata

| Product page label | JSON field | Notes |
|---|---|---|
| Included Stylus / Pen | `Model.IncludedPen` | Array of PenId strings: `["PD21"]`. Look up the pen in `data/pens/BRAND-pens.json` to get the correct PenId |
| Product URL | `Model.ProductLink` | Full URL to product page |
| Target Audience | `Model.Audience` | `"Consumer"`, `"Enthusiast"`, or `"Professional"` |
| Family | `Model.Family` | FamilyId from `data/tablet-families/`. Leave out if no family exists yet |

## Fields to NOT import

These are computed at display time and must not appear in the JSON:

- FullName, Age, Diagonal, Aspect Ratio, Aspect Ratio (fraction),
  Size Category, Display Diagonal, Display Density, Resolution Category

## Display fields on pen tablets

The schema enforces that PENTABLET records cannot have a `Display` group.
If you add a `Display` group to a pen tablet, data quality checks will fail.

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
- **Pen lookup:** The `Model.IncludedPen` value must match a `PenId` in the
  pens dataset, not the pen's display name. Check
  `data/pens/BRAND-pens.json` first.
- **Model.Id consistency:** Check existing tablets from the same brand to
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
  "Meta": {
    "EntityId": "XPPEN.TABLET.CD100FH",
    "_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "_CreateDate": "2026-04-13T00:00:00.000Z",
    "_ModifiedDate": "2026-04-13T00:00:00.000Z"
  },
  "Model": {
    "Brand": "XPPEN",
    "Id": "CD100FH",
    "Name": "Artist 10 GEN2",
    "Type": "PENDISPLAY",
    "LaunchYear": "2022",
    "Family": "XPPenArtistGen2",
    "IncludedPen": ["X3ELITE"],
    "ProductLink": "https://www.xp-pen.com/product/artist-10-2nd-gen.html"
  },
  "Digitizer": {
    "Type": "PASSIVE_EMR",
    "SupportsTouch": "NO",
    "PressureLevels": "8192",
    "Tilt": "60",
    "Density": "200",
    "AccuracyCenter": "0.5",
    "AccuracyCorner": "1",
    "MaxHover": "10",
    "Dimensions": { "Width": 224.49, "Height": 126.7 }
  },
  "Display": {
    "PixelDimensions": { "Width": 1920, "Height": 1080 },
    "ColorGamuts": { "NTSC": 85, "SRGB": 120, "ADOBERGB": 88 },
    "Contrast": "1000",
    "Lamination": "YES",
    "ViewingAngleHorizontal": "178",
    "ViewingAngleVertical": "178"
  },
  "Physical": {
    "Dimensions": { "Width": 299, "Height": 173.3, "Depth": 12.9 }
  }
}
```

Key decisions made during this import:
- LPI 5080 converted to LPmm 200 (5080 / 25.4)
- Pen lookup: "X3 Elite" stylus matched to PenId `X3ELITE` in XPPEN-pens.json
- Physical weight not listed on product page, so omitted
- `DisplayShortcutKeys` was initially added but removed because it's not in the schema
