# Requirements: GSD Plugin v4.0

**Defined:** 2026-02-25
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance

## v4.0 Requirements

Requirements for milestone v4.0 Environment & Execution Intelligence. Each maps to roadmap phases.

### Environment Awareness

- [x] **ENV-01**: CLI detects project languages from manifest files
  - Scan 15+ file patterns (package.json, go.mod, mix.exs, Cargo.toml, pyproject.toml, etc.)
  - Polyglot projects detect ALL languages, mark primary based on root manifest
  - Detection completes in <10ms (file existence checks only)

- [x] **ENV-02**: CLI detects package manager from lockfiles and packageManager field
  - Lockfile precedence: bun.lock → pnpm-lock.yaml → yarn.lock → package-lock.json
  - packageManager field in package.json takes precedence over lockfile
  - Version detected from lockfile format

- [x] **ENV-03**: CLI checks binary availability for detected languages
  - Run `which <tool>` for language-specific binaries (mix, go, npm, cargo, etc.)
  - Run `<tool> --version` for version capture
  - Timeout per binary check (3s max), only check binaries relevant to detected languages

- [x] **ENV-04**: CLI writes environment manifest to `.planning/env-manifest.json`
  - JSON schema: languages, runtimes, package_manager, tools, scripts, monorepo, detection_ms
  - Includes detection source for each value (e.g., "source": "mise.toml")
  - Gitignored (machine-specific, not committed)

- [x] **ENV-05**: Init commands inject manifest summary into output for agent context
  - `init progress`, `init execute`, etc. include available tools
  - Compact format: "Tools: node@20 (npm), mix@1.16, go@1.21, docker@24"
  - Only inject if manifest exists and is fresh

- [x] **ENV-06**: CLI detects stale manifest and re-scans automatically
  - Compare manifest timestamp to git HEAD change
  - Re-scan if package.json, go.mod, mix.exs, etc. changed since last scan
  - `env scan --force` to manually re-scan

### MCP Profiling

- [x] **MCP-01**: CLI discovers configured MCP servers from config files
  - Parse .mcp.json (Claude Code), opencode.json (OpenCode)
  - Merge project-scoped and user-scoped configs
  - List server name, transport type, command

- [x] **MCP-02**: CLI estimates token cost per server from known-server database
  - Static lookup table: server-name → approximate tool count → token estimate
  - Cover 15+ common servers (GitHub, Postgres, Terraform, Brave, Docker, etc.)
  - Unknown servers estimated at 150 tokens/tool average
  - Total context cost shown as absolute tokens and % of context window

- [x] **MCP-03**: CLI scores server relevance to current project
  - Match server type to project file indicators (Postgres → migrations/, schema.prisma)
  - Score: relevant / possibly-relevant / not-relevant
  - Low-cost servers (< 1K tokens) always marked relevant

- [x] **MCP-04**: CLI recommends disabling irrelevant servers with token savings
  - Per-server recommendation: keep / disable / review
  - Total potential savings in tokens and % of context window
  - Reasoning per recommendation

- [x] **MCP-05**: CLI can auto-disable servers in config files
  - Set `enabled: false` in opencode.json for recommended servers
  - Create backup of original config before modification
  - `mcp-profile --apply` flag to execute recommendations
  - `mcp-profile --restore` to undo from backup

### Structured Requirements

- [ ] **SREQ-01**: Requirements template includes structured acceptance criteria
  - 2-5 testable assertions per requirement
  - Format: indented bullet list under each requirement
  - Each assertion is specific, testable, unambiguous

- [ ] **SREQ-02**: New-milestone and new-project workflows generate structured requirements
  - Prompt user for acceptance criteria during requirement definition
  - Auto-suggest assertions based on requirement text
  - Validate: every v1 requirement has at least 2 assertions

- [ ] **SREQ-03**: Traceability table maps requirements to test commands
  - New column: test command(s) that verify the requirement
  - `verify requirements` checks test commands exist and can run
  - Coverage: track tested vs untested requirements

- [ ] **SREQ-04**: Phase verifier checks structured assertions, not just requirement text
  - Verifier reads acceptance criteria from REQUIREMENTS.md
  - Each assertion checked against codebase evidence
  - Report includes per-assertion pass/fail status

- [ ] **SREQ-05**: Plan must_haves derive from structured acceptance criteria
  - Planner reads assertions for mapped requirements
  - `must_haves.truths` populated from assertions
  - Traceability: assertion → truth → verification result

