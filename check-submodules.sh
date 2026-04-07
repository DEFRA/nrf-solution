#!/usr/bin/env bash
# Check if each submodule is on the latest commit from its remote main branch.
set -euo pipefail

cd "$(dirname "$0")"

echo "Checking submodules against their remote main branches..."
echo ""

git submodule foreach --quiet '
  # Get the commit SHA checked out locally in this submodule
  local_commit=$(git rev-parse HEAD)
  local_short=${local_commit:0:7}

  # Ask GitHub for the latest commit on the default branch (without fetching)
  remote_commit=$(git ls-remote origin HEAD 2>/dev/null | cut -f1)
  remote_short=${remote_commit:0:7}

  # Compare local vs remote
  if [ "$local_commit" = "$remote_commit" ]; then
    echo "  ✓ $name is up to date ($local_short)"
  else
    echo "  ✗ $name is behind — local: $local_short, remote: $remote_short"
  fi
'

echo ""
echo "To update all submodules: git submodule update --remote --merge"
