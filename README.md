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

## Distributing to users

The whole app is one self-contained file: `dist/lighting-bom-estimator.html`.
To give it to people, send them that file (or the zipped bundle from the latest
GitHub Release). They run it three ways, all fully offline:

1. **Double-click the HTML** — opens in their default browser. Simplest.
2. **Standalone app window** — double-click one of the launchers shipped next to
   the HTML in `dist/`:
   - `Lighting BOM Estimator (Windows).cmd`
   - `Lighting BOM Estimator (Mac).command`
   These open the app in its **own window** (no tabs, no address bar) via Edge/
   Chrome "app mode", so it feels like an installed program — with nothing extra
   to install. On Windows, right-click the launcher → *Pin to taskbar* (or make a
   Desktop/Start shortcut) for one-click launching. Keep the launcher in the same
   folder as the HTML.

> Why not a real `.exe`? A double-click HTML file is the only format that's
> standalone, fully offline, AND universal (Windows, Mac, any browser) with zero
> install and no security warnings. A wrapped `.exe` (Electron/Tauri) is possible
> later but adds ~100 MB downloads, Windows-only binaries, code-signing, and
> ongoing maintenance.

## Updates

The app knows its own version (`APP_VERSION` in `src/js/app.js`) and shows it as
a `v1.0.0` badge in the header. When the machine is **online**, it quietly checks
the repo's GitHub Releases on launch; if a newer version exists it shows a banner
with a **Download** button that pulls the new `.html` file directly (no GitHub
page). Users save it over their old file and reopen. Offline, the check simply
does nothing — the app still runs normally. Clicking the version badge re-checks
on demand.

> A double-click HTML file runs in the browser sandbox and **cannot silently
> overwrite itself** on disk (no local app can without an installer). So updating
> is: click Download → save the new file over the old one. Because the launchers
> always point at the same filename, that's a one-time drag-and-drop.

### Publishing a new version

1. Bump `APP_VERSION` in `src/js/app.js` (e.g. `"1.1.0"`).
2. `node build.js`, then commit (keeps `dist/` in sync).
3. Tag and push: `git tag v1.1.0 && git push origin v1.1.0`.

The **Build & Release** GitHub Action (`.github/workflows/release.yml`) then
builds the offline file and attaches it (plus a zipped bundle with the launchers)
to a GitHub Release. The in-app update check reads that release automatically, so
existing users are notified next time they're online. Keep the tag (`v1.1.0`) and
`APP_VERSION` (`1.1.0`) matching.

## Notes on data & saving

- Projects save to local `.json` files (File System Access API, with a download
  fallback). Those `.json` files are the master copies you can back up or share.
- The browser also keeps autosave backups and recent-project history in
  `localStorage` on the machine you use.
