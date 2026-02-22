# GSD (Get Shit Done) — Planning Plugin for OpenCode

A structured project planning and execution plugin for [OpenCode](https://github.com/opencode-ai/opencode). GSD brings milestone-driven planning, phase execution, progress tracking, and developer workflow automation to AI-assisted coding sessions.

## What It Does

GSD turns chaotic development into structured execution:

- **Milestone & Phase Planning** — Break projects into milestones with phases, goals, dependencies, and requirements
- **Execution Tracking** — Track progress at milestone, phase, and plan level with automatic state management
- **Git-Aware** — Session diffs, commit tracking, rollback info, and velocity metrics
- **Context Management** — Token budget estimation, codebase impact analysis, requirement tracing
- **Decision & Lesson Search** — Search past decisions and lessons learned across archived milestones

## Project Structure

```
bin/gsd-tools.cjs          # Main CLI tool (single file, zero runtime deps)
src/                       # Source modules (compiled to bin/ via esbuild)
workflows/*.md             # 43 workflow definitions (invoked by slash commands)
templates/*.md             # Document templates (PLAN.md, STATE.md, ROADMAP.md, etc.)
references/*.md            # Reference docs loaded by agents
deploy.sh                  # Deploy to ~/.config/opencode/get-shit-done/
```

## Installation

```bash
# Clone the repo
git clone https://github.com/gonz0w/better-gsd-opencode.git

# Install dev dependencies
cd better-gsd-opencode
npm install

# Build the CLI
npm run build

# Deploy to OpenCode config
./deploy.sh
```

## Usage

GSD is used through slash commands inside OpenCode sessions:

```
/gsd-new-project          # Start a new project with milestone planning
/gsd-progress             # View current milestone/phase progress
/gsd-plan-phase           # Plan the next phase
/gsd-execute-phase        # Execute a planned phase
/gsd-quick                # Quick summary of where things stand
/gsd-velocity             # Plans/day + completion forecast
/gsd-session-diff         # Git commits since last activity
/gsd-search-decisions     # Search past decisions
/gsd-search-lessons       # Search lessons learned
/gsd-context-budget       # Token estimation for a plan
/gsd-validate-deps        # Validate phase dependency graph
/gsd-codebase-impact      # Show module dependencies
/gsd-trace-requirement    # Trace requirement to files on disk
/gsd-rollback-info        # Show commits + revert command
/gsd-test-run             # Parse test output with pass/fail gating
/gsd-validate-config      # Schema validation for config.json
```

Or run the CLI directly:

```bash
node bin/gsd-tools.cjs <command> [args] --raw
```

## Key Features (v1.1)

- **Multi-strategy milestone detection** — Finds active milestone via markers, tags, sections, or fallback
- **Phase-scoped progress** — Progress calculated per-milestone, not globally
- **Session diff tracking** — Git commits since last activity included in progress reports
- **Context budget estimation** — Token estimation with warnings when plans exceed 50% of context
- **Test run gating** — Parse ExUnit/Go/pytest output with pass/fail gating
- **Decision & lesson search** — Full-text search across STATE.md and archives
- **Dependency validation** — Validates phase dependency graphs
- **Velocity metrics** — Plans/day calculation with completion forecasting
- **Requirement tracing** — Trace from requirement ID to files on disk
- **Config validation** — Schema validation with typo detection
- **Generic plan templates** — Reusable templates for common plan types

## Requirements

- Node.js >= 18
- [OpenCode](https://github.com/opencode-ai/opencode) installed and configured

## License

MIT
