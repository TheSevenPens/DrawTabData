# Recommendations

Seven Pens' ratings of tablets and pens, the notes that go with them, and
curated lists, kept as data. They live per publisher, like inventory:

| File | Root key | One record is |
|---|---|---|
| `data/recommendations/sevenpens-ratings.json` | `Ratings` | a rating given on a date |
| `data/recommendations/sevenpens-notes.json` | `Notes` | a note about a device |
| `data/recommendations/sevenpens-lists.json` | `Lists` | a device put on a list on a date |

Each record names the tablet or pen by `EntityId` (data quality checks it
exists) and repeats its `Brand`. Schemas are `RatingSchema`,
`RecommendationNoteSchema` and `RecommendationListSchema` in
`lib/schemas.ts`; the dataset exposes them as `ds.Ratings`,
`ds.RecommendationNotes` and `ds.RecommendationLists`.

## Ratings are history, never edited

To re-rate a device, **add** a rating with today's date. Don't change the
old one. The current rating is derived:

- Take the newest rating per `Context`. Imported ratings carry the old docs
  page they came from (`pen-display-recs-medium`, …); new ratings have no
  Context.
- Drop `DELISTED` ones (a device taken off the recommendations).
- The newest of what's left is the current rating. If contexts disagree,
  `currentRating()` reports the conflict.

`currentRating()` in `lib/recommendations.ts` does this; use it rather than
re-deriving.

| Field | Meaning |
|---|---|
| `Rating` | `EXCELLENT`, `VERY GOOD`, `GOOD`, `OK`, `AVOID`, `DELISTED` |
| `OriginalRating` | the label as first published, when since renamed (`DECENT` was merged into `OK` on 2026-11-13) |
| `Context` | the docs page an imported rating came from |
| `Basis` | `SPECS_ONLY` when rated from the published specs before Seven used it |
| `Source` | where the rating came from (`DrawingTabletDocs git history`, `Seven, 2026-11-13`, …) |

Some pen ratings are marked `(placeholder until reviewed)` in `Source`.

## Notes and lists

Notes have a `Kind` (`INFO`, `TIP`, `WARNING`) and plain `Text`. Lists have
one value today, `BEGINNER` (good first tablets).

## Not here yet

Recommendations for product lines that aren't DrawTabData entities (iPads,
Galaxy Tabs, Surface Pro…) and "also sold as" names still live in the
recommendations app (drawtab-recs-demo `recs/`).
