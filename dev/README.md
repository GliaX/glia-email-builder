# Dev harness

A standalone browser harness for the Email Builder, without a Frappe bench.

```bash
python3 dev/build_harness_data.py
cd dev/harness
python3 -m http.server 8808
```

Open:

- **Start screen** — <http://127.0.0.1:8808/>
- **Editor** — <http://127.0.0.1:8808/?template=Newsletter%20-%20Impact%20Update>

`build_harness_data.py` renders the real seed templates with the same Python
renderer used in production and writes `mock-data.js` (ignored by git) plus a
copy of the page stylesheet. `mock-frappe.js` stubs `frappe.call` and
`frappe.set_route` so the UI can be exercised end to end (including save,
preview, library, images and sample send) without a database.

The harness is a development aid only. It is not installed with the app and does
not ship in the Frappe image (`dev/` is outside the Python package, though it is
inside the app root).

## Screenshots

The README screenshots in `docs/screenshots/` were captured from this harness.
