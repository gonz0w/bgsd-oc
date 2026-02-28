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

# Step 2b: Backup command directory
CMD_DIR="$HOME/.config/opencode/command"
CMD_BACKUP="$CMD_DIR.bak-$(date +%Y%m%d-%H%M%S)"
if [ -d "$CMD_DIR" ]; then
	cp -r "$CMD_DIR" "$CMD_BACKUP" 2>/dev/null || true
	echo "  Backed up commands to: $CMD_BACKUP"
fi

# Step 3: Copy files (preserve dest directory, overwrite contents)
cp -r "$SRC/bin" "$DEST/"
cp -r "$SRC/workflows" "$DEST/"
cp -r "$SRC/templates" "$DEST/"
cp -r "$SRC/references" "$DEST/"
cp -r "$SRC/src" "$DEST/"
cp "$SRC/VERSION" "$DEST/"

# Step 3b: Deploy command wrappers (only our commands, don't touch others)
mkdir -p "$CMD_DIR"
for cmd in "$SRC/commands"/gsd-*.md; do
	[ -f "$cmd" ] && cp "$cmd" "$CMD_DIR/"
done

# Step 3c: Substitute path placeholders with actual install paths
OPENCODE_CFG="$HOME/.config/opencode"
echo "Substituting path placeholders..."
find "$DEST" -name '*.md' -exec sed -i "s|__OPENCODE_CONFIG__|$OPENCODE_CFG|g" {} +
find "$CMD_DIR" -name 'gsd-*.md' -exec sed -i "s|__OPENCODE_CONFIG__|$OPENCODE_CFG|g" {} +
echo "  Path placeholders resolved to: $OPENCODE_CFG"

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

CMD_COUNT=$(ls "$CMD_DIR"/gsd-*.md 2>/dev/null | wc -l)
echo "  Commands deployed: $CMD_COUNT"

echo ""
echo "Deployed successfully."
echo "Note: Restart OpenCode to pick up workflow changes."
