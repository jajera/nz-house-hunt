# nz-house-hunt

Search NZ houses for sale with area presets and fast in-browser filtering.

Fully static site on GitHub Pages. No server, no proxy, no build tooling beyond
Python's standard library.

## How it works

The realestate.co.nz search API blocks browser requests from other sites (CORS),
so the site does not call it at runtime. Instead the Pages workflow runs
`scripts/build_data.py` on every push and every 3 hours. The script snapshots all
residential sale listings in New Zealand into static JSON:

```text
data/meta.json               build time and counts
data/locations.json          regions, districts, suburbs (with nearby suburbs)
data/listings/<region>.json  compact listings per region
```

The browser loads only the region files a search needs and filters, sorts, and
pages locally. Hidden sale prices (auction, tender, deadline) are captured as
25k price bands, so price filters behave like the upstream search.

## Features

- Every residential sale listing across New Zealand
- Area presets (South Wellington and other Wellington groups, Hutt Valley, and more)
- Region, district, and suburb pickers, with optional nearby suburbs
- Price, beds/baths, garages, floor/land area, pricing method, keyword
- Flags: open home, new build, mortgagee, coastal, pool, floor plan, address
- Light, dark, and system theme toggle
- Shareable URL query parameters

## Layout

```text
index.html             UI shell
css/                   styles
js/                    app, data search, presets, theme
scripts/build_data.py  listing snapshot used by the Pages workflow
```

## Preview locally

```bash
python3 scripts/build_data.py --out data
python3 -m http.server 8765
```

Open http://127.0.0.1:8765 — no proxy required; the page reads `data/`.

## Deploy

Pushes to `main` build the snapshot and deploy to GitHub Pages. Trigger
**Deploy to GitHub Pages** manually to refresh data on demand.

## Notes

Unofficial use of a public website API. Not affiliated with realestate.co.nz.
Respect their terms and rate limits. Keyword search matches title, address,
suburb, district, and property type (not the full description).
