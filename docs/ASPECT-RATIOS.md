# Aspect Ratio Categories

Each tablet's digitizer aspect ratio (longer side / shorter side) is
bucketed into one of a small set of named categories — useful for
analysis, filtering, and grouping.

## Popular ratios

The categorizer checks the measured ratio against six popular ratios.
Anything that doesn't fall close enough to any of them lands in `OTHER`.

| Canonical | Decimal | Notes |
|---|---|---|
| 16:9  | 1.7778 | Dominant for pen displays |
| 16:10 | 1.6000 | Dominant for pen tablets |
| 3:2   | 1.5000 | Older Wacom Intuos1/2 generations |
| 4:3   | 1.3333 | Pre-2010 Wacoms (Graphire, early Bamboo, PenPartner) |
| 5:4   | 1.2500 | Some older PL Cintiqs (1280×1024) |
| 1:1   | 1.0000 | Square, rare for tablets |

## Closeness tiers

For each measured ratio, the categorizer finds the *nearest* popular
ratio (ties broken by the order above), then assigns a closeness tier
based on the absolute difference:

| Suffix | Max \|actual − target\| | Approx % deviation | Intent |
|---|---|---|---|
| `_EXACT`     | ≤ 0.005 | ≤ 0.3% | Panel was spec'd to that ratio |
| `_VERYCLOSE` | ≤ 0.02  | ≤ 1.2% | Engineered to that ratio with rounding noise |
| `_CLOSE`     | ≤ 0.05  | ≤ 3%   | "In the spirit of" but the panel isn't quite there |
| (else)       | —       | —      | `OTHER` |

The `_VERYCLOSE` boundary at 0.02 lines up with the snap threshold the
existing `aspectRatioLabel()` helper uses when picking display labels
like `"16:10"` vs `"39:25"` — so anything labeled with a popular ratio
elsewhere in the app is also categorized as at least `_VERYCLOSE`.

## Full category list (19)

Sort order (left-to-right, top-to-bottom): popular ratios in declared
order, each followed by EXACT → VERYCLOSE → CLOSE; `OTHER` last.

```
16X9_EXACT,  16X9_VERYCLOSE,  16X9_CLOSE,
16X10_EXACT, 16X10_VERYCLOSE, 16X10_CLOSE,
3X2_EXACT,   3X2_VERYCLOSE,   3X2_CLOSE,
4X3_EXACT,   4X3_VERYCLOSE,   4X3_CLOSE,
5X4_EXACT,   5X4_VERYCLOSE,   5X4_CLOSE,
1X1_EXACT,   1X1_VERYCLOSE,   1X1_CLOSE,
OTHER
```

## Where these are used

- **Computed field** `DigitizerAspectRatioCategory` on every tablet
  (data-repo/lib/entities/tablet-fields.ts). Available as a column,
  sort key, or filter in the Tablets list and any other entity-explorer
  view that surfaces it.
- **Analysis page** in the Explorer (`/tablet-analysis`) — under the *Aspect
  Ratio* category, the *Pen Tablets — by Category* and *Pen Displays —
  by Category* sections show the distribution.
- **Source of truth** — `data-repo/lib/aspect-ratio.ts`. Both the
  computed field and the analysis page import `aspectRatioCategory`
  and `ASPECT_RATIO_CATEGORIES` from there.

## Tie-breaking

When a measured ratio is equidistant from two popular ratios (e.g. a
panel with a true 5:3 = 1.667 ratio sits exactly between 16:10 = 1.6
and 16:9 ≈ 1.778), the one **earlier in `POPULAR_RATIOS`** wins. The
order — `16X9, 16X10, 3X2, 4X3, 5X4, 1X1` — prefers the most common
ratio first, so 5:3-ish panels typically categorize as `16X9_CLOSE`.

## Why not include 5:3 or 21:9?

- **5:3** (1.667) sits between 16:10 and 16:9. Some older Wacom
  Bamboos are nominally 5:3 but their digitizer measurements often
  round into a neighbor anyway. Adding it would create three
  categories that capture few records. Treating these as
  `16X10_CLOSE` or `16X9_CLOSE` is honest.
- **21:9** (2.333) — relevant only when a true ultrawide pen display
  appears in the dataset. Not worth the categories until then.

Either can be added later by appending to `POPULAR_RATIOS` in
`lib/aspect-ratio.ts`; the rest of the system picks them up
automatically.
