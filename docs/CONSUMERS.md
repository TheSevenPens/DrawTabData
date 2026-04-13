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
