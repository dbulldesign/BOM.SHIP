#!/usr/bin/env node
/*
 * build.js — bundles the /src files into a single, fully-offline HTML file.
 *
 * It reads src/index.html (the shell) and replaces three markers:
 *   - a CSS marker inside the <style> block  -> contents of src/styles.css
 *   - an HTML comment vendor marker          -> the SheetJS library in a <script>
 *   - an HTML comment app marker             -> the concatenated app JS in a <script>
 *
 * The app JS files all share one global scope (no import/export), so they are
 * simply concatenated in dependency order. The result in /dist is a standalone
 * file you can double-click to run offline — no server, no network, no CDN.
 *
 * Usage:  node build.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(DIST, "lighting-bom-estimator.html");

/* The order of these files is the order they are concatenated into the bundle.
 * Because everything shares one global scope, dependencies must come before the
 * code that uses them. Right now the whole app lives in app.js; if you split it
 * into multiple files later, list them here in dependency order, e.g.:
 *   "js/state.js", "js/calc.js", "js/render-estimate.js", ... , "js/init.js"
 */
const JS_FILES = [
  "js/app.js",
];

function read(rel) {
  return fs.readFileSync(path.join(SRC, rel), "utf8");
}

function build() {
  let html = read("index.html");

  // 1) CSS
  const css = read("styles.css").trim();
  html = html.replace("/* INJECT:CSS */", () => css);

  // 2) Vendor (SheetJS). Wrapped in its own <script> tag.
  const vendor = read("vendor/xlsx.mini.min.js").trim();
  html = html.replace(
    "<!-- INJECT:VENDOR -->",
    () => "<script>\n" + vendor + "\n</script>"
  );

  // 3) App JS — concatenate all files in order, wrap in one <script>.
  const appJs = JS_FILES.map((f) => {
    const code = read(f).trim();
    return "/* ===== " + f + " ===== */\n" + code;
  }).join("\n\n");
  html = html.replace(
    "<!-- INJECT:APP -->",
    () => "<script>\n" + appJs + "\n</script>"
  );

  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(OUT, html, "utf8");

  const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(0);
  console.log("Built " + path.relative(ROOT, OUT) + " (" + kb + " KB)");
}

build();
