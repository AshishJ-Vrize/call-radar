#!/usr/bin/env bash
# One-shot: schema + transcripts + analysis for a demo-sized subset.
# From call-radar/ with the venv's python on PATH (or edit PY below).
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PY:-.venv/Scripts/python.exe}"
LIMIT="${LIMIT:-250}"

"$PY" -m alembic upgrade head
"$PY" -m app.ingest.run  --limit "$LIMIT" --workers 4
"$PY" -m app.analyze.run --limit "$LIMIT" --workers 6
echo "Seed complete. Start API:  $PY -m uvicorn app.api.main:app --port 8077"
echo "Start UI:  cd web && npm run dev"
