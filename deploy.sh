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
CMD_DIR="$HOME/.config/opencode/commands"
CMD_BACKUP="$CMD_DIR.bak-$(date +%Y%m%d-%H%M%S)"
if [ -d "$CMD_DIR" ]; then
	cp -r "$CMD_DIR" "$CMD_BACKUP" 2>/dev/null || true
	echo "  Backed up commands to: $CMD_BACKUP"
fi

# Migrate: if old singular command/ exists and new commands/ doesn't yet, rename it
OLD_CMD_DIR="$HOME/.config/opencode/command"
if [ -d "$OLD_CMD_DIR" ] && [ "$CMD_DIR" != "$OLD_CMD_DIR" ]; then
	if [ ! -d "$CMD_DIR" ]; then
		mv "$OLD_CMD_DIR" "$CMD_DIR"
		echo "  Migrated command/ → commands/ (OpenCode plural convention)"
	else
		echo "  Note: old command/ dir exists alongside commands/ — clean up manually"
	fi
fi

# Step 3: Manifest-based file sync
AGENT_DIR="$HOME/.config/opencode/agents"
MANIFEST="$SRC/bin/manifest.json"
OLD_MANIFEST="$DEST/bin/manifest.json"

if [ ! -f "$MANIFEST" ]; then
	echo "  ERROR: bin/manifest.json not found — build may have failed."
	exit 1
fi

# Map a manifest file path to its deploy destination
dest_for_file() {
	local file="$1"
	case "$file" in
	commands/bgsd-*.md) echo "$CMD_DIR/$(basename "$file")" ;;
	agents/gsd-*.md) echo "$AGENT_DIR/$(basename "$file")" ;;
	*) echo "$DEST/$file" ;;
	esac
}

mkdir -p "$CMD_DIR" "$AGENT_DIR"

# Snapshot old manifest BEFORE copying (copy loop overwrites it)
HAS_OLD_MANIFEST=false
OLD_FILES=""
if [ -f "$OLD_MANIFEST" ]; then
	HAS_OLD_MANIFEST=true
	OLD_FILES=$(mktemp)
	jq -r '.files[]' "$OLD_MANIFEST" | sort >"$OLD_FILES"
fi

# Copy each file in the new manifest
ADDED=0
UPDATED=0
for file in $(jq -r '.files[]' "$MANIFEST"); do
	src_path="$SRC/$file"
	dst_path=$(dest_for_file "$file")

	if [ ! -f "$src_path" ]; then
		echo "  ⚠ Manifest lists $file but source not found — skipping"
		continue
	fi

	mkdir -p "$(dirname "$dst_path")"
	if [ -f "$dst_path" ]; then
		UPDATED=$((UPDATED + 1))
	else
		ADDED=$((ADDED + 1))
	fi
	cp "$src_path" "$dst_path"
done

# Remove stale files (in old manifest but not in new manifest)
REMOVED=0
if [ "$HAS_OLD_MANIFEST" = true ]; then
	NEW_FILES=$(mktemp)
	jq -r '.files[]' "$MANIFEST" | sort >"$NEW_FILES"

	# Find files only in old manifest
	while IFS= read -r stale_file; do
		stale_dst=$(dest_for_file "$stale_file")
		if [ -f "$stale_dst" ]; then
			rm "$stale_dst"
			echo "  Removed stale: $stale_file"
			REMOVED=$((REMOVED + 1))
		fi
	done < <(comm -23 "$OLD_FILES" "$NEW_FILES")

	rm -f "$OLD_FILES" "$NEW_FILES"

	if [ "$REMOVED" -gt 0 ]; then
		echo "  Cleaned $REMOVED stale files"
	fi
else
	echo "  First manifest deploy — no cleanup needed"
fi

echo "  Sync: $ADDED added, $UPDATED updated, $REMOVED removed"

# Step 3e: Substitute path placeholders with actual install paths
# CRITICAL: Use the ~/.config/oc symlink (-> ~/.config/opencode) to avoid
# the Anthropic auth plugin mangling "opencode" -> "Claude" in system prompts.
# See lessons.md for the full story on this mangling issue.
OPENCODE_CFG="$HOME/.config/oc"
echo "Substituting path placeholders..."
find "$DEST" -name '*.md' -exec sed -i "s|__OPENCODE_CONFIG__|$OPENCODE_CFG|g" {} +
find "$CMD_DIR" -name 'bgsd-*.md' -exec sed -i "s|__OPENCODE_CONFIG__|$OPENCODE_CFG|g" {} +
find "$AGENT_DIR" -name 'gsd-*.md' -exec sed -i "s|__OPENCODE_CONFIG__|$OPENCODE_CFG|g" {} +
echo "  Path placeholders resolved to: $OPENCODE_CFG (symlink to ~/.config/opencode)"

# Step 4: Smoke test deployed artifact
echo ""
echo "Running smoke test..."
SMOKE=$(node "$DEST/bin/gsd-tools.cjs" util:current-timestamp --raw 2>/dev/null) || true
if [ -z "$SMOKE" ]; then
	echo "  ❌ Smoke test FAILED — deployed artifact does not execute correctly."
	echo "  Rolling back to backup..."
	rm -rf "$DEST"
	mv "$BACKUP" "$DEST"
	echo "  Rolled back successfully."
	exit 1
fi
echo "  ✅ Smoke test passed: $SMOKE"

CMD_COUNT=$(find "$CMD_DIR" -maxdepth 1 -name 'bgsd-*.md' 2>/dev/null | wc -l)
AGENT_COUNT=$(find "$AGENT_DIR" -maxdepth 1 -name 'gsd-*.md' 2>/dev/null | wc -l)
echo "  Commands deployed: $CMD_COUNT"
echo "  Agents deployed: $AGENT_COUNT"

echo ""
echo "Deployed successfully."
echo "Note: Restart OpenCode to pick up workflow changes."
