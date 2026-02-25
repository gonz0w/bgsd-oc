# Research Summary: v4.0 Environment & Execution Intelligence

**Synthesized:** 2026-02-25
**Sources:** Stack, Features, Architecture research + Gherkin/BDD literature review

## Key Findings

### Environment Detection
- File-existence checks detect project type in ~1ms. 15+ manifest file patterns cover all major languages.
- Lockfile detection identifies package manager instantly. `packageManager` field overrides lockfile.
- Binary checks via `which` take 5-10ms each. Only check binaries relevant to detected languages.
- No existing standard for AI environment manifests. Novel feature.
- Total detection time: 50-300ms (dominated by binary version checks).

### MCP Context Overhead
- 5-10 MCP servers consume 40-82K tokens before the user types anything. GitHub alone = 46K tokens.
- Static analysis sufficient. Known-server database + config parsing provides 80% of value without connecting to servers.
- Claude Code shipped Tool Search (Jan 2026) — 85% token reduction via on-demand loading. OpenCode has no equivalent.
- Project-file matching determines relevance. Postgres MCP relevant if migrations/ exists.

### Structured Requirements
- No evidence Gherkin outperforms plain structured assertions for AI agents.
- Gherkin adds 5-8x token overhead (~120-180 vs ~18 tokens per requirement).
- Structured assertions give 80% of benefit at 20% of ceremony.
- GSD's must_haves system is already more precise than Gherkin for artifact/wiring verification. Gap is at requirements level.

### Worktree Parallelism
- Industry standard for 2026. Claude Code, Cursor, agentree, git-worktree-runner all use worktrees.
- GSD's wave system is the right foundation. Worktrees are the deployment mechanism.
- Key constraints: no shared branches, 2-4GB disk per worktree, lock file conflicts nearly guaranteed.
- `git merge-tree` (Git 2.38+) enables dry-run conflict detection.
- Sequential merge with test gates between each worktree merge.

## Watch Out For
- Disk space: 5 worktrees × 2-4GB = 10-20GB. Config limit essential.
- Lock file conflicts: Designate "dependency authority" per wave.
- MCP auto-disable risk: Always backup, always require `--apply` flag.
- Bundle growth: ~30KB from new modules. Raise budget to 500KB.
- Binary detection in containers: `which` behaves differently. Graceful fallback needed.

## Architecture Decision
All features as new command modules in existing gsd-tools.cjs. No new dependencies. No architectural changes. Build order: Environment → MCP → Requirements → Worktrees → Complete-and-Clear.
