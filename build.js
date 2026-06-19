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

  // 4) Logo — inline src/assets/focus-logo.png as a base64 data URI so the
  //    printed/exported documents show it while the app stays fully offline.
  const logoPath = path.join(SRC, "assets", "focus-logo.png");
  let logoDataUri = "";
  if (fs.existsSync(logoPath)) {
    const b64 = fs.readFileSync(logoPath).toString("base64");
    logoDataUri = "data:image/png;base64," + b64;
  } else {
    console.log("WARN: " + path.relative(ROOT, logoPath) + " not found — building without a logo.");
  }
  html = html.replace(/__LOGO_DATA_URI__/g, () => logoDataUri);

  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(OUT, html, "utf8");

  const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(0);
  console.log("Built " + path.relative(ROOT, OUT) + " (" + kb + " KB)");

  // 5) Copy the optional "standalone app" launchers next to the HTML so the
  //    dist/ folder is a ready-to-distribute bundle. These open the offline
  //    file in its own app window (no browser chrome); the app still runs by
  //    double-clicking the HTML directly if a user prefers.
  const launchSrc = path.join(SRC, "launchers");
  if (fs.existsSync(launchSrc)) {
    for (const name of fs.readdirSync(launchSrc)) {
      const from = path.join(launchSrc, name);
      const to = path.join(DIST, name);
      fs.copyFileSync(from, to);
      if (name.endsWith(".command") || name.endsWith(".sh")) {
        try { fs.chmodSync(to, 0o755); } catch (e) {}
      }
      console.log("Copied launcher " + name);
    }
  }

  // 6) Build the hosted PWA into site/ — same app, plus a manifest + service
  //    worker so it installs like a native app and auto-updates on each release.
  //    (The dist/ file stays a pure file:// app with no service worker.)
  buildSite(html, appJs);
}

const SITE = path.join(ROOT, "site");
function buildSite(html, appJs) {
  const webSrc = path.join(SRC, "web");
  if (!fs.existsSync(webSrc)) return;

  const verMatch = appJs.match(/APP_VERSION\s*=\s*"([0-9.]+)"/);
  const APP_VERSION = verMatch ? verMatch[1] : "0.0.0";

  const headInject =
    '<link rel="manifest" href="manifest.webmanifest">\n' +
    '<meta name="theme-color" content="#14181f">\n' +
    '<link rel="icon" href="icon.svg">\n';

  // Registers the service worker and reloads once when a new version activates.
  const swScript =
    "<script>\n" +
    "if('serviceWorker' in navigator){\n" +
    "  window.addEventListener('load', function(){\n" +
    "    navigator.serviceWorker.register('sw.js').then(function(reg){\n" +
    "      reg.addEventListener('updatefound', function(){\n" +
    "        var nw = reg.installing; if(!nw) return;\n" +
    "        nw.addEventListener('statechange', function(){\n" +
    "          if(nw.state==='installed' && navigator.serviceWorker.controller){ nw.postMessage('skipWaiting'); }\n" +
    "        });\n" +
    "      });\n" +
    "    }).catch(function(){});\n" +
    "    var refreshing=false;\n" +
    "    navigator.serviceWorker.addEventListener('controllerchange', function(){ if(refreshing) return; refreshing=true; location.reload(); });\n" +
    "  });\n" +
    "}\n" +
    "</script>\n";

  // NOTE: the inlined SheetJS library contains the literal strings "</head>"
  // and "</body></html>". The real document's </head> comes first (head is
  // above the body), so replacing the first </head> is safe. But the first
  // </body> in the file is the one *inside* the library string — so we must
  // inject the service-worker script before the LAST </body>, or it lands in
  // the middle of the library and breaks the page.
  let siteHtml = html.replace("</head>", headInject + "</head>");
  const bodyIdx = siteHtml.lastIndexOf("</body>");
  siteHtml = bodyIdx >= 0
    ? siteHtml.slice(0, bodyIdx) + swScript + siteHtml.slice(bodyIdx)
    : siteHtml + swScript;

  if (!fs.existsSync(SITE)) fs.mkdirSync(SITE, { recursive: true });
  fs.writeFileSync(path.join(SITE, "index.html"), siteHtml, "utf8");
  fs.copyFileSync(path.join(webSrc, "manifest.webmanifest"), path.join(SITE, "manifest.webmanifest"));
  fs.copyFileSync(path.join(webSrc, "icon.svg"), path.join(SITE, "icon.svg"));
  const sw = fs.readFileSync(path.join(webSrc, "sw.js"), "utf8").replace(/__APP_VERSION__/g, APP_VERSION);
  fs.writeFileSync(path.join(SITE, "sw.js"), sw, "utf8");
  console.log("Built site/ (PWA, v" + APP_VERSION + ")");
}

build();
