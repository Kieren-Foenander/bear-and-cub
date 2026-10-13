#!/usr/bin/env bash
# Focused QA regressions plus the complete Woods route. Start Vite first.
# Usage: bash tools/playtest-qa.sh [port]
set -euo pipefail
port=${1:-5320}
for test in qa-coaches:4 qa-pond-shortcut:3 qa-celebration:1 qa-recovery:1 qa-flow:0 qa-controls:1 qa-seesaw:4 qa-lift:5 qa-style-hats:9 qa-playground-seesaw:9 woods:4; do
  name=${test%%:*}
  level=${test##*:}
  url="http://localhost:$port/?manual"
  if [ "$level" -gt 0 ]; then url+="&level=$level"; fi
  bun tools/playtest.ts "tools/tests/$name.js" --url "$url"
done
