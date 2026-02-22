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
