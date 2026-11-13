"""Import a price workbook into data/prices/<BRAND>-prices.json.

Turns the price research workbook (pen-tablet-and-display-prices.xlsx, first
checked 2026-11-04) into one record per price observation. Records are dated
and never edited: running this on a later workbook only ADDS the observations
that aren't already stored (matched on entity, kind, amount, currency, date
and URL), so the price history accumulates. See docs/PRICES.md.

Kinds:
  LAUNCH   launch MSRP or announced launch price
  RETAIL   dated retail seen around launch or later (not MSRP)
  LIST     later list / compare-at price (not what you pay, not MSRP)
  CURRENT  current advertised new retail on the checked date

Primary marks the record the workbook's summary chose for that kind; the app
shows primary LAUNCH and CURRENT records.

Usage: python scripts/import-prices.py <path to the .xlsx>   (needs openpyxl)
Then: npm run generate -- --write   (refreshes data/version.json)
"""

import datetime
import json
import re
import uuid
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent


def table(wb, name, header_row):
    rows = list(wb[name].iter_rows(values_only=True))
    head = rows[header_row]
    return [dict(zip(head, r)) for r in rows[header_row + 1 :] if r and any(c is not None for c in r)]


def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def date(v):
    if isinstance(v, datetime.datetime):
        return v.date().isoformat(), "day"
    if isinstance(v, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        return v, "day"
    if isinstance(v, str) and re.fullmatch(r"\d{4}-\d{2}", v):
        return v, "month"
    return None, None


def text(v):
    if v is None:
        return None
    s = str(v).strip()
    return None if s in ("", "Unknown", "None") else s


def first_url(v):
    m = re.search(r"https?://\S+", str(v or ""))
    return m.group(0).rstrip(".,;") if m else None


def record(entity, kind, amount, currency, when, checked, seller, market, basis, package, availability, url, note, primary, evidence=None):
    d, prec = date(when)
    c, _ = date(checked)
    return {
        k: v
        for k, v in {
            "EntityId": entity,
            "Brand": entity.split(".")[0].upper(),
            "Kind": kind,
            "Amount": f"{amount:.2f}".rstrip("0").rstrip(".") if isinstance(amount, float) else str(amount),
            "Currency": currency or "USD",
            "Date": d or (c if kind == "CURRENT" else None),
            "DatePrecision": prec or ("day" if c and kind == "CURRENT" else None),
            "CheckedOn": c,
            "Seller": text(seller),
            "Market": text(market),
            "Basis": text(basis),
            "Package": text(package),
            "Availability": text(availability),
            "URL": url,
            "Note": text(note),
            "Primary": primary,
            "EvidenceId": evidence,
            "Source": f"{SOURCE_NAME} (checked {c})",
        }.items()
        if v is not None
    }


def from_wide(rows):
    """Pen tablet sheets: one wide row per tablet."""
    out = []
    for r in rows:
        e = r["Explorer entity ID"]
        launch_url = first_url(r["Launch / early sources"])
        if num(r["Launch MSRP (USD)"]) is not None:
            out.append(record(e, "LAUNCH", r["Launch MSRP (USD)"], "USD", r["Price evidence date"], r["Checked on"], None, "United States", r["Launch / early price kind"], r["Package / model match"], None, launch_url, None, True))
        if num(r["Early retail (USD)"]) is not None:
            out.append(record(e, "RETAIL", r["Early retail (USD)"], "USD", r["Price evidence date"], r["Checked on"], None, "United States", r["Launch / early price kind"], r["Package / model match"], None, launch_url, None, True))
        if num(r["Later list price (USD)"]) is not None:
            out.append(record(e, "LIST", r["Later list price (USD)"], "USD", r["Later list date"], r["Checked on"], None, "United States", "Later list price, not launch MSRP", r["Package / model match"], None, first_url(r["Later list source"]), None, True))
        if num(r["Current listed amount"]) is not None:
            cur = text(r["Currency"]) or "USD"
            out.append(record(e, "CURRENT", r["Current listed amount"], cur, r["Checked on"], r["Checked on"], r["Seller"], "United States" if cur == "USD" else None, r["Current price context"], r["Package / model match"], r["Availability"], first_url(r["Current sources"]), r["Notes"], True))
    return out


CATEGORY = {
    "Launch price": "LAUNCH",
    "Alternative launch price": "LAUNCH",
    "Dated historical retail": "RETAIL",
    "Early discounted retail": "RETAIL",
    "Early Amazon retail": "RETAIL",
    "Current retail": "CURRENT",
    "Alternative current offer": "CURRENT",
    "Current comparison price": "LIST",
}
SUMMARY = {"LAUNCH": "Launch price (USD)", "RETAIL": "Dated retail (USD)", "CURRENT": "Current retail (USD)"}


def from_evidence(displays, evidence):
    """Pen displays: the evidence sheet holds one row per observation."""
    by_id = {e["Evidence ID"]: e for e in evidence}
    out = []
    for d in displays:
        chosen = set()
        for eid in str(d["Evidence IDs"] or "").split(","):
            e = by_id.get(eid.strip())
            if not e or num(e["Amount"]) is None:
                continue
            kind = CATEGORY.get(e["Price category"])
            if not kind:
                continue  # availability checks, supporting sources, unverified candidates
            want = num(d.get(SUMMARY.get(kind, ""), None))
            primary = want is not None and abs(e["Amount"] - want) < 0.005 and kind not in chosen and e["Currency"] == "USD"
            if primary:
                chosen.add(kind)
            seller = e["Seller / publisher"] or e["Source site"]
            when = e["Source date"] if e["Source date"] else e["Checked on"]
            out.append(record(d["Entity ID"], kind, e["Amount"], e["Currency"], when, e["Checked on"], seller, e["Market"], e["Price basis"], e["Condition / package"], e["Availability"], e["Source URL"], e["Qualification"], primary, eid.strip()))
    return out


NS = uuid.UUID("0f3a3c1e-3d0b-4b8e-8f43-5b2f6c1d9e27")
KEY = ("EntityId", "Kind", "Amount", "Currency", "Date", "URL")
SOURCE_NAME = "pen-tablet-and-display-prices.xlsx"


def main():
    global SOURCE_NAME
    SOURCE_NAME = Path(sys.argv[1]).name
    wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
    recs = from_wide(table(wb, "Prices", 6)) + from_wide(table(wb, "Uncertain candidates", 6))
    recs += from_evidence(table(wb, "Pen display prices", 9), table(wb, "Price evidence", 5))
    out_dir = ROOT / "data" / "prices"
    out_dir.mkdir(parents=True, exist_ok=True)
    added = 0
    for brand in sorted({r["Brand"] for r in recs}):
        path = out_dir / f"{brand}-prices.json"
        stored = json.loads(path.read_text(encoding="utf-8"))["Prices"] if path.exists() else []
        have = {tuple(r.get(k) for k in KEY) for r in stored}
        for r in (r for r in recs if r["Brand"] == brand):
            k = tuple(r.get(f) for f in KEY)
            if k in have:
                continue
            have.add(k)
            ts = f"{r['CheckedOn']}T00:00:00.000Z"
            stored.append({**r, "_id": str(uuid.uuid5(NS, json.dumps(k))), "_CreateDate": ts, "_ModifiedDate": ts})
            added += 1
        stored.sort(key=lambda r: (r["EntityId"], r["Kind"], r.get("Date") or "", r["_id"]))
        path.write_text(json.dumps({"Prices": stored}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(f"Added {added} price records under data/prices/.")


if __name__ == "__main__":
    main()
