# Tablet Families

A tablet family groups related models that share a common design
generation — typically the same included pen, similar launch timeframe,
and a consistent naming/model-ID pattern.

## How to identify a family

When adding new tablets, use these heuristics to determine if they
belong to an existing family or warrant a new one:

1. **Included pen** — the strongest signal. Models sharing the same
   included pen are almost always in the same generation.
2. **Model ID prefix** — manufacturers often use a consistent prefix
   within a generation (e.g., XP-Pen's `CD` prefix for Artist GEN2,
   `MD` prefix for Artist Pro GEN2, `MT` for Deco Pro GEN2).
3. **Launch year** — models in a family typically launch within a 1-2
   year window.
4. **Naming pattern** — "GEN2", "V2", "Pro", or a consistent size
   suffix (S/M/L/XL) across the line.

A family should have at least 2 members. A single tablet that doesn't
share traits with others doesn't need a family assignment.

## Current families

### Wacom

| FamilyId | Family Name | Type | Era |
|---|---|---|---|
| WacomSDSeries | Wacom SD series | PENTABLET | 1988 |
| WacomIntuosProGen1 | Wacom Intuos1 series | PENTABLET | 1998 |
| WacomIntuosProGen2 | Wacom Intuos2 series | PENTABLET | 2001 |
| WacomIntuosProGen3 | Wacom Intuos3 series | PENTABLET | 2004 |
| WacomIntuosProGen4 | Wacom Intuos4 series | PENTABLET | 2009 |
| WacomIntuosProGen5 | Wacom Intuos5 series | PENTABLET | 2012 |
| WacomIntuosProGen6 | Wacom Intuos Pro GEN1 | PENTABLET | 2014 |
| WacomIntuosProGen7 | Wacom Intuos Pro GEN2 | PENTABLET | 2017 |
| WacomIntuosProGen8 | Wacom Intuos Pro GEN3 | PENTABLET | 2025 |
| CTx-x60 | Bamboo Pen series | PENTABLET | 2008 |
| CTx-x70 | Bamboo series | PENTABLET | 2010 |
| CTx-x71 | Bamboo Splash / One By Wacom Gen1 | PENTABLET | 2012 |
| CTL-x72 | One By Wacom series | PENTABLET | 2013 |
| CTx-x80 | Intuos Pen / Creative Pen | PENTABLET | 2013 |
| CTx-x90 | Intuos Art/Comic/Draw/Photo | PENTABLET | 2015 |
| CTH-x61 | CTH-x61 series | PENTABLET | 2010 |
| WacomOndPenDisplayGen1 | Wacom One Pen Display Gen 1 | PENDISPLAY | 2020 |
| WacomOndPenDisplayGen2 | Wacom One Pen Display Gen 2 | PENDISPLAY | 2024 |

### XP-Pen

| FamilyId | Family Name | Type | Pen | Model ID pattern | Years |
|---|---|---|---|---|---|
| XPPenArtistGen2 | Artist GEN2 | PENDISPLAY | X3 Elite | CD-prefix | 2022 |
| XPPenArtistPro1 | Artist Pro | PENDISPLAY | PA2 | varies | 2019–2020 |
| XPPenArtistProGen2 | Artist Pro GEN2 | PENDISPLAY | PD21 | MD-prefix | 2023–2024 |
| XPPenDecoFun | Deco Fun | PENTABLET | P01 | CT-prefix | 2021 |
| XPPenDecoPro | Deco Pro | PENTABLET | PA1 | "Deco Pro" | 2019 |
| XPPenDecoProGen2 | Deco Pro GEN2 | PENTABLET | PD21 | MT-prefix | 2023 |
| XPPenDecoX3 | Deco (X3 Elite) | PENTABLET | X3 Elite | IT-prefix | 2021–2022 |

### Huion

| FamilyId | Family Name | Type | Pen | Years |
|---|---|---|---|---|
| HuionInspiroy2 | Inspiroy 2 | PENTABLET | PW110 | 2023 |
| HuionInspioyFrego | Inspiroy Frego | PENTABLET | PW550S | 2024 |
| HuionKamvas2020 | Kamvas (2020) | PENDISPLAY | PW517 | 2020–2021 |
| HuionKamvasGen3 | Kamvas GEN3 | PENDISPLAY | PW600L | 2024–2025 |
| HuionKamvasPro2019 | Kamvas Pro (2019) | PENDISPLAY | PW507 | 2018–2019 |
| HuionKamvasPro2021 | Kamvas Pro (2021) | PENDISPLAY | PW517 | 2021–2022 |

## Data structure

Family definitions live in `data/tablet-families/BRAND-tablet-families.json`.
Each record has:

```json
{
  "EntityId": "XPPEN.TABLETFAMILY.XPPenArtistGen2",
  "Brand": "XPPEN",
  "FamilyId": "XPPenArtistGen2",
  "FamilyName": "XP-Pen Artist GEN2 series",
  "_id": "...",
  "_CreateDate": "...",
  "_ModifiedDate": "..."
}
```

Tablets reference their family via the `ModelFamily` field, which
matches the `FamilyId` on the family record.

## Adding a new family

1. Add the family record to `data/tablet-families/BRAND-tablet-families.json`
2. Set `ModelFamily` on each member tablet in `data/tablets/BRAND-tablets.json`
3. Ensure the brand is listed in `TABLET_FAMILY_BRANDS` in `lib/loader-shared.ts`
4. Run `npm run data-quality` to validate
