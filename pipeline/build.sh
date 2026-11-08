#!/usr/bin/env bash
# Full rebuild: sources -> items -> topics -> site/data.json + site/coverage.json
set -euo pipefail
cd "$(dirname "$0")"
./fetch_sources.sh
python3 ingest.py
python3 classify.py
python3 export.py
python3 coverage.py
