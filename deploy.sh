#!/usr/bin/env bash
# Deploy bGSD plugin changes to live OpenCode config
set -euo pipefail

DEST="$HOME/.config/opencode/bgsd-oc"
SRC="$(cd "$(dirname "$0")" && pwd)"

echo "Deploying bGSD plugin from dev workspace..."
echo "  Source: $SRC"
echo "  Dest:   $DEST"
echo ""

ensure_build_deps() {
	if node -e "require.resolve('esbuild')" >/dev/null 2>&1; then
		return
	fi

	echo "Build dependency 'esbuild' is missing; installing project dependencies..."
	if [ -f "$SRC/package-lock.json" ]; then
		(cd "$SRC" && npm ci)
	else
		(cd "$SRC" && npm install)
	fi

	if ! node -e "require.resolve('esbuild')" >/dev/null 2>&1; then
		echo "  ERROR: esbuild is still unavailable after dependency install."
		exit 1
	fi

	echo "  Dependencies installed."
	echo ""
}

# Step 1: Build from source
echo "Building from source..."
ensure_build_deps
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

# Step 3: Manifest-based file sync for canonical and compatibility wrappers
AGENT_DIR="$HOME/.config/opencode/agents"
SKILL_DIR="$HOME/.config/opencode/skills"
MANIFEST="$SRC/bin/manifest.json"
OLD_MANIFEST="$DEST/bin/manifest.json"

if [ ! -f "$MANIFEST" ]; then
	echo "  ERROR: bin/manifest.json not found — build may have failed."
	exit 1
fi

# Map a manifest file path to its deploy destination
# Command wrappers stay manifest-driven so canonical families and legacy aliases ship together.
dest_for_file() {
	local file="$1"
	case "$file" in
	commands/bgsd-*.md) echo "$CMD_DIR/$(basename "$file")" ;;
	agents/bgsd-*.md) echo "$AGENT_DIR/$(basename "$file")" ;;
	skills/*) echo "$SKILL_DIR/${file#skills/}" ;;
	*) echo "$DEST/$file" ;;
	esac
}

mkdir -p "$CMD_DIR" "$AGENT_DIR" "$SKILL_DIR"

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

# Clean up old gsd-*.md agent files that now have bgsd-*.md replacements
OLD_AGENTS=0
for old_agent in "$AGENT_DIR"/gsd-*.md; do
	[ -f "$old_agent" ] || continue
	new_name=$(basename "$old_agent" | sed 's/^gsd-/bgsd-/')
	if [ -f "$AGENT_DIR/$new_name" ]; then
		rm "$old_agent"
		OLD_AGENTS=$((OLD_AGENTS + 1))
	fi
done
if [ $OLD_AGENTS -gt 0 ]; then
	echo "  Cleaned up $OLD_AGENTS old gsd-*.md agent files"
fi

# Step 3d: Copy plugin.js to OpenCode auto-load directory
# OpenCode discovers plugins from ~/.config/opencode/plugin/ (singular, NOT plural)
PLUGIN_DIR="$HOME/.config/opencode/plugin"
mkdir -p "$PLUGIN_DIR"
cp "$SRC/plugin.js" "$PLUGIN_DIR/bgsd.js"
echo "  Installed plugin: plugin/bgsd.js"

# Step 3e: Substitute path placeholders with actual install paths
# Resolve command/workflow placeholders to OpenCode config path.
OPENCODE_CFG="$HOME/.config/opencode"
echo "Substituting path placeholders..."
# macOS sed requires -i '' (space + empty string); GNU/Linux sed requires -i'' (no space)
if [[ "$OSTYPE" == darwin* ]]; then
	SED_INPLACE=(sed -i '')
else
	SED_INPLACE=(sed -i)
fi
find "$DEST" -name '*.md' -exec "${SED_INPLACE[@]}" "s|__OPENCODE_CONFIG__|$OPENCODE_CFG|g" {} +
find "$CMD_DIR" -name 'bgsd-*.md' -exec "${SED_INPLACE[@]}" "s|__OPENCODE_CONFIG__|$OPENCODE_CFG|g" {} +
find "$AGENT_DIR" -name 'bgsd-*.md' -exec "${SED_INPLACE[@]}" "s|__OPENCODE_CONFIG__|$OPENCODE_CFG|g" {} +
find "$SKILL_DIR" -name '*.md' -exec "${SED_INPLACE[@]}" "s|__OPENCODE_CONFIG__|$OPENCODE_CFG|g" {} + 2>/dev/null || true
echo "  Path placeholders resolved to: $OPENCODE_CFG"

# Step 4: Smoke test deployed artifact
echo ""
echo "Running smoke test..."
SMOKE=$(node "$DEST/bin/bgsd-tools.cjs" util:current-timestamp --raw 2>/dev/null) || true
if [ -z "$SMOKE" ]; then
	echo "  ❌ Smoke test FAILED — deployed artifact does not execute correctly."
	echo "  Rolling back to backup..."
	rm -rf "$DEST"
	mv "$BACKUP" "$DEST"
	echo "  Rolled back successfully."
	exit 1
fi
echo "  ✅ Smoke test passed: $SMOKE"

# Validate agent skill references
echo "Validating skill references..."
SKILL_ERRORS=0
for agent in "$AGENT_DIR"/bgsd-*.md; do
	[ -f "$agent" ] || continue
	REFS=$(grep -oP '<skill:([a-z0-9-]+)' "$agent" 2>/dev/null | sed 's/<skill://' | sort -u || true)
	for ref in $REFS; do
		if [ ! -f "$SKILL_DIR/$ref/SKILL.md" ]; then
			echo "  ⚠ $(basename "$agent"): references missing skill '$ref'"
			SKILL_ERRORS=$((SKILL_ERRORS + 1))
		fi
	done
done
if [ $SKILL_ERRORS -gt 0 ]; then
	echo "  ⚠ $SKILL_ERRORS broken skill references (non-fatal warning)"
else
	echo "  ✅ All skill references valid"
fi

CMD_COUNT=$(find "$CMD_DIR" -maxdepth 1 -name 'bgsd-*.md' 2>/dev/null | wc -l)
AGENT_COUNT=$(find "$AGENT_DIR" -maxdepth 1 -name 'bgsd-*.md' 2>/dev/null | wc -l)
SKILL_COUNT=$(find "$SKILL_DIR" -maxdepth 2 -name 'SKILL.md' 2>/dev/null | wc -l)
echo "  Commands deployed: $CMD_COUNT"
echo "  Agents deployed: $AGENT_COUNT"
echo "  Skills deployed: $SKILL_COUNT"

echo ""
echo "Deployed successfully."
echo "Note: Restart OpenCode to pick up workflow changes."
