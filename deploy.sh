#!/usr/bin/env bash
# Deploy GSD plugin changes to live OpenCode config
set -euo pipefail

DEST="$HOME/.config/opencode/get-shit-done"
SRC="$(cd "$(dirname "$0")" && pwd)"

echo "Deploying GSD plugin from dev workspace..."
echo "  Source: $SRC"
echo "  Dest:   $DEST"
echo ""

# Step 1: Build from source
echo "Building from source..."
npm run build
echo "  Build complete."
echo ""

# Step 2: Backup current installation
BACKUP="$DEST.bak-$(date +%Y%m%d-%H%M%S)"
if [ -d "$DEST" ]; then
	cp -r "$DEST" "$BACKUP"
	echo "  Backed up current to: $BACKUP"
fi

# Step 3: Copy files (preserve dest directory, overwrite contents)
cp -r "$SRC/bin" "$DEST/"
cp -r "$SRC/workflows" "$DEST/"
cp -r "$SRC/templates" "$DEST/"
cp -r "$SRC/references" "$DEST/"
cp -r "$SRC/src" "$DEST/"
cp "$SRC/VERSION" "$DEST/"

# Step 4: Smoke test deployed artifact
echo ""
echo "Running smoke test..."
SMOKE=$(node "$DEST/bin/gsd-tools.cjs" current-timestamp --raw 2>/dev/null) || true
if [ -z "$SMOKE" ]; then
	echo "  ❌ Smoke test FAILED — deployed artifact does not execute correctly."
	echo "  Rolling back to backup..."
	rm -rf "$DEST"
	mv "$BACKUP" "$DEST"
	echo "  Rolled back successfully."
	exit 1
fi
echo "  ✅ Smoke test passed: $SMOKE"

echo ""
echo "Deployed successfully."
echo "Note: Restart OpenCode to pick up workflow changes."
