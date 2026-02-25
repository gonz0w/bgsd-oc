# Features Research: v4.0 Environment & Execution Intelligence

**Researched:** 2026-02-25
**Focus:** Feature patterns for environment awareness, MCP profiling, structured requirements, worktree parallelism

## Summary

Four feature categories. Environment awareness and MCP profiling are table stakes for 2026 AI coding tools. Structured requirements is a differentiator (no existing tool does this well). Worktree parallelism follows Claude Code/Cursor patterns but with GSD's wave-based orchestration layer.

## Feature Categories

### 1. Environment Awareness

**Table stakes:**
- Project language detection from manifest files (package.json → JS, go.mod → Go)
- Package manager detection from lockfiles
- Binary availability checking

**Differentiators:**
- Unified JSON manifest combining all detection signals
- Workflow injection (agents see available tools automatically)
- Stale detection (re-scan when deps change)
- Polyglot support with primary language marking

**Research notes:** No existing standard for AI environment manifests. devcontainers comes closest but is container-specific. mise/asdf track versions but not tool availability. This is novel.

### 2. MCP Profiling

**Table stakes:**
- Config file discovery and parsing
- Token cost estimation per server

**Differentiators:**
- Project-aware relevance scoring (match server to project files)
- Actionable recommendations with token savings
- Auto-disable with backup/restore

**Research notes:** Claude Code shipped Tool Search (Jan 2026) for 85% token reduction via on-demand loading. OpenCode has manual `enabled: false` but no profiling. A profiling CLI command is novel.

### 3. Structured Requirements

**Table stakes:**
- Testable acceptance criteria per requirement
- Test-to-requirement traceability

**Differentiators:**
- Verification integration (verifier checks assertions, not just text)
- Plan derivation (must_haves auto-populated from assertions)
- Research-backed format (structured assertions, not Gherkin — 80% benefit at 20% ceremony)

**Research notes:** Papers confirm structured requirements reduce rework 10-50% vs vague specs. Gherkin adds 5-8x token overhead with no evidence of superior outcomes for solo dev + AI. Plain structured assertions are the right format.

### 4. Worktree Parallelism

**Table stakes:**
- Worktree create/list/remove commands
- Conflict detection before merge

**Differentiators:**
- Wave-aware orchestration (GSD's dependency graph drives worktree creation)
- Sequential merge with test gates between each
- Config-driven limits (max_concurrent, sync_files, setup_hooks)
- Integration with existing `files_modified` static analysis

**Research notes:** Claude Code, Cursor, agentree, git-worktree-runner all use worktrees for parallel agents. GSD's wave system provides the parallelism boundaries — worktrees are the execution mechanism. Key risk: disk space (2-4GB per worktree with node_modules) and lock file conflicts.

### 5. Complete-and-Clear Workflow

**Table stakes:** Session summary generation, next-step suggestion.
**Complexity:** Low — single workflow file, minimal CLI support needed.
