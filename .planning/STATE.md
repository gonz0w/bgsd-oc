# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance
**Current focus:** v9.0 Embedded Plugin Experience — Plugin Architecture & Safety

## Current Position

**Phase:** 76 — Advisory Guardrails
**Current Plan:** Not started
**Status:** Milestone complete
**Last Activity:** 2026-03-09

**Progress:** [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 161 (v1.0-v8.3)
- Average duration: ~15 min/plan
- Total execution time: ~33 hours

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
| v8.1 | 5 | 10 | 1 day |
| v8.2 | 6 | 14 | 5 days |
| v8.3 | 4 | 11 | 2 days |
| Phase 71 P01 | 19 min | 3 tasks | 6 files |
| Phase 71 P02 | 9 min | 3 tasks | 10 files |
| Phase 72 P01 | 19 min | 2 tasks | 17 files |
| Phase 72 P02 | 9 min | 2 tasks | 12 files |
| Phase 72 P03 | 8 min | 2 tasks | 100 files |
| Phase 72 P04 | 11 min | 2 tasks | 7 files |
| Phase 73 P01 | 12 min | 2 tasks | 10 files |
| Phase 73 P02 | 11 min | 2 tasks | 6 files |
| Phase 73 P03 | 11 min | 2 tasks | 21 files |
| Phase 74 P01 | 10 min | 2 tasks | 6 files |
| Phase 74 P02 | 16 min | 3 tasks | 7 files |
| Phase 75 P01 | 11 min | 3 tasks | 3 files |
| Phase 75 P02 | 42 min | 3 tasks | 7 files |
| Phase 76 P01 | 14 min | 2 tasks | 2 files |
| Phase 76 P02 | 33 min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

All v1.0-v8.3 decisions recorded in PROJECT.md Key Decisions table with outcomes.
- [Phase 71]: Plugin source uses ESM imports for clean esbuild output — CJS source with externalized Node builtins produced __require() shims that failed CJS leak validation; ESM imports are the correct approach for esbuild format: esm
- [Phase 71]: Plugin parsers are self-contained — regex patterns copied from CLI source, no imports from src/lib/ to keep plugin bundle independent
- [Phase 72]: Renamed all GSD_ env vars to BGSD_ prefix, config paths from get-shit-done to bgsd-oc, CLI binary from gsd-tools to bgsd-tools — clean break, no backward compat with old naming in source
- [Phase 72]: All 10 agent files renamed gsd-*.md -> bgsd-*.md with BGSD_HOME path setup; install.js migration copies get-shit-done to bgsd-oc and cleans up old agent files
- [Phase 72]: Bulk renamed gsd-* to bgsd-* across 100 markdown files (workflows, commands, templates, skills, AGENTS.md) — Completes rebrand of user-facing and agent-facing markdown interface files
- [Phase 72]: Updated source agent scope/routing keys gsd-* → bgsd-* alongside test file rename — fixes model resolution fallback bug from Plan 01 partial rename — MODEL_PROFILES keys were already bgsd-* but AGENT_MANIFESTS and resolveModelInternal calls still used gsd-*, causing silent fallback to sonnet defaults
- [Phase 73]: System prompt injection via chars/4 token estimator (not tokenx) — 70 tokens, well under 500-token budget — tokenx is bundled in CLI but not ESM plugin; chars/4 sufficient for budget enforcement
- [Phase 73]: Enhanced compaction uses task-state (not task) XML tag to avoid conflicts with PLAN.md task tags; each block independently failable — PLAN.md files contain <task> elements that would conflict with compaction <task> tags; independent failure means partial context is preserved even if one parser fails
- [Phase 73]: All 19 workflows migrated from init:* subprocess calls to plugin-injected <bgsd-context> — plugin is mandatory for v9.0, no fallback — Completing the transition from subprocess-based to plugin-based context injection makes init:* calls obsolete
- [Phase 74]: Three read-only LLM tools (bgsd_status, bgsd_plan, bgsd_context) with Zod schemas, tool barrel registration, JSON.stringify returns — Zod v4 bundled into plugin.js (39KB→548KB), CONTEXT.md anticipated size growth
- [Phase 74]: bgsd_validate (read-only validation) and bgsd_progress (state mutation with file locking) complete 5-tool surface area — safeHook fixed to pass through return values for tool execute()
- [Phase 75]: Notification system uses dual-channel routing (OS for critical/warning, context injection for all) with sliding-window rate limiting, deduplication, DND mode, and ring buffer history
- [Phase 75]: File watcher uses native fs.watch with recursive option and AbortController — self-write tracking prevents feedback loops between auto-fix and cache invalidation
- [Phase 75]: Config parser extended with NESTED_OBJECT_KEYS shallow merge — user overrides individual sub-keys while preserving other defaults
- [Phase 75]: Idle validator uses execSync git log for stale progress detection with 3s timeout — acceptable for idle-time operation, auto-fix loop prevention via lastAutoFix/lastValidation comparison
- [Phase 75]: Plugin factory signature extended from ({directory}) to ({directory, $}) for shell API access — enables OS notifications via osascript/notify-send
- [Phase 76]: Advisory guardrails module uses inline naming classifiers (CJS→ESM boundary) — NAMING_PATTERNS and classifyName copied from conventions.js rather than importing across module boundaries
- [Phase 76]: Convention detection priority: AGENTS.md keyword scan first, codebase-intel.json fallback with configurable confidence threshold (default 70%)
- [Phase 76]: Removed overly aggressive /tmp/ path filter from guardrails; fixed GARD-02 operator precedence bug — Path filter blocked temp-dir projects; missing parens caused Windows check to bypass enabled flag

### Pending Todos

None — milestone starting fresh.

### Blockers/Concerns

- Bundle at 1153KB (acorn 230KB now lazy-loaded, effective cold-start 923KB)
- Plugin hooks prefixed with `experimental.` may change without notice (system.transform, compacting, messages.transform, text.complete)
- Plugin.js is ESM, bgsd-tools.cjs is CJS — two separate esbuild targets required
- Custom tool names must use `bgsd_` prefix to avoid shadowing built-in tools
- Rebrand is a clean break — no backward compatibility with old `gsd-*` naming

## Session Continuity

**Last session:** 2026-03-09T18:08:24.794Z
**Stopped at:** Completed 76-02-PLAN.md
**Next step:** Execute Phase 76 Plan 02 (wire guardrails into plugin index.js)
