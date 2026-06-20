# Assets

Put **`focus-logo.png`** in this folder (a transparent PNG works best).

The build (`node build.js`) inlines it as a base64 data URI into the offline
HTML and the hosted app, so it shows on printed/exported documents while the app
stays fully offline. No code changes needed — just drop the file here named
exactly `focus-logo.png` and commit it.

Easiest way (no terminal): on GitHub, open this folder → **Add file → Upload
files** → drag your `focus-logo.png` in → **Commit**. The next release/Pages
build will include it automatically.
