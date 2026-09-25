# Data Consumers

Projects that consume DrawTabData as a git submodule.

## Consumer list

| Project | Repo | Description | Data submodule commit | Last bumped |
|---|---|---|---|---|
| DrawTabDataExplorer | [TheSevenPens/DrawTabDataExplorer](https://github.com/TheSevenPens/DrawTabDataExplorer) | Interactive explorer UI with filtering, comparison, histograms | `cf424cd` | 2026-04-13 |
| PenPressureData | [TheSevenPens/PenPressureData](https://github.com/TheSevenPens/PenPressureData) | Pressure response curve viewer and comparison tool | `cf424cd` | 2026-04-13 |
| Wacom-Driver-List | [TheSevenPens/Wacom-Driver-List](https://github.com/TheSevenPens/Wacom-Driver-List) | Wacom driver version listing | `cf424cd` | 2026-04-13 |
| DrawTabInventory | [TheSevenPens/DrawTabInventory](https://github.com/TheSevenPens/DrawTabInventory) | Personal pen/tablet inventory viewer | `cf424cd` | 2026-04-13 |

## Updating consumers

After pushing changes to DrawTabData, update each consumer:

```bash
cd <consumer-repo>/data-repo
git pull origin master
cd ..
git add data-repo
git commit -m "Bump data submodule"
git push
```

## What each consumer uses

| Feature | Explorer | PressureData | DriverList | Inventory |
|---|---|---|---|---|
| Tablets | Yes | Yes | — | — |
| Pens | Yes | Yes | — | — |
| Pen Compat | Yes | — | — | — |
| Drivers | Yes | — | Yes | — |
| Tablet Families | Yes | — | — | — |
| Pen Families | Yes | Yes | — | — |
| Pressure Response | Yes | Yes | — | — |
| Inventory | Yes | — | — | Yes |
| Brands | Yes | — | — | — |
| Defect Kinds | — | — | — | Yes |
| ISO Paper Sizes | Yes | — | — | — |
| Schemas (valibot) | Yes | — | — | — |
| Pipeline engine | Yes | — | — | — |
| Entity field defs | Yes | Yes | Yes | — |

## Notes

- DrawTabInventory was converted from a standalone JSON file
  (`db/7p_drawtab_inventory.json`) to the submodule on 2026-04-13.
  It uses field remapping in `index.html` to bridge the schema
  difference.
- All consumers should be on the same DrawTabData commit to avoid
  data drift. When bumping, update all four in one pass.

## Verifying a published snapshot

Tablets, pens and pressure-response sessions are generated from
per-record sources (RFC #45). A
consumer holding published bundles (e.g. the Explorer's Pages site) can
check them against this repository by hand. The published `version.json`
records:

| Field | Meaning |
|---|---|
| `commit` | the DrawTabData commit the bundles were built from |
| `sourceDigest` | digest of every `source/` file at that commit (algorithm in `lib/sources.ts` → `sourceDigest`) |
| `bundles[]` | each generated bundle's `path` (under `data/`), `sha256` and record `count` |

1. **Integrity of what you downloaded:** `sha256sum WACOM-tablets.json`
   must equal that bundle's `bundles[].sha256`.
2. **Reproduce from the recorded commit:**
   ```bash
   git clone https://github.com/TheSevenPens/DrawTabData.git && cd DrawTabData
   git checkout <commit>
   npm ci
   npx tsx scripts/generate.ts     # committed bundles == what the sources produce
   npx tsx -e "import('./lib/sources.ts').then(m => console.log(m.sourceDigest('.')))"   # == sourceDigest
   sha256sum data/tablets/*.json data/pens/*.json                                          # == bundles[].sha256
   ```
3. **Is it current?** Run the digest command on `master` (resolve it to a
   commit first). Same digest → your snapshot matches today's sources,
   even if later commits only touched docs or code. Different digest →
   source records changed since your snapshot.

Hashes prove the bytes match; rebuilding from the pinned commit (step 2)
is the check that the bundles really come from those sources. A
dedicated verification command is planned for later (RFC #45).
