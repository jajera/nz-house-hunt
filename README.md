# nz-house-hunt

Thin wrapper over [realestate.co.nz](https://www.realestate.co.nz/) sale
listings with area presets. Same data, usually a few hours behind — CI copies
JSON because the browser can’t call their API (CORS). Not affiliated.

## Local preview

```bash
python3 scripts/build_data.py --out data
python3 -m http.server 8765
```

Open http://127.0.0.1:8765
