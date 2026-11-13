# Prices

Dated price observations for tablets: `data/prices/<BRAND>-prices.json`,
root key `Prices`, schema `PriceSchema` in `lib/schemas.ts`, dataset
collection `ds.Prices`.

One record is **one price seen**: a store listing on a date, or a launch
announcement. Records are never edited. A later price check adds records,
so the history of a device's price accumulates.

| Field | Meaning |
|---|---|
| `Kind` | `LAUNCH` launch MSRP or announced price · `RETAIL` dated store price, not MSRP · `LIST` later list / compare-at price · `CURRENT` advertised new retail price on the date checked |
| `Amount`, `Currency` | the price as listed, string-encoded; never converted |
| `Date`, `DatePrecision` | when the price applied (`YYYY-MM-DD` or `YYYY-MM`); missing when the source gives no date |
| `CheckedOn` | when the researcher looked |
| `Seller`, `Market`, `URL` | where it was seen |
| `Basis`, `Package`, `Availability`, `Note` | the researcher's qualifications |
| `Primary` | the record the research picked as the headline price of its Kind |
| `EvidenceId`, `Source` | the workbook row and workbook it came from |

## Reading them

`lib/recommendations.ts`:

- `currentPrice(prices, "USD")`: the newest `CURRENT` price in that currency.
- `launchPrice(prices, "USD")`: the `LAUNCH` price, or failing that the
  earliest dated `RETAIL` price.

When showing a price, show its date and seller with it. A price is what a
store listed on that day: it doesn't include sales, promotions or
discounts, and prices differ by country. Most records are U.S. prices in
USD; a few are other markets and currencies.

## Importing

`scripts/import-prices.py` reads the price-research workbook and appends
the observations not already stored. See [SCRIPTS.md](SCRIPTS.md#import-prices).
The first import (checked 2026-11-04) covers 172 pen tablets and pen
displays; pens and standalones aren't priced yet.
