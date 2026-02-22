# GSD Plugin for OpenCode — Development Workspace

## What This Is

Development workspace for improving the Get Shit Done (GSD) planning plugin for OpenCode.
The production install lives at `~/.config/opencode/get-shit-done/`.

## Project Structure

```
bin/gsd-tools.cjs          # Main CLI tool (5400+ lines, single file)
workflows/*.md             # Workflow definitions (invoked by commands)
templates/*.md             # Document templates (PLAN.md, STATE.md, etc.)
references/*.md            # Reference docs loaded by agents
deploy.sh                  # Deploy changes to ~/.config/opencode/
```

## Key Commands

```bash
# Test a gsd-tools command locally
node bin/gsd-tools.cjs <command> [args] --raw

# Deploy to live config
./deploy.sh

# Run from event-pipeline to test in real project
cd /mnt/raid/DEV/event-pipeline && node /mnt/raid/DEV/gsd-opencode/bin/gsd-tools.cjs init progress --raw
```

## Development Rules

1. **Test against real project**: Always test changes against `/mnt/raid/DEV/event-pipeline/.planning/`
2. **Backward compatible**: All regex/parser changes must accept both old and new formats
3. **No breaking changes**: Existing ROADMAP.md, STATE.md, PLAN.md files must keep working
4. **Single-file CLI**: `gsd-tools.cjs` stays as one file (Node.js, zero dependencies)
5. **Path-agnostic**: Use config paths from environment, not hardcoded paths

## Architecture

- `gsd-tools.cjs` is the brain — all parsing, analysis, git operations, validation
- Workflows (`.md` files) are prompts that agents follow, calling gsd-tools.cjs for data
- Commands (in `~/.config/opencode/command/`) are thin wrappers pointing to workflows
- Agents (in `~/.config/opencode/agents/`) are subagent definitions with system prompts
- Hooks (in `~/.config/opencode/hooks/`) are JS scripts for statusline and update checks

## Testing

```bash
# Test milestone detection (should return v6.0, not v1.1)
node bin/gsd-tools.cjs init progress --raw 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'milestone: {d[\"milestone_version\"]}, phases: {d[\"phase_count\"]}, completed: {d[\"completed_count\"]}')"

# Test roadmap analysis (should parse goals, show 29% progress)
node bin/gsd-tools.cjs roadmap analyze --raw 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'phases: {d[\"phase_count\"]}, progress: {d[\"progress_percent\"]}%, goals_parsed: {sum(1 for p in d[\"phases\"] if p[\"goal\"])}/{len(d[\"phases\"])}')"
```

## Completed Work

### Bug Fixes (5/5) — Commit `29d613c`
1. **getMilestoneInfo()** — Multi-strategy milestone detection (🔵 marker → `(active)` tag → `Active Milestone` section → last non-✅ → fallback). Returns `phaseRange` for directory scoping.
2. **cmdInitProgress()** — Filters phase directories to milestone's phase range
3. **progress_percent** — Now phase-level (`completedPhases/phases.length`), added `plan_progress_percent` for old metric
4. **Milestone regex** — Only matches bullet items with ✅/🔵 markers, adds `active` flag
5. **Field format mismatch** — 7 regex patterns accept optional colon (`:?`) for Goal, Depends on, Plans, Requirements

### New Features (15/15) — Commit `6212eeb`
All commands available via `node bin/gsd-tools.cjs <command>`:
- `session-diff` — Git commits since last activity (also in `init progress`)
- `context-budget <plan-path>` — Token estimation, warns >50%
- `test-run` — Parses ExUnit/Go/pytest output with pass/fail gating
- `search-decisions <query>` — Searches STATE.md + archives
- `validate-dependencies <phase>` — Validates phase dependency graph
- `search-lessons <query>` — Searches tasks/lessons.md
- `codebase-impact <files...>` — Shows module dependencies (reads Elixir defmodule)
- `rollback-info <plan-id>` — Shows commits + revert command
- `velocity` — Plans/day + completion forecast
- `trace-requirement <req-id>` — Full trace from requirement to files on disk
- `validate-config` — Schema validation + typo detection for config.json
- `quick-summary` — Milestone progress summary
- `milestone complete` — Includes auto-archive of completed phases

## Optional Next Steps

These are quality-of-life improvements, none are blocking:

1. **Plan template files** — Create actual templates in `templates/plans/` (e.g., `ash-resource.md`, `pulsar-function.md`, `go-service.md`) for the plan-templates infrastructure already in gsd-tools.cjs
2. **Parallel execution visualization** — Add ASCII wave/dependency visualization to `workflows/execute-phase.md`
3. **Slash commands for new features** — Create OpenCode commands in `~/.config/opencode/command/` for: `gsd-search-decisions`, `gsd-velocity`, `gsd-context-budget`, `gsd-test-run`, `gsd-codebase-impact`, `gsd-trace-requirement`, `gsd-validate-config`, `gsd-quick-summary`, `gsd-rollback-info`, `gsd-search-lessons`, `gsd-validate-deps`
4. **Test gating config** — Add `test_commands` to EventPipeline's `.planning/config.json` to enable `test-run` gating
5. **Workflow integration** — Wire `validate-dependencies` into `execute-phase` workflow as pre-flight check; wire `search-lessons` into `plan-phase` to auto-surface relevant lessons
6. **Line count update** — CLAUDE.md says "5400+ lines" but gsd-tools.cjs is now 6,495 lines
