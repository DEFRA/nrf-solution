#!/usr/bin/env bash
#
# Run the journey-tests (Playwright + Cucumber) suite on the HOST against the
# Tilt stack. Invoked by the Tilt "journey-tests" resource / Run button.
#
# The browser runs on the host so it reaches the frontend (localhost:3000) and
# the cdp-uploader form action (localhost:7337) exactly as a real user's browser
# does — the upload journey then works with no container networking hacks.
#
# Env (all optional):
#   E2E_HEADFUL  true → show the browser window (default: false, headless)
#   BROWSER      chromium | firefox | webkit (default: chromium)
#   TAGS         Cucumber tag expression, e.g. "@smoke" (default: all scenarios)
#   PARALLEL     number of parallel workers; 1 (or 0) runs sequentially
#                (default: the suite's cucumber.js setting; Tilt defaults to 5)
#   FEATURE      a single .feature filename to run, or "All"/empty for the whole
#                suite. The Tilt button builds this list from the feature files.
set -euo pipefail

cd "$(dirname "$0")/journey-tests"

# Install deps + browsers on first run (node_modules is gitignored).
if [ ! -x node_modules/.bin/cucumber-js ]; then
  echo "Installing journey-tests dependencies…"
  npm ci
fi

export BASE_URL="http://localhost:3000"
export BROWSER="${BROWSER:-chromium}"

args=()
[ -n "${TAGS:-}" ] && args+=(--tags "$TAGS")

# Worker count overrides the suite's default. 1 runs scenarios sequentially in
# the main process (--parallel 0), which is easier to debug.
if [ -n "${PARALLEL:-}" ]; then
  if ! [[ "$PARALLEL" =~ ^[0-9]+$ ]]; then
    echo "PARALLEL must be a whole number, got: $PARALLEL" >&2
    exit 1
  fi
  [ "$PARALLEL" -le 1 ] && PARALLEL=0
  args+=(--parallel "$PARALLEL")
fi

# Run a single feature when one is selected. The suite's cucumber.js profile
# hardcodes `paths`, which overrides any positional path arg — so to target one
# feature we generate a throwaway config that extends the real one and pins
# `paths`. It lives in the suite dir (the base config's relative import needs
# that) and is removed on exit, keeping the submodule working tree clean.
override_config=""
cleanup() { [ -n "$override_config" ] && rm -f "$override_config"; }
trap cleanup EXIT

if [ -n "${FEATURE:-}" ] && [ "$FEATURE" != "All" ] && [ "$FEATURE" != "Run all features" ]; then
  feature_path="test/features/$FEATURE"
  if [ ! -f "$feature_path" ]; then
    echo "Feature not found: $feature_path" >&2
    exit 1
  fi
  override_config="cucumber.tilt-single.mjs"
  cat > "$override_config" <<EOF
import base from './cucumber.js'
export default { ...base, paths: ['$feature_path'] }
EOF
  args+=(--config "$override_config")
fi

if [ "${E2E_HEADFUL:-false}" = "true" ]; then
  # Headful Playwright Chromium has a real GPU, so the draw-boundary journey's
  # WebGL map renders (the headless shell shows a fallback). Not the system
  # Chrome channel: it took ~14s to load the map page here versus <1s.
  export E2E_HEADFUL=true
fi

npm run clean

status=0
node --env-file-if-exists=.env.local node_modules/.bin/cucumber-js ${args[@]+"${args[@]}"} || status=$?

# Always generate the Allure report, even on failure.
npm run report || true
echo "Report: journey-tests/allure-report/index.html"

exit $status
