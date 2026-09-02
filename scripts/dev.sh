#!/usr/bin/env bash
# Start a disposable, loopback-only Home Assistant with this checkout installed.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .dev-ha
if [ ! -e .dev-ha/custom_components ]; then
  ln -s ../custom_components .dev-ha/custom_components
fi
if [ ! -f .dev-ha/configuration.yaml ]; then
  cp scripts/development.yaml .dev-ha/configuration.yaml
fi
exec .venv/bin/hass --config .dev-ha --log-file .dev-ha/home-assistant.log
