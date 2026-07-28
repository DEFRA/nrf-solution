#!/usr/bin/env bash
# Switch each submodule to its main branch and pull the latest changes.
set -euo pipefail

cd "$(dirname "$0")"

echo "Switching submodules to main and pulling latest..."
echo ""

git submodule foreach --quiet '
  git checkout main
  git pull
  echo "  ✓ $name is on main ($(git rev-parse --short HEAD))"
'
