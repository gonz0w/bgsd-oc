#!/usr/bin/env bash
# Deploy GSD plugin changes to live OpenCode config
set -euo pipefail

DEST="$HOME/.config/opencode/get-shit-done"
SRC="$(cd "$(dirname "$0")" && pwd)"

echo "Deploying GSD plugin from dev workspace..."
echo "  Source: $SRC"
echo "  Dest:   $DEST"
echo ""

# Backup current
BACKUP="$DEST.bak-$(date +%Y%m%d-%H%M%S)"
if [ -d "$DEST" ]; then
	cp -r "$DEST" "$BACKUP"
	echo "  Backed up current to: $BACKUP"
fi

# Copy files (preserve dest directory, overwrite contents)
cp -r "$SRC/bin" "$DEST/"
cp -r "$SRC/workflows" "$DEST/"
cp -r "$SRC/templates" "$DEST/"
cp -r "$SRC/references" "$DEST/"
cp "$SRC/VERSION" "$DEST/"

echo ""
echo "Deployed successfully."
echo "Note: Restart OpenCode to pick up workflow changes."
