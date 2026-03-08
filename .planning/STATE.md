# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance
**Current focus:** Between milestones — v8.2 shipped, next milestone TBD

## Current Position

Phase: N/A — milestone complete
Plan: N/A
Status: v8.2 shipped — ready for `/bgsd-new-milestone`
Last activity: 2026-03-08 - Completed quick task 11: Setup GitHub CI agent/workflow for automation

Progress: v8.2 complete — 12 milestones shipped

## Performance Metrics

**Velocity:**
- Total plans completed: 126 (v1.0-v8.0)
- Average duration: ~15 min/plan
- Total execution time: ~27 hours

**By Milestone:**

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v1.0 | 5 | 14 | 2 days |
| v1.1 | 4 | 10 | 1 day |
| v2.0 | 4 | 13 | 3 days |
| v3.0 | 4 | 10 | 1 day |
| v4.0 | 5 | 13 | 1 day |
| v5.0 | 7 | 14 | 2 days |
| v6.0 | 7 | 11 | 1 day |
| v7.0 | 8 | 15 | 2 days |
| v7.1 | 6 | 12 | 3 days |
| v8.0 | 5 | 14 | 3 days |
| Phase 56 P01 | 8 min | 2 tasks | 3 files |
| Phase 56 P02 | 7 min | 2 tasks | 5 files |
| Phase 57 P01 | 5 min | 2 tasks | 4 files |
| Phase 57 P02 | 5min | 2 tasks | 4 files |
| Phase 58 P01 | 5 min | 2 tasks | 4 files |
| Phase 58 P02 | 2 min | 2 tasks | 1 files |
| Phase 59 P01 | 11 min | 2 tasks | 4 files |
| Phase 59 P02 | 8min | 2 tasks | 5 files |
| Phase 60 P01 | 13 min | 2 tasks | 5 files |
| Phase 60 P02 | 18 min | 2 tasks | 3 files |
| Phase 60 P02 | 18 min | 2 tasks | 3 files |
| Phase 61 P01 | 23 min | 2 tasks | 3 files |
| Phase 61 P02 | 9 min | 2 tasks | 7 files |
| Phase 62 P01 | 3 min | 2 tasks | 4 files |
| Phase 62 P02 | 3 min | 2 tasks | 4 files |
| Phase 63 P01 | 16 min | 2 tasks | 24 files |
| Phase 63 PP02 | 16 min | 2 tasks | 3 files |
| Phase 63 P03 | 17 min | 2 tasks | 12 files |
| Phase 64 P01 | 29 min | 2 tasks | 5 files |
| Phase 64 P02 | 83 min | 2 tasks | 34 files |
| Phase 65-01 P01 | 27 min | 2 tasks | 2 files |
| Phase 65 P02 | 12 min | 2 tasks | 3 files |
| Phase 66 P01 | 4 min | 2 tasks | 10 files |
| Phase 66 P02 | 7 min | 2 tasks | 9 files |
| Phase 66 P03 | 19 min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

All v1.0-v8.0 decisions recorded in PROJECT.md Key Decisions table with outcomes.

