#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

ln -sfn frontend nrf-frontend
ln -sfn backend nrf-backend
ln -sfn impact-assessor nrf-impact-assessor

echo "Symlinks created:"
ls -l nrf-frontend nrf-backend nrf-impact-assessor
