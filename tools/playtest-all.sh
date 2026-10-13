#!/usr/bin/env bash
# Runs every level's scripted playthrough against the dev server (bun run dev must be running).
# Usage: bash tools/playtest-all.sh [port]
port=${1:-5173}
status=0
for t in meadow:1 creek:2 pond:3 woods2:4 mountain:5 night:6 snow:7 autumn:8 beach:9 playground:10; do
  name=${t%%:*}
  level=${t##*:}
  if result=$(bun tools/playtest.ts "tools/tests/$name.js" --url "http://localhost:$port/?manual&level=$level" 2>&1); then
    if echo "$result" | grep -qE "^  (done|complete time) [0-9]"; then echo "✅ $name"; else echo "❌ $name: $result"; status=1; fi
  else
    echo "❌ $name: $result"
    status=1
  fi
done
exit $status
