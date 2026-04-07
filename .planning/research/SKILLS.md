# Project Skill Recommendations

**Project:** bGSD Plugin (Node.js CLI planning tool)
**Milestone focus:** v19.4 Workflow Acceleration II + TDD Reliability — continuing v19.3's hot-path optimization and addressing TDD-RELIABILITY-PRD backlog items
**Researched:** 2026-04-06
**Confidence:** HIGH (searched agentskills.io registry, GitHub ecosystem, awesome-opencode list, and awesome-claude-skills collection)

## Recommendation Summary

No strong skill recommendations for this milestone. The v19.4 goals — continuing workflow acceleration from v19.3 and hardening TDD reliability — are achieved through internal CLI implementation (phase snapshots, compact handoffs, batched state mutations, stronger RED/GREEN/REFACTOR gate validation in `execute:tdd`). The existing project-local skills (`tdd-execution`, `verification-reference`, `planner-dependency-graph`, `cmux-skill`) already cover the agent-facing guidance needed for this milestone. External ecosystem skills either require non-bGSD execution models (Git worktrees, Python runtimes, Claude Code-specific toolchains) or target different problem spaces (human-initiated session handoff, not automated workflow chaining).

## Rejected Candidates

### obra/superpowers/test-driven-development
- **Repo:** https://github.com/obra/superpowers
- **Why rejected:** The RED/GREEN/REFACTOR enforcement skill (Iron Law, anti-rationalization guidance) is excellent in isolation, but superpowers as a system requires Git worktrees, subagent-driven-development orchestration, and a plugin-based installation that conflicts with bGSD's JJ-first, markdown-planning model. The OpenCode-adapted fork (beholder20/superpowers-opencode) has 0 stars and is unmaintained. Installing the full system would import opinionated patterns that fight bGSD's architecture.
- **Could revisit:** If the TDD execution hardening in v19.4 Phase B needs richer anti-pattern detection content, extract just the RED/GREEN/REFACTOR behavioral contract into a bGSD-native skill reference — don't adopt the full system.

### obra/superpowers/verification-before-completion
- **Repo:** https://github.com/obra/superpowers
- **Why rejected:** "Evidence before assertions always" is a strong match for TDD gate hardening, but it's part of the superpowers system (same Git-worktree dependency above). Would require adopting the full framework.
- **Already covered:** bGSD's own `verification-reference` skill already provides verification patterns at a similar quality level without external framework dependencies.

### softaworks/agent-toolkit/session-handoff
- **Repo:** https://github.com/softaworks/agent-toolkit
- **Why rejected:** Comprehensive handoff document workflow with Python scripts, validation, staleness checking. HIGH quality (5.8k stars on agentskills.me). However: requires Python runtime, uses `.claude/handoffs/` paths, and assumes Claude Code toolset (TodoWrite, Task). Not an OpenCode-native skill and cannot be installed via `skills:install --source`. Targets human-initiated session pausing, not the automated compact JSON handoff chaining that v19.4's `XX-HANDOFF.json` design calls for.
- **Could inform:** The staleness-checking pattern (`check_staleness.py` equivalent) could inspire a bGSD-native CLI command for handoff freshness validation, but this is a implementation detail, not a skill recommendation.

### joshuadavidthomas/opencode-handoff
- **Repo:** https://github.com/joshuadavidthomas/opencode-handoff
- **Why rejected:** OpenCode-native plugin with `/handoff` command and `read_session` tool for transcript retrieval. Targets user-initiated session transfer between human conversations. While the `read_session` tool concept is interesting, this is about preserving human conversation context across sessions — not about compact machine-readable handoff between workflow steps in an automated chain. Architectural mismatch with v19.4's `/bgsd-deliver-phase` design.
- **Could inform:** The `read_session` tool concept (fetching prior conversation when handoff summary is insufficient) is conceptually similar to bGSD's existing "resume from disk state" pattern, but the implementation assumes OpenCode session infrastructure bGSD doesn't use.

### affaan-m/everything-claude-code/tdd-workflow
- **Repo:** https://github.com/affaan-m/everything-claude-code
- **Why rejected:** Django-specific TDD skill (Django test factories, pytest-django patterns). bGSD is a Node.js CLI tool with node:test — no Django stack, no Django test patterns applicable.

### github/spec-kit
- **Repo:** https://github.com/github/spec-kit
- **Why rejected:** Orchestrates obra/superpowers skills within an SDD (Spec-Driven Development) workflow. Same Git-worktree dependency as superpowers core. Not a standalone skill, not installable independently.

### gentleman-programming/agent-teams-lite/sdd-apply
- **Repo:** https://github.com/Gentleman-Programming/agent-teams-lite
- **Why rejected:** Mentions TDD only in passing ("run ONLY the relevant test file/suite during TDD"). This is a micro-efficiency tip, not a comprehensive TDD skill. Also targets a different agent framework.

## Selection Criteria

- Repositories must be real, directly installable skill repos with `SKILL.md`
- Recommendations must materially help this milestone, not just be generally interesting
- Prefer skills that complement the project's current stack and workflow
- Prefer high-confidence, clearly scoped skills over broad or speculative ones
- Skills must not require non-bGSD execution models (Git worktrees, Python runtimes, Claude Code toolchains)

## Sources

- agentskills.me registry (490 skills, searched "tdd", "workflow acceleration", "session handoff", "batch") — https://agentskills.me/
- agentskills.so marketplace (obra/superpowers TDD skill, softaworks/agent-toolkit session-handoff) — https://agentskills.so/
- awesome-opencode list (4.8k stars, comprehensive OpenCode plugin/skill registry) — https://github.com/awesome-opencode/awesome-opencode
- awesome-claude-skills collection (24k+ stars, searched TDD and workflow patterns) — https://github.com/ComposioHQ/awesome-claude-skills
- GitHub direct search (opencode SKILL.md tdd/test-driven/verification/batch/accelerate) — multiple repos inspected
- obra/superpowers repo (33k+ stars, gold-standard TDD skill, but requires full superpowers system) — https://github.com/obra/superpowers
- beholder20/superpowers-opencode fork (OpenCode-specific superpowers, 0 stars, unmaintained) — https://github.com/beholder20/superpowers-opencode
- joshuadavidthomas/opencode-handoff (OpenCode-native session transfer) — https://github.com/joshuadavidthomas/opencode-handoff
- softaworks/agent-toolkit (1.4k stars, session-handoff skill with Python scripts) — https://github.com/softaworks/agent-toolkit

---
*Research completed: 2026-04-06*
*Ready to propose to user: no — no external skills meet the bar for v19.4*
