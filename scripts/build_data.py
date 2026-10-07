#!/usr/bin/env python3
"""Snapshot NZ residential sale listings into static JSON for the site.

Writes:
  data/meta.json               build time and counts
  data/locations.json          regions, districts, suburbs (with nearby ids)
  data/listings/<region>.json  compact listings per region
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

UPSTREAM = "https://platform.realestate.co.nz/search/v1"
PAGE = 100
# Upstream rejects page[offset] >= 10000.
MAX_WINDOW = 9900
WORKERS = 6

# Upstream filter id -> listing "price-code".
PRICING_FILTER_TO_CODE = {
    8: 8, 3: 5, 4: 6, 7: 7, 2: 3, 6: 4, 16: 16, 11: 11, 5: 2, 13: 13,
}
PROPERTY_TYPE_IDS = {
    "House": 1,
    "Apartment": 2,
    "Townhouse": 4,
    "Unit": 5,
    "Home & Income": 6,
    "Section": 9,
}

FLAG_NEW = 1
FLAG_MORTGAGEE = 2
FLAG_COASTAL = 4
FLAG_POOL = 8
FLAG_FLOORPLAN = 16
FLAG_ADDRESS = 32


def price_bands() -> list[tuple[int, int | None]]:
    edges = list(range(0, 2_000_000, 25_000))
    edges += list(range(2_000_000, 5_000_000, 100_000))
    edges += list(range(5_000_000, 10_000_000, 500_000))
    bands = [(lo, hi - 1) for lo, hi in zip(edges, edges[1:] + [10_000_000])]
    bands.append((10_000_000, None))
    return bands


def get_json(path: str, params: list[tuple[str, str]] | None = None) -> dict:
    url = f"{UPSTREAM}{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "User-Agent": "nz-house-hunt/0.1 (+github actions snapshot)",
        },
    )
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read()
                if resp.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                return json.loads(raw)
        except urllib.error.HTTPError as err:
            if err.code not in (429, 500, 502, 503, 504) or attempt == 5:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 5:
                raise
        time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


def base_params(filters: list[tuple[str, str]], offset: int, limit: int) -> list[tuple[str, str]]:
    return [
        ("page[limit]", str(limit)),
        ("page[offset]", str(offset)),
        ("filter[category][]", "res_sale"),
        *filters,
    ]


def count(filters: list[tuple[str, str]]) -> int:
    data = get_json("/listings", base_params(filters, 0, 1))
    return int(data.get("meta", {}).get("totalResults") or 0)


def fetch_all(filters: list[tuple[str, str]], total: int, pool: ThreadPoolExecutor) -> list[dict]:
    offsets = range(0, min(total, MAX_WINDOW + PAGE), PAGE)
    pages = pool.map(
        lambda off: get_json("/listings", base_params(filters, off, PAGE)).get("data", []),
        offsets,
    )
    return [item for page in pages for item in page]


def load_locations() -> dict:
    data = get_json("/locations")
    regions, districts, suburbs = [], [], []
    for r in data.get("data", []):
        a = r["attributes"]
        regions.append({
            "id": str(r["id"]),
            "title": a["title"],
            "slug": a["slug"],
            "fq": a.get("fq-slug") or a["slug"],
            "districtIds": [str(d["id"]) for d in r.get("relationships", {}).get("districts", {}).get("data", [])],
        })
    for item in data.get("included", []):
        a = item.get("attributes", {})
        entry = {
            "id": str(item["id"]),
            "title": a["title"],
            "slug": a["slug"],
            "fq": a.get("fq-slug") or a["slug"],
            "parentId": str(a.get("parent-id")),
        }
        if item["type"] == "districts":
            districts.append(entry)
        elif item["type"] == "suburbs":
            entry["nearbyIds"] = [
                str(s["id"]) for s in item.get("relationships", {}).get("suburbs", {}).get("data", [])
            ]
            suburbs.append(entry)
    for lst in (regions, districts, suburbs):
        lst.sort(key=lambda x: x["title"])
    return {"regions": regions, "districts": districts, "suburbs": suburbs}


def collect_region(region: dict, districts_by_region: dict, pool: ThreadPoolExecutor) -> list[tuple[str, list[dict]]]:
    """Return [(regionId, raw listings)], splitting by district past the offset cap."""
    filters = [("filter[region][]", region["id"])]
    total = count(filters)
    if total == 0:
        return []
    if total <= MAX_WINDOW + PAGE:
        return [(region["id"], fetch_all(filters, total, pool))]
    out: list[dict] = []
    for district in districts_by_region.get(region["id"], []):
        dfilters = [("filter[district][]", district["id"])]
        dtotal = count(dfilters)
        if dtotal > MAX_WINDOW + PAGE:
            raise SystemExit(f"District {district['title']} has {dtotal} listings; exceeds offset cap")
        if dtotal:
            out.extend(fetch_all(dfilters, dtotal, pool))
    return [(region["id"], out)]


def collect_price_bands(pool: ThreadPoolExecutor) -> dict[str, int]:
    """Map listing id -> lower edge of the upstream (hidden) sale price band."""
    band_of: dict[str, int] = {}

    def run(band: tuple[int, int | None]) -> tuple[int, list[str]]:
        lo, hi = band
        filters = [("filter[saleMin]", str(lo))]
        if hi is not None:
            filters.append(("filter[saleMax]", str(hi)))
        total = count(filters)
        if total > MAX_WINDOW + PAGE:
            raise SystemExit(f"Price band {lo}-{hi} has {total} listings; narrow the bands")
        ids: list[str] = []
        for off in range(0, total, PAGE):
            page = get_json("/listings", base_params(filters, off, PAGE)).get("data", [])
            ids.extend(str(item["id"]) for item in page)
        return lo, ids

    # Bands run in a separate pool so page fetches inside each band stay sequential.
    with ThreadPoolExecutor(WORKERS) as band_pool:
        for lo, ids in band_pool.map(run, price_bands()):
            for listing_id in ids:
                band_of.setdefault(listing_id, lo)
    return band_of


PRICE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?")


def parse_price(display: str) -> int | None:
    m = PRICE_RE.search(display or "")
    if not m:
        return None
    value = float(m.group(1).replace(",", ""))
    suffix = (m.group(2) or "").lower()
    if suffix == "k":
        value *= 1_000
    elif suffix == "m":
        value *= 1_000_000
    return int(value) if value >= 10_000 else None


def land_sqm(area, unit) -> float | None:
    if not area:
        return None
    if str(unit or "").upper() in ("HA", "HECTARES"):
        return float(area) * 10_000
    return float(area)


def next_open_home_end(open_homes: list[dict]) -> str | None:
    ends = [oh.get("end") or oh.get("start") for oh in open_homes or []]
    ends = [e for e in ends if e]
    return max(ends) if ends else None


def compact(item: dict, region_id: str, lookups: dict, band_of: dict[str, int]) -> dict:
    a = item.get("attributes", {})
    addr = a.get("address", {}) or {}
    photo = (a.get("photos") or [None])[0]
    district_id = lookups["district"].get(addr.get("district-fq-slug"))
    suburb_id = lookups["suburb"].get(addr.get("suburb-display-fq-slug")) or lookups["suburb"].get(
        addr.get("suburb-fq-slug")
    )
    display = a.get("price-display") or ""
    band = band_of.get(str(item["id"]))
    shown = parse_price(display)
    if band is not None and shown is not None and not (band <= shown < band + 25_000 or band >= 2_000_000):
        shown = None
    price = shown if shown is not None else band

    flags = 0
    if a.get("is-new-construction"):
        flags |= FLAG_NEW
    if a.get("is-mortgagee-sale"):
        flags |= FLAG_MORTGAGEE
    if a.get("is-coastal-waterfront"):
        flags |= FLAG_COASTAL
    if a.get("has-swimming-pool"):
        flags |= FLAG_POOL
    if a.get("floorplans"):
        flags |= FLAG_FLOORPLAN
    if addr.get("display"):
        flags |= FLAG_ADDRESS

    sub_type = a.get("listing-sub-type")
    return {
        "id": str(item["id"]),
        "t": a.get("header") or "",
        "a": addr.get("display-address") or addr.get("full-address") or "",
        "r": region_id,
        "d": district_id,
        "s": suburb_id,
        "sn": addr.get("suburb-display") or addr.get("suburb") or "",
        "dn": addr.get("district") or "",
        "p": display or "Price on enquiry",
        "pv": price,
        "pc": a.get("price-code"),
        "ty": sub_type,
        "pt": PROPERTY_TYPE_IDS.get(sub_type),
        "b": a.get("bedroom-count"),
        "ba": a.get("bathroom-count") if a.get("bathroom-count") is not None else a.get("bathrooms-total-count"),
        "g": a.get("parking-garage-count"),
        "fa": a.get("floor-area") or None,
        "la": a.get("land-area") or None,
        "lu": a.get("land-area-unit"),
        "lm": land_sqm(a.get("land-area"), a.get("land-area-unit")),
        "img": photo.get("base-url") if photo else None,
        "u": a.get("website-slug"),
        "pub": a.get("published-date"),
        "oh": next_open_home_end(a.get("open-homes")),
        "f": flags,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="data", type=Path)
    args = parser.parse_args()
    out: Path = args.out
    (out / "listings").mkdir(parents=True, exist_ok=True)

    started = time.time()
    locations = load_locations()
    districts_by_region: dict[str, list[dict]] = {}
    for d in locations["districts"]:
        districts_by_region.setdefault(d["parentId"], []).append(d)
    lookups = {
        "district": {d["fq"]: d["id"] for d in locations["districts"]},
        "suburb": {s["fq"]: s["id"] for s in locations["suburbs"]},
    }

    with ThreadPoolExecutor(WORKERS) as pool:
        shards: list[tuple[str, list[dict]]] = []
        for region in locations["regions"]:
            got = collect_region(region, districts_by_region, pool)
            shards.extend(got)
            print(f"  {region['title']}: {sum(len(items) for _, items in got)}", file=sys.stderr)
        print("Tagging price bands…", file=sys.stderr)
        band_of = collect_price_bands(pool)

    counts: dict[str, int] = {}
    total = 0
    unmapped_suburb = 0
    for region_id, items in shards:
        seen: set[str] = set()
        rows = []
        for item in items:
            if str(item["id"]) in seen:
                continue
            seen.add(str(item["id"]))
            row = compact(item, region_id, lookups, band_of)
            if row["s"] is None:
                unmapped_suburb += 1
            rows.append(row)
        rows.sort(key=lambda r: r["pub"] or "", reverse=True)
        (out / "listings" / f"{region_id}.json").write_text(
            json.dumps(rows, separators=(",", ":"), ensure_ascii=False)
        )
        counts[region_id] = len(rows)
        total += len(rows)

    (out / "locations.json").write_text(json.dumps(locations, separators=(",", ":"), ensure_ascii=False))
    meta = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total": total,
        "counts": counts,
        "priced": sum(1 for _ in band_of),
        "pricingFilterToCode": PRICING_FILTER_TO_CODE,
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2))
    print(
        f"Wrote {total} listings in {len(counts)} regions "
        f"({len(band_of)} price-banded, {unmapped_suburb} without suburb id) "
        f"in {time.time() - started:.0f}s",
        file=sys.stderr,
    )
    if total == 0:
        raise SystemExit("No listings fetched")


if __name__ == "__main__":
    main()
