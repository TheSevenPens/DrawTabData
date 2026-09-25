# Data Consumers

**Audience:** contributors and data consumers.

Projects that consume DrawTabData as a git submodule.

## Consumer list

| Project | Repo | Description |
|---|---|---|
| DrawTabDataExplorer | [TheSevenPens/DrawTabDataExplorer](https://github.com/TheSevenPens/DrawTabDataExplorer) | Interactive explorer UI with filtering, comparison, histograms |
| PenPressureData | [TheSevenPens/PenPressureData](https://github.com/TheSevenPens/PenPressureData) | Pressure response curve viewer and comparison tool |
| Wacom-Driver-List | [TheSevenPens/Wacom-Driver-List](https://github.com/TheSevenPens/Wacom-Driver-List) | Wacom driver version listing |
| DrawTabInventory | [TheSevenPens/DrawTabInventory](https://github.com/TheSevenPens/DrawTabInventory) | Personal pen/tablet inventory viewer |

Read current consumer pins from their Git trees (`git ls-tree HEAD data-repo`),
not a manually maintained table.

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

Tracked `data/version.json` describes content deterministically and is generated
and drift-checked with bundles. It contains no Git commit or build time.
Publication adds provenance without modifying that tracked file:

| Artifact | Content |
|---|---|
| Git/raw `data/version.json` | Counts, files, indexes, source digest, generated bundle hashes, versions |
| Explorer public `version.json` | Content plus data commit/date, dirty provenance and app/build information |
| npm `drawtabdata/snapshot` | `package-snapshot.json` created by prepack with data commit/date and dirty provenance; bundles remain under `data/` |

CI rejects publication with dirty source, data, library, scripts, package or
relevant configuration inputs. Local builds warn and set `provenance.dirty`
with affected paths. A dirty snapshot cannot claim clean-commit reproduction.
Documentation-only changes do not dirty data provenance.

### Verification contract (version 1)

| Field | Meaning |
|---|---|
| `generatorVersion` | Source-to-bundle semantics; bump when those semantics change |
| `verification.version` | Digest and bundle-verification contract version |
| `verification.covers` | `source/tablets`, `source/pens`, `source/pressure-response` |
| `verification.bundleRootKeys` | tablets → DrawingTablets; pens → Pens; pressure-response → PressureResponse |
| `sourceDigest` | SHA-256 of the source listing described below |
| `bundles[]` | Paths relative to `data/`, exact-byte SHA-256 and record count |
| `provenance` | Publication commit, dirty flag and optional dirty paths |

The source digest enumerates JSON files recursively under `source/` in plain
code-unit path order, with forward-slash paths relative to the repository.
Normalize CRLF to LF in each UTF-8 source and compute its lowercase hex SHA-256.
Concatenate `path + NUL + fileHash + LF` for every file and SHA-256 that UTF-8
listing. Empty source collections are valid when explicitly present. Bundle
hashes cover exact bytes, without newline normalization.

Coverage includes the three migrated collections. Grouped drivers, inventory,
compatibility and reference JSON are listed in the file manifest and validated
by data-quality, but are **not** covered by sourceDigest or generated-bundle
reproduction. Hashes prove consistency, not publisher identity.

### With the tool

~~~bash
git clone https://github.com/TheSevenPens/DrawTabData.git
cd DrawTabData
npm ci
npm run verify-snapshot -- https://thesevenpens.github.io/DrawTabDataExplorer/version.json --fetch
~~~

For raw/tracked metadata, name the commit containing it. For a package, use its
companion manifest and data directory:

~~~bash
npm run verify-snapshot -- data/version.json --commit HEAD --ref HEAD
npm run verify-snapshot -- /path/to/node_modules/drawtabdata/package-snapshot.json --bundles /path/to/node_modules/drawtabdata/data --fetch
~~~

| Check | Question | Outcomes |
|---|---|---|
| integrity | Do bundle bytes/counts match the manifest? | ok, mismatch, unable |
| reproduce | Do the recorded commit's sources regenerate those bundles and digest? | reproduced, mismatch, unable |
| freshness | Does that source content match the chosen reference? | current, historical, not-on-ref, unable |

`--bundles` defaults to the directory/URL next to the manifest; `--json` returns
structured results. `--ref` defaults to cached origin/master (or HEAD when
absent). Without `--fetch` this comparison uses locally cached refs.
`--fetch` refreshes remote-tracking refs, never a local branch. If fetching
fails, upstream freshness is **unable**, a separately labelled `freshness.cached`
comparison may still appear, and exit status is 2 unless a real integrity or
reproduction mismatch already requires 1. Cached CURRENT does not establish
current upstream state.

Exit 0 means intact and reproduced; historical freshness alone is not a failure.
Exit 1 means a mismatch. Exit 2 means integrity/reproduction could not run, or
requested upstream freshness could not be established. Missing commits, dirty
inputs and unsupported generator/verification versions report unable. The tool
does not execute historical generator code. For an unsupported version, use the
matching tool from the recorded commit in a separate checkout. Legacy manifests
without version fields retain version-1 behavior.

### By hand

1. Compare downloaded bundle SHA-256 hashes and counts with the manifest.
2. Check out the publication commit separately, install dependencies and run
   `npm run generate`. Compare its bundle hashes and sourceDigest with the
   publication manifest.
3. Fetch upstream and compare source digests against an explicitly resolved
   master commit. Equal digests mean equal covered source content, even when
   intervening commits changed only documentation or code.
