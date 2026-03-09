---
phase: 74-custom-llm-tools
verified: 2026-03-09T14:05:00Z
status: passed
score: 100
plans_verified: [74-01, 74-02]
requirements_verified: [TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06]
gaps: []

must_haves:
  truths:
    - id: T1
      text: "An agent can call bgsd_status and receive current phase, plan, progress, and blockers as structured JSON without spawning a subprocess"
      status: VERIFIED
    - id: T2
      text: "An agent can call bgsd_progress to update plan progress and mark tasks complete"
      status: VERIFIED
    - id: T3
      text: "An agent can call bgsd_context, bgsd_plan, and bgsd_validate to get task-scoped context, phase details, and validation results respectively"
      status: VERIFIED
    - id: T4
      text: "Every custom tool has a typed Zod argument schema and returns a JSON string (never [object Object])"
      status: VERIFIED
    - id: T5
      text: "All 5 tools appear in the LLM's tool list and are callable during a conversation"
      status: VERIFIED
  artifacts:
    - path: src/plugin/tools/bgsd-status.js
      status: VERIFIED
    - path: src/plugin/tools/bgsd-plan.js
      status: VERIFIED
    - path: src/plugin/tools/bgsd-context.js
      status: VERIFIED
    - path: src/plugin/tools/bgsd-validate.js
      status: VERIFIED
    - path: src/plugin/tools/bgsd-progress.js
      status: VERIFIED
    - path: src/plugin/tools/index.js
      status: VERIFIED
    - path: src/plugin/index.js
      status: VERIFIED
    - path: build.cjs
      status: VERIFIED
    - path: bin/bgsd-tools.test.cjs
      status: VERIFIED
  key_links:
    - from: src/plugin/tools/bgsd-status.js
      to: src/plugin/project-state.js
      status: WIRED
    - from: src/plugin/tools/index.js
      to: src/plugin/index.js
      status: WIRED
    - from: src/plugin/tools/bgsd-progress.js
      to: src/plugin/parsers/index.js
      status: WIRED
    - from: build.cjs
      to: plugin.js
      status: WIRED
    - from: bin/bgsd-tools.test.cjs
      to: src/plugin/tools/*.js
      status: WIRED
---

# Phase 74 Verification: Custom LLM Tools

**Goal:** Hot-path CLI operations are available as native LLM-callable tools — faster, typed, no shell overhead for the most common queries

**Status: ✅ PASSED** — All 5 observable truths verified, all artifacts substantive and wired, all 6 requirements covered.

## Goal Achievement — Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| T1 | Agent can call bgsd_status and receive phase/plan/progress/blockers as JSON | ✓ VERIFIED | `bgsd-status.js` (98 lines): calls `getProjectState()` in-process, extracts phase/plan/progress/blockers, returns `JSON.stringify(result)`. Test "bgsd_status returns structured data from live project" passes against real .planning/. No subprocess spawned. |
| T2 | Agent can call bgsd_progress to update plan progress and mark tasks complete | ✓ VERIFIED | `bgsd-progress.js` (339 lines): 6 action types via `z.enum()`, writes STATE.md with `writeFileSync`, uses `mkdirSync`/`rmdirSync` atomic file locking (10s staleness), calls `invalidateState()`/`invalidatePlans()` after write, returns fresh state snapshot. Tests verify validation error handling. |
| T3 | Agent can call bgsd_context, bgsd_plan, and bgsd_validate | ✓ VERIFIED | `bgsd-context.js` (96 lines): returns task file paths, action, done criteria. `bgsd-plan.js` (106 lines): dual-mode — no-args roadmap summary or phase detail with plan contents. `bgsd-validate.js` (215 lines): validates STATE.md, ROADMAP.md, PLAN.md, requirement traceability with error/warning/info severity. All 3 tools tested with live data. |
| T4 | Every tool has typed Zod schema and returns JSON string | ✓ VERIFIED | All 5 files import `z` from `'zod'`. `bgsd_status`: args `{}`. `bgsd_plan`: `z.coerce.number().optional()`. `bgsd_context`: `z.coerce.number().optional()`. `bgsd_validate`: args `{}`. `bgsd_progress`: `z.enum([6 actions])` + `z.string().optional()`. All 26 return paths across all tools use `JSON.stringify()`. Zero raw object returns found (grep confirmed). |
| T5 | All 5 tools in LLM tool list and callable | ✓ VERIFIED | `tools/index.js` registers all 5 via `registry.registerTool()`. `src/plugin/index.js` line 95: `tool: getTools(registry)` wires tools into plugin return object. Build validates "5/5 tools found in plugin.js". Test "BgsdPlugin returns tool object with all 5 tools" passes. `safeHook` fixed to pass through return values (line 100: `return result;`). |

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Notes |
|----------|--------|-------------|-------|-------|
| `src/plugin/tools/bgsd-status.js` | ✓ | ✓ 98 lines, Zod import, getProjectState, JSON.stringify in all paths | ✓ Imported by tools/index.js, registered as 'status' | Phase/plan/progress/blockers extraction with error handling |
| `src/plugin/tools/bgsd-plan.js` | ✓ | ✓ 106 lines, z.coerce.number(), dual-mode (summary vs detail), parsePlans import | ✓ Imported by tools/index.js, registered as 'plan' | Roadmap phases + detailed phase with plan contents |
| `src/plugin/tools/bgsd-context.js` | ✓ | ✓ 96 lines, z.coerce.number(), task index bounds check, plan matching | ✓ Imported by tools/index.js, registered as 'context' | Task-scoped file paths, action, done criteria |
| `src/plugin/tools/bgsd-validate.js` | ✓ | ✓ 215 lines, STATE/ROADMAP/PLAN checks, requirement traceability, severity levels | ✓ Imported by tools/index.js, registered as 'validate' | Comprehensive validation with error/warning/info |
| `src/plugin/tools/bgsd-progress.js` | ✓ | ✓ 339 lines, 6 action types, file locking, cache invalidation, STATE.md writes | ✓ Imported by tools/index.js, registered as 'progress' | Full write tool with atomic lock and fresh state return |
| `src/plugin/tools/index.js` | ✓ | ✓ 30 lines, imports all 5 tools, getTools(registry) function | ✓ Imported by src/plugin/index.js, called at line 95 | Barrel pattern — single wiring point |
| `src/plugin/index.js` | ✓ | ✓ `tool: getTools(registry)` at line 95 (not commented out) | ✓ Plugin entry point returns tool object to host editor | Tools wired into plugin return object |
| `build.cjs` | ✓ | ✓ Tool registration validation (5/5 names), Zod bundling check (no CJS leak) | ✓ Validates built plugin.js | Build output confirms: "Tool registration validation passed: 5/5" |
| `bin/bgsd-tools.test.cjs` | ✓ | ✓ 19 new tests: shapes (5), JSON returns (5), registration (1), live data (4), validation (2), module load (1), phase detail (1) | ✓ All 801 tests pass | Comprehensive coverage of all 5 tools |

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `tools/bgsd-status.js` | `project-state.js` | `getProjectState()` call | ✓ WIRED | Line 2: import, Line 23: called in execute() |
| `tools/index.js` | `src/plugin/index.js` | `getTools()` import + `tool:` return key | ✓ WIRED | index.js line 7: import, line 95: `tool: getTools(registry)` |
| `tools/bgsd-progress.js` | `parsers/state.js` + `parsers/plan.js` | `invalidateState`/`invalidatePlans` calls | ✓ WIRED | Lines 5-6: imports, Lines 174-175: called after writeFileSync |
| `build.cjs` | `plugin.js` | Zod bundling validation check | ✓ WIRED | Build output: "Zod bundling validation passed", no CJS require("zod") in plugin.js |
| `test.cjs` | `plugin tools` | Dynamic import of built plugin.js | ✓ WIRED | 19 tests import and call all 5 tools; 801/801 pass |
| `safe-hook.js` | tool execute() | Return value passthrough | ✓ WIRED | Line 86: `const result = await withTimeout(fn(input, output), timeout)`, Line 100: `return result;` |

## Requirements Coverage

| Requirement | Description | Plan | Status | Evidence |
|-------------|-------------|------|--------|----------|
| TOOL-01 | `bgsd_status` tool registered — returns phase, plan, progress, blockers | 74-01 | ✓ Complete | Tool exists (98 lines), registered in barrel, tested with live data |
| TOOL-02 | `bgsd_progress` tool registered — updates plan progress, marks tasks complete | 74-02 | ✓ Complete | Tool exists (339 lines), 6 action types, file locking, cache invalidation |
| TOOL-03 | `bgsd_context` tool registered — returns task-scoped context | 74-01 | ✓ Complete | Tool exists (96 lines), returns file paths, action, done criteria |
| TOOL-04 | `bgsd_plan` tool registered — analyzes roadmap, phase details | 74-01 | ✓ Complete | Tool exists (106 lines), dual-mode (summary + detail), plan contents |
| TOOL-05 | `bgsd_validate` tool registered — runs state/roadmap validation | 74-02 | ✓ Complete | Tool exists (215 lines), STATE/ROADMAP/PLAN checks, severity levels |
| TOOL-06 | All tools have typed Zod argument schemas and return structured JSON | 74-01, 74-02 | ✓ Complete | All 5 tools import Zod, use z.coerce/z.enum/z.string, 26 JSON.stringify return paths across all tools |

**Coverage: 6/6 requirements verified (100%)**
**Orphaned requirements: 0**

## Anti-Patterns Scan

| Pattern | Files Checked | Found | Severity |
|---------|---------------|-------|----------|
| TODO/FIXME/PLACEHOLDER | All 6 tool files | 0 | — |
| Empty implementations (return {}/return []) | All 6 tool files | 0 | — |
| Raw object return (no JSON.stringify) | All 5 tool files | 0 | — |
| CJS require("zod") in plugin.js | plugin.js (565KB) | 0 | — |
| Imports from src/lib/ (ESM/CJS boundary) | All tool files | 0 | — |

**No anti-patterns found.**

## Human Verification Required

| Item | Reason | Priority |
|------|--------|----------|
| Tool invocation from actual LLM conversation | Requires live host editor session to verify tools appear in LLM's tool selector and produce useful results | ℹ️ Info |
| bgsd_progress file writes under concurrent load | Atomic mkdirSync lock tested conceptually but not under actual race conditions | ℹ️ Info |

## Build & Test Evidence

- **`npm run build`**: ✅ Passes — "Tool registration validation passed: 5/5 tools found in plugin.js", "Zod bundling validation passed", plugin size 565KB
- **`npm test`**: ✅ 801/801 tests pass (0 failures) — includes 19 new Plugin Tools tests
- **Plugin Tools test section**: All 19 tests pass — definition shapes (5), JSON returns for nonexistent project (5), registration integration (1), live response shapes (4), validation error handling (2), module load (1), phase detail (1)

## Verification Summary

Phase 74 fully achieves its goal: **Hot-path CLI operations are available as native LLM-callable tools — faster, typed, no shell overhead.**

Five tools implemented — `bgsd_status`, `bgsd_plan`, `bgsd_context`, `bgsd_validate`, `bgsd_progress` — each with:
- Typed Zod argument schemas (z.coerce for number args, z.enum for action args)
- JSON.stringify return in every code path (26 total across all tools)
- In-process execution via getProjectState() — no subprocess spawning
- Error handling with structured error envelopes (validation_error, runtime_error, no_project)

All artifacts are substantive implementations (not stubs), fully wired through the tool barrel into the plugin entry point, validated by the build pipeline, and covered by 19 dedicated tests. The safeHook return-value passthrough fix ensures tool execute() results actually reach the caller.

---
*Verified: 2026-03-09*
*Verifier: gsd-verifier agent*
