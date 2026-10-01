#!/usr/bin/env bash
# Clone the open datasets this project builds on into raw/ (gitignored).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p raw
[ -d raw/sr ]  || git clone --depth 1 https://github.com/arb-consulting/shallow-review-2025 raw/sr
[ -d raw/asg ] || git clone --depth 1 https://github.com/ai-safety-graph/AISafetyGraph raw/asg
echo "Sources ready in raw/"