- [v8.1 Research]: Build YouTube/yt-dlp first (low risk), NotebookLM last (highest risk — unofficial API)
- [v8.1 Research]: 4-tier graceful degradation: Full RAG → Sources without synthesis → Brave/Context7 only → Pure LLM
- [v8.1 Research]: All external tools invoked via execFileSync subprocess pattern (matching git.js), zero bundled deps
- [v8.1 Research]: NotebookLM is a quality enhancer, never a requirement — pipeline works at Tier 2-3 without it
- [Phase 56]: MCP config detection handles 3 JSON shapes (mcpServers, mcp.servers, mcp-direct) for cross-editor compatibility
- [Phase 56]: notebooklm-py detection falls back to 'nlm' binary name for alternate installations
- [Phase 56]: Tier calculation shared via calculateTier() — DRY between capabilities command and init output
- [Phase 56]: research namespace added as top-level command namespace for clean separation
- [Phase 57]: Quality score weights: recency 40pts + views 30pts (log-scale) + duration 30pts (bell curve at 15-20min) — demotes clickbait
- [Phase 57]: yt-dlp check runs before query validation — fail fast on missing dependency
- [Phase 57]: VTT auto-sub deduplication strips consecutive identical lines for clean agent consumption
- [Phase 57]: Full transcript always returned in JSON — TTY display truncation only, no data loss
- [Phase 58]: Per-stage timeout splits rag_timeout budget evenly — prevents one slow stage consuming all time
- [Phase 58]: Only top YouTube video gets transcript — expensive operation with diminishing returns beyond first
- [Phase 58]: agent_context uses XML tags not JSON — LLMs parse XML attributes reliably in context windows
- [Phase 58]: Workflow source injection conditional on tier < 4 — zero regression at tier 4, collection failure = silent fallback
- [Phase 59]: Auth health probe uses 'notebooklm list --json' — cheapest NLM operation that validates cookies before any mutation
- [Phase 59]: nlm-add-source uses 60s timeout — source processing (URL fetch + indexing) is slow, 30s causes false failures
- [Phase Phase 59]: collectNlmSynthesis() wrapped in single try/catch — any error returns null for silent Tier 1 fallback
- [Phase Phase 59]: Tier 1 synthesis loads top 3 URL sources into session notebook — balances coverage against NLM API timeout risk
- [Phase 60]: research cache keyed on query string — exact match semantics, TTL 1 hour, LRU eviction
- [Phase 60]: cache write skipped if source_count=0 — avoids caching empty/failed pipeline runs
- [Phase 60]: 'cache' namespace added to router (cache:research-stats, cache:research-clear) for symmetry with 'research' namespace
- [Phase 60]: Session file for research:collect keyed on query string — exact match required for resume, different query = fresh run
- [Phase 60]: deleteSession() called after successful output — session only deleted when all pipeline stages complete
- [Phase 60]: Per-stage checkpoint: each stage (web/youtube/context7/nlm) writes session file immediately after completion
- [Phase 61]: Metafile analysis groups by directory prefix — scoped packages handled via @org/pkg detection
- [Phase 61]: build-analysis.json stays gitignored — regenerated each build, avoids noisy diffs
- [Phase 61]: Source files >50KB warn but don't fail — visibility for Phase 65 optimization targets
- [Phase 61]: Old manifest snapshot before copy loop — prevents self-comparison during stale file detection
- [Phase 61]: /proc/self/io for fs I/O counting — reliable on Linux without strace, falls back to zeros
- [Phase 61]: performance.json un-gitignored — git history preserves baseline snapshots per CONTEXT.md decision
- [Phase Phase 62]: Router-consumed check takes priority over cross-module — most knip false positives are router dispatch
- [Phase Phase 62]: Internal helper classification separates exports used within-file from truly dead code
- [Phase 62]: 281 commands tracked (namespaced + legacy) — high orphan count from duplicate forms, not missing functionality
- [Phase 62]: 4 exports reclassified from truly_dead/internal to documented_helper via markdown reference scan
- [Phase 62]: Phase 63 removal scope is conservative: 0 exports, 1 file — most knip findings are router dispatch false positives
- [Phase 63]: ~80 internal helper exports removed from module.exports across 24 files — 15 fewer than planned due to cross-module false positives
- [Phase 63]: branchInfo/trajectoryBranch kept in git.js — router-consumed, not internal despite audit classification
- [Phase 63]: detectCliTools/detectMcpServers/calculateTier kept in research.js — cross-module imports from init.js
- [Phase 63]: Both colon-form and space-form COMMAND_HELP entries retained — help lookup uses exact key match
- [Phase 63]: Removed 4 dead CONFIG_SCHEMA keys (model_profiles, mcp_brave_enabled, mcp_context7_enabled, mcp_exa_enabled) — never consumed by source
- [Phase 63]: All 11 dead .md files confirmed via rg safety check before deletion — verify-phase reference replaced with verify-work in roadmap template
- [Phase Phase 64]: Namespace-only routing: all 20 flat-only commands migrated to namespace routes, ~890-line backward-compat block removed
- [Phase Phase 64]: Semantic duplicate codebase-impact (features.js) removed with flat block; util:codebase impact (codebase.js) is canonical
- [Phase 64]: verify:verify sub-subcommand pattern: analyze-plan, regression, plan-wave, plan-deps, plan-structure, quality all route via verify:verify
- [Phase 64]: util:mcp profile is the canonical form for mcp-profile command (accessed as util namespace, mcp subcommand, profile sub-subcommand)
- [Phase 64]: COMMAND_HELP cleaned to namespaced-only keys; init:* internal entries removed, util:config-migrate restored as user-facing
- [Phase 65-01]: Lazy-load acorn inside parseWithAcorn() — single entry point for all 4 public AST functions
- [Phase 65-01]: Bundle file size stays 1153KB (esbuild can't tree-shake dynamic require) but effective cold-start reduced 230KB
- [Phase 65-02]: Replace autoTriggerCodebaseIntel with readCodebaseIntel in init fast paths — stale-but-fast acceptable per CONTEXT.md
- [Phase 65-02]: Cache getGitInfo per invocation and combine rev-parse calls — eliminates 3 redundant git subprocess spawns
- [Phase 66]: 23 lifecycle steps at sub-stage granularity for RACI matrix; dual-source contract design with agent frontmatter + central RACI.md
- [Phase 66]: All 9 agent tool grants verified as actually used — zero removals after conservative static analysis
- [Phase 66]: Reviewer agent kept as references/reviewer-agent.md — review protocol loaded by executor, not a standalone agent
- [Phase 66]: Zero agent pairs have >50% RACI overlap — current 9-agent architecture has clean separation of concerns
- [Phase 66]: Specialized parseContractArrays for agent I/O instead of modifying core extractFrontmatter — avoids breaking existing consumers
- [Phase 66]: RACI.md resolution: GSD_HOME/references > cwd/references > agents/ — supports both deployed and dev workspace workflows

### Pending Todos

None — milestone starting fresh.

### Blockers/Concerns

- Bundle at 1153KB (acorn 230KB now lazy-loaded, effective cold-start 923KB)
- Two pre-existing config-migrate test failures (from Phase 56 RAG key additions) need cleanup
- 31 pre-existing test failures (config-migrate, compact, codebase-impact, codebase ast CLI handler)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 6 | Review plugin and ensure it follows best practices for an OpenCode plugin | 2026-03-07 | 053d23a | .planning/quick/6-review-plugin-and-ensure-it-follows-best |
| 7 | Address critical and warning findings from OpenCode best practices audit | 2026-03-07 | 015b9c5 | .planning/quick/7-address-critical-and-warning-findings-fr |
| 8 | Make bGSD a full OpenCode plugin for npm distribution | 2026-03-07 | 9bd9bd1 | .planning/quick/8-make-bgsd-a-full-opencode-plugin-using-o |
| 9 | Streamline README and update getting-started.md install method | 2026-03-07 | f07f5a9 | .planning/quick/9-streamline-readme-and-create-docs-folder |
| 10 | Fix plugin.js GSD_HOME to always resolve via homedir() | 2026-03-08 | dcbdfe5 | .planning/quick/10-fix-plugin-to-always-resolve-get-shit-do |
| 11 | Setup GitHub CI agent/workflow for automation | 2026-03-08 | db52f5d | .planning/quick/11-setup-github-ci-agent-workflow-for-autom |

## Session Continuity

Last session: 2026-03-08
Stopped at: Completed quick task 11: Setup GitHub CI agent/workflow for automation
Next step: Run `/bgsd-github-ci` to test the new CI flow, or continue with `/bgsd-new-milestone`
