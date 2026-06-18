#!/bin/bash
# ============================================================================
#  Lighting BOM Estimator - standalone app launcher (macOS)
#
#  Opens the offline HTML in its OWN app window (no tabs, no address bar) using
#  Google Chrome or Microsoft Edge "app mode". Keep this file in the SAME folder
#  as lighting-bom-estimator.html.
#
#  First run: macOS may block it ("unidentified developer"). Either right-click
#  -> Open, or run once in Terminal:  chmod +x "Lighting BOM Estimator (Mac).command"
# ============================================================================
DIR="$(cd "$(dirname "$0")" && pwd)"
HTML="$DIR/lighting-bom-estimator.html"
URL="file://$HTML"

if [ ! -f "$HTML" ]; then
  echo "Could not find lighting-bom-estimator.html next to this launcher."
  echo "Keep both files together in the same folder."
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi

if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="$URL"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="$URL"
else
  open "$HTML"
fi
