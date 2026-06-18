# Lighting BOM Estimator

A single, fully-offline HTML app for estimating lighting jobs, tracking procurement/shipping, and issuing ship advices. The app runs by **double-clicking the built HTML file** in Edge or Chrome on Windows — no server, no internet, no install.

This repository holds the **editable source** (split into small files) plus a tiny build step that bundles everything back into one offline HTML file in `dist/`.

## How it's organized

```
src/
  index.html        Shell: <head> + body markup + three inject markers
  styles.css        All CSS
  js/
    app.js          All application JavaScript (one global scope)
  vendor/
    xlsx.mini.min.js  SheetJS (Excel export) — committed locally, never a CDN
build.js            Bundles src/ into dist/lighting-bom-estimator.html
dist/
  lighting-bom-estimator.html   The built, double-click-runnable offline file
```

The app JS shares one global scope (no `import`/`export`), so the build just
concatenates the files in `JS_FILES` order (in `build.js`) and inlines the CSS
and vendor library. If you later split `app.js` into several files (e.g.
`state.js`, `calc.js`, `render-estimate.js`, …), add them to the `JS_FILES`
array in dependency order.

## Editing & building

You only need Node.js installed.

```bash
# 1. Edit files under src/ (styles.css, js/app.js, index.html, etc.)

# 2. Rebuild the offline file
node build.js

# 3. Open the result by double-clicking:
#    dist/lighting-bom-estimator.html
```

Do **not** hand-edit `dist/lighting-bom-estimator.html` — it is generated. Edit
the files in `src/` and rebuild.

## Staying offline

- The app makes no network calls and loads no external scripts.
- SheetJS lives in `src/vendor/` and is inlined at build time — never pulled
  from a CDN. Keep it committed.
- The built file in `dist/` is completely self-contained and works with no
  internet connection.

## Notes on data & saving

- Projects save to local `.json` files (File System Access API, with a download
  fallback). Those `.json` files are the master copies you can back up or share.
- The browser also keeps autosave backups and recent-project history in
  `localStorage` on the machine you use.
