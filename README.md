# CSV Privacy Cleaner

CSV Privacy Cleaner is a tiny offline web app for cleaning CSV files before they are shared, imported, or sent to a client.

It runs entirely in the browser. CSV data stays on the device.

Created by Dule (`dule-ba`).

## What it does

- Detects comma, semicolon, tab, and pipe delimiters.
- Normalizes messy column names into stable `snake_case` headers.
- Removes exact duplicate rows.
- Masks likely PII columns such as email, phone, name, address, IP, and tax IDs.
- Shows quick column profiling: unique values, blank counts, and row preview.
- Exports a cleaned CSV file.

## Use it

Open `index.html` in a browser, or run a local static server:

```bash
npm start
```

Then open `http://localhost:4173`.

## Development

```bash
npm test
```

The core CSV logic lives in `src/csv-tools.js` and has Node test coverage in `tests/csv-tools.test.mjs`.

## Why this can be useful

Small teams often pass CSV exports between CRMs, ad platforms, no-code tools, and client spreadsheets. This gives them a quick privacy pass without uploading customer data to another service.

## Support

If this saves you time, support the project:

- GitHub Sponsors: https://github.com/sponsors/dule-ba
- Buy Me a Coffee: https://buymeacoffee.com/duleba

## License

MIT
