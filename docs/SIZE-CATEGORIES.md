# Size Categories

Drawing tablets are categorized by active area diagonal size. The
categories differ between pen tablets and pen displays because the two
form factors serve different size ranges.

## Pen Tablet Categories

Based on the digitizer active area diagonal.

| Category | Metric (cm) | Imperial (in) | Similar ISO A |
|---|---|---|---|
| TINY | 6 – 16 cm | 2 – 6" | A7 |
| SMALL | 16 – 24 cm | 6 – 9" | A6 |
| MEDIUM | 24 – 36 cm | 9 – 14" | A5 |
| LARGE | 36 – 50 cm | 14 – 20" | A4 |
| EXTRA LARGE | 50 – 74 cm | 20 – 29" | A3 |

## Pen Display Categories

Based on the digitizer active area diagonal (not the marketed screen
size, which is measured differently).

| Category | Metric (cm) | Imperial (in) | Similar ISO A |
|---|---|---|---|
| TINY | 23 – 28 cm | 9 – 11" | A5 |
| SMALL | 28 – 38 cm | 11 – 15" | A4 |
| MEDIUM | 38 – 50 cm | 15 – 20" | A3 |
| LARGE | 50 – 76 cm | 20 – 30" | A2 |
| EXTRA LARGE | 76 – 86 cm | 30 – 34" | A2 |

## Design rationale

- **Ranges are contiguous** — the max of one category equals the min of
  the next, so every tablet falls into exactly one category.
- **Pen tablets start smaller** because they don't need a built-in
  screen. The smallest pen tablets have active areas around 4" diagonal,
  while the smallest pen displays start around 10".
- **ISO A paper comparison** is provided as an intuitive reference point.
  "Similar to A4" is easier to visualize than "36 cm diagonal". The
  match is by diagonal midpoint of the range to the nearest ISO A paper
  diagonal.
- **Metric ranges use round numbers in cm**, and imperial ranges are
  independently defined (not converted from metric) to use round numbers
  in inches.

## Where these are used

- **Tablet detail page** — the size histogram shows range backgrounds
  with category labels, and the digitizer section shows the computed
  Size Category field.
- **Reference page** — the Tablet Sizes tab shows both category tables
  with median values and ISO A comparisons.
- **Compare page** — histograms use the same ranges when showing flagged
  tablet positions.
- **Source of truth** — `src/lib/tablet-size-ranges.ts` in the Explorer
  repo. All three pages import from this single module.
