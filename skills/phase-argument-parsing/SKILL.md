---
name: phase-argument-parsing
description: Phase argument parsing and normalization — extracting phase numbers from user input, zero-padding, decimal suffix handling, validation via bgsd-tools find-phase, and directory lookup patterns.
type: shared
agents: [planner, executor, verifier, roadmapper]
sections: [extraction, normalization, validation, directory-lookup]
---

## Purpose

Multiple agents need to parse phase arguments from user input. This skill standardizes the extraction, normalization (zero-padding), and validation pattern so all agents handle phase references consistently — whether the user types "8", "08", or "8.1".

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{bgsd_home}}` | Path to bgsd-tools installation | `$BGSD_HOME` |

## Content

<!-- section: extraction -->
### Extraction

From `$ARGUMENTS`:
- Extract phase number (first numeric argument)
- Extract flags (prefixed with `--`)
- Remaining text is description (for insert/add commands)
<!-- /section -->

<!-- section: normalization -->
### Using bgsd-tools (Recommended)

The `find-phase` command handles normalization and validation in one step:

```bash
PHASE_INFO=$(node {{bgsd_home}}/bin/bgsd-tools.cjs plan:find-phase "${PHASE}")
```

Returns JSON:
- `found`: true/false
- `directory`: Full path to phase directory
- `phase_number`: Normalized (e.g., "06", "06.1")
- `phase_name`: Name portion (e.g., "foundation")
- `plans`: Array of PLAN.md files
- `summaries`: Array of SUMMARY.md files

### Manual Normalization (Legacy)

Zero-pad integer phases to 2 digits. Preserve decimal suffixes:

```bash
if [[ "$PHASE" =~ ^[0-9]+$ ]]; then
  PHASE=$(printf "%02d" "$PHASE")      # 8 → 08
elif [[ "$PHASE" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  PHASE=$(printf "%02d.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")  # 2.1 → 02.1
fi
```
<!-- /section -->

<!-- section: validation -->
### Validation

Use `roadmap get-phase` to validate the phase exists:

```bash
PHASE_CHECK=$(node {{bgsd_home}}/bin/bgsd-tools.cjs plan:roadmap get-phase "${PHASE}")
if [ "$(echo "$PHASE_CHECK" | jq -r '.found')" = "false" ]; then
  echo "ERROR: Phase ${PHASE} not found in roadmap"
  exit 1
fi
```
<!-- /section -->

<!-- section: directory-lookup -->
### Directory Lookup

```bash
PHASE_DIR=$(node {{bgsd_home}}/bin/bgsd-tools.cjs plan:find-phase "${PHASE}" | jq -r '.directory')
```
<!-- /section -->

## Cross-references

- <skill:state-update-protocol /> — State updates use phase identifiers

## Examples

See `references/phase-argument-parsing.md` for the original 61-line reference.
