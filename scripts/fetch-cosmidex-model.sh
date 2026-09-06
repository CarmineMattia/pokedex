#!/usr/bin/env bash
# Optional: download Cosmidex TF.js weights into public/model for offline / faster loads.
# Source: https://github.com/Ansh9045/Cosmidex (no LICENSE file in upstream — check before redistributing)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/public/model"
BASE="https://cdn.jsdelivr.net/gh/Ansh9045/Cosmidex@main/frontend/public/model"

mkdir -p "$DEST"
echo "Fetching Cosmidex TF.js model → $DEST"
curl -fsSL "$BASE/model.json" -o "$DEST/model.json"
curl -fsSL "$BASE/group1-shard1of2.bin" -o "$DEST/group1-shard1of2.bin"
curl -fsSL "$BASE/group1-shard2of2.bin" -o "$DEST/group1-shard2of2.bin"
echo "Done (~6.3 MB). App will prefer /model/model.json when present."