### Worktree Parallelism

- [ ] **WKTR-01**: CLI creates worktrees for plan execution
  - `worktree create <plan-id>` creates isolated worktree with new branch
  - Branch naming: `worktree-<phase>-<plan>-<wave>`
  - Sync configurable files (.env, .planning/config.json)
  - Run setup hooks (npm install, etc.) per worktree config

- [ ] **WKTR-02**: CLI lists and manages active worktrees
  - `worktree list` shows active worktrees with plan associations, branch, disk usage
  - `worktree remove <plan-id>` cleans up completed worktree
  - `worktree cleanup` removes all completed worktrees

- [ ] **WKTR-03**: CLI performs conflict pre-check before merge
  - `worktree merge <plan-id>` runs `git merge-tree` dry-run first
  - Clean merge → auto-merge to base branch
  - Conflicts → report conflicting files, block merge, prompt for resolution

- [ ] **WKTR-04**: Config supports worktree settings
  - `worktree` section in config.json: enabled, base_path, sync_files, setup_hooks, max_concurrent
  - Default max_concurrent: 3 (safe for 32GB RAM)
  - Validation: warn if max_concurrent > available RAM / 4GB

- [ ] **WKTR-05**: Execute-phase workflow creates worktrees per wave
  - Wave N plans → create worktrees for each plan in wave
  - Spawn agent sessions in worktrees (via tmux or terminal)
  - Monitor progress across worktrees
  - Merge sequentially after all wave agents complete, run tests after each merge
  - Cleanup and advance to wave N+1

- [ ] **WKTR-06**: files_modified conflict detection integrates with worktree merge
  - Static analysis at plan-time catches file overlap
  - `git merge-tree` at merge-time catches runtime conflicts
  - Both signals feed into merge decision (block or proceed)

### Workflow Additions

- [ ] **WFLW-01**: `/gsd-complete-and-clear` workflow auto-summarizes and prompts context reset
  - Generate session summary from STATE.md current position
  - List what was completed in this session
  - Suggest `/clear` with next command to run
  - Update STATE.md session continuity section

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Agent Orchestration

- **ORCH-01**: Supervisor agent that dynamically routes to specialized sub-agents
- **ORCH-02**: ReAct-style reflection loops with auto-replan on drift

### Observability

- **OBS-01**: Full agent trajectory logging with cost/audit trails
- **OBS-02**: Real-time progress dashboard for multi-worktree execution

## Out of Scope

| Feature | Reason |
|---------|--------|
| Gherkin/BDD format | Research shows no evidence of superior outcomes vs structured assertions for AI agents; 5-8x token overhead |
| SQLite codebase index | Heavy dependency, overlaps with LSP/ripgrep, marginal ROI for planning CLI |
| Language migration (JS → Go/Rust) | JS works, zero-dep is a feature, 12K+ line rewrite for marginal speed |
| AGENTS.md governance rewrite | Current agent coordination already working well per user feedback |
| Vector/RAG retrieval | Wrong architecture for a CLI tool |
| Runtime MCP server connection | Static analysis sufficient for profiling; no need to spawn servers |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | Phase 18 | Complete |
| ENV-02 | Phase 18 | Complete |
| ENV-03 | Phase 18 | Complete |
| ENV-04 | Phase 18 | Complete |
| ENV-05 | Phase 18 | Complete |
| ENV-06 | Phase 18 | Complete |
| MCP-01 | Phase 19 | Complete |
| MCP-02 | Phase 19 | Complete |
| MCP-03 | Phase 19 | Complete |
| MCP-04 | Phase 19 | Complete |
| MCP-05 | Phase 19 | Complete |
| SREQ-01 | Phase 20 | Pending |
| SREQ-02 | Phase 20 | Pending |
| SREQ-03 | Phase 20 | Pending |
| SREQ-04 | Phase 20 | Pending |
| SREQ-05 | Phase 20 | Pending |
| WKTR-01 | Phase 21 | Pending |
| WKTR-02 | Phase 21 | Pending |
| WKTR-03 | Phase 21 | Pending |
| WKTR-04 | Phase 21 | Pending |
| WKTR-05 | Phase 21 | Pending |
| WKTR-06 | Phase 21 | Pending |
| WFLW-01 | Phase 22 | Pending |

**Coverage:**
- v4.0 requirements: 23 total
- Mapped to phases: 23 ✓
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation*
