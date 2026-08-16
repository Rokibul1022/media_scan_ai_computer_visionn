#!/usr/bin/env bash
# Single-service launcher: runs the Node API + the Python vision service in
# one process. Used when deploying everything to a single Render/other web
# service instead of the two-service render.yaml blueprint.
set -euo pipefail
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  python3 -m uvicorn vision_service:app --host 0.0.0.0 --port "${VISION_PORT:-5070}" --app-dir server &
  echo "[start] vision service on port ${VISION_PORT:-5070}"
fi

cd server
exec node index.js