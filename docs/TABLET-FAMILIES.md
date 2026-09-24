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
3. **Release year** — models in a family typically launch within a 1-2
   year window.
4. **Naming pattern** — "GEN2", "V2", "Pro", or a consistent size
   suffix (S/M/L/XL) across the line.

A family should have at least 2 members. A single tablet that doesn't
share traits with others doesn't need a family assignment.

## Current families

Not listed here on purpose — a hand-maintained table went stale (it still
showed 18 families under an old id scheme when the data had 59). List
them from the data instead:

```bash
npx tsx scripts/show-family.ts                 # every family: EntityId + name
npx tsx scripts/show-family.ts xppenartistgen2 # one family's member tablets
npx tsx scripts/find-unfamilied.ts --brand XPPEN
```

The Explorer's `/tablet-families` page shows the same list.

## Data structure

Family definitions live in `data/tablet-families/<BRAND>-tablet-families.json`:

```json
{
  "EntityId": "xppen.tabletfamily.xppenartistgen2",
  "Brand": "XPPEN",
  "FamilyName": "XP-Pen Artist GEN2 series",
  "ModelPattern": "CD-prefix",
  "_id": "...",
  "_CreateDate": "...",
  "_ModifiedDate": "..."
}
```

`ModelPattern` is optional. There is no separate `FamilyId`: the
**EntityId is the family's identity**, and it follows the
`brand.tabletfamily.familyid` format (lowercase).

Tablets reference their family with `Model.Family`, whose value is the
family **EntityId** — not the `FamilyName`. The data-quality check
flags any `Model.Family` that doesn't match a family record.

## Adding a new family

1. Add the family record to `data/tablet-families/<BRAND>-tablet-families.json`
   (edit with `readDataJson` / `writeDataJson` — see DATALAYOUT.txt § FILE FORMAT).
2. Assign members: `npx tsx scripts/set-family.ts <family> <ModelId|EntityId> ...`
   — `<family>` may be the EntityId or its last segment.
3. Check: `npx tsx scripts/show-family.ts <family>`, then `npm run data-quality`.
