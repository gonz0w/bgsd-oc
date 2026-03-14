# Feature Research: CLI Command Routing Audit

**Domain:** CLI Command Routing — bGSD Plugin v11.4 Housekeeping
**Researched:** 2026-03-13
**Confidence:** HIGH (source-of-truth analysis of router.js, constants.js, commandDiscovery.js, 41 slash commands, 43 workflows, 24 command modules)

<!-- section: compact -->
<features_compact>
**Critical findings (must fix):**
- 2 missing CLI routes called by workflows (`verify:handoff`, `verify:agents`) — execute-phase.md L190, L196
- 1 orphaned command module (`src/commands/ci.js`) — no lazy loader, no router route, never imported
- 1 namespace missing from validator (`audit` not in `commandDiscovery.js` routerImplementations)
- 20 routed commands missing `COMMAND_HELP` entries (no `--help` output)

**Moderate findings (should fix):**
- 5 stale subcommand lists in `commandDiscovery.js` routerImplementations vs actual router
- 2 duplicate routes: `runtime` and `measure` exist as both `util:` and standalone commands
- `bgsd-quick.md` slash command has no workflow reference (orphaned wrapper)
- `execute:profile` route in router just returns an error message — dead route

**Low priority:**
- 13 init namespace commands have no COMMAND_HELP entries (internal-only, acceptable)
- 5 cache namespace commands have no COMMAND_HELP entries
- Research namespace has duplicate help entries (space and colon format) — intentional for backward compat

**Key dependencies:** All fixes are independent; no ordering constraints
</features_compact>
<!-- /section -->

<!-- section: feature_landscape -->
## Complete Route Inventory

### Registered Namespaces (router.js L230)

| Namespace | KNOWN_NAMESPACES | Router case | commandDiscovery |
|-----------|:----------------:|:-----------:|:----------------:|
| init      | ✓                | ✓           | ✓                |
| plan      | ✓                | ✓           | ✓                |
| execute   | ✓                | ✓           | ✓                |
| verify    | ✓                | ✓           | ✓                |
| util      | ✓                | ✓           | ✓                |
| research  | ✓                | ✓           | ✓                |
| cache     | ✓                | ✓           | ✓                |
| audit     | ✓                | ✓           | **MISSING**       |
| decisions | ✓                | ✓           | ✓                |

**Issue:** `audit` namespace added to KNOWN_NAMESPACES and router but never added to `commandDiscovery.js` `routerImplementations` object. This causes `util:validate-commands` to report `audit:scan` as invalid.

### init Namespace Routes (13 commands)

| Route | Handler | Module | Exported | COMMAND_HELP | Workflow Callers |
|-------|---------|--------|:--------:|:------------:|-----------------|
| init:execute-phase | cmdInitExecutePhase | init.js | ✓ | ✗ | execute-phase.md (indirect) |
| init:plan-phase | cmdInitPlanPhase | init.js | ✓ | ✗ | plan-phase.md (indirect) |
| init:new-project | cmdInitNewProject | init.js | ✓ | ✗ | new-project.md (indirect) |
| init:new-milestone | cmdInitNewMilestone | init.js | ✓ | ✗ | new-milestone.md (indirect) |
| init:quick | cmdInitQuick | init.js | ✓ | ✗ | quick.md (indirect) |
| init:resume | cmdInitResume | init.js | ✓ | ✗ | resume-project.md (indirect) |
| init:verify-work | cmdInitVerifyWork | init.js | ✓ | ✗ | verify-work.md (indirect) |
| init:phase-op | cmdInitPhaseOp | init.js | ✓ | ✗ | add/insert/remove-phase.md |
| init:todos | cmdInitTodos | init.js | ✓ | ✗ | add-todo/check-todos.md |
| init:milestone-op | cmdInitMilestoneOp | init.js | ✓ | ✗ | complete-milestone.md |
| init:map-codebase | cmdInitMapCodebase | init.js | ✓ | ✗ | map-codebase.md |
| init:progress | cmdInitProgress | init.js | ✓ | ✗ | progress.md |
| init:memory | cmdInitMemory | init.js | ✓ | ✗ | pause-work.md |

**Assessment:** All init routes are functional. Missing COMMAND_HELP is low priority — these are context-injection commands called by the plugin system, not by users directly.

### plan Namespace Routes (7 top-level, 20+ sub-routes)

| Route | Handler | Module | Exported | COMMAND_HELP | Workflow Callers |
|-------|---------|--------|:--------:|:------------:|-----------------|
| plan:intent create | cmdIntentCreate | intent.js | ✓ | ✓ | new-project.md |
| plan:intent show | cmdIntentShow | intent.js | ✓ | ✓ | new-milestone.md |
| plan:intent read | cmdIntentShow(raw=true) | intent.js | ✓ | ✓ | — |
| plan:intent update | cmdIntentUpdate | intent.js | ✓ | ✓ | — |
| plan:intent validate | cmdIntentValidate | intent.js | ✓ | ✓ | — |
| plan:intent trace | cmdIntentTrace | intent.js | ✓ | ✓ | — |
| plan:intent drift | cmdIntentDrift | intent.js | ✓ | ✓ | — |
| plan:requirements mark-complete | cmdRequirementsMarkComplete | phase.js | ✓ | ✓ | execute-plan.md |
| plan:roadmap get-phase | cmdRoadmapGetPhase | roadmap.js | ✓ | ✓ | plan-phase.md, research-phase.md |
| plan:roadmap analyze | cmdRoadmapAnalyze | roadmap.js | ✓ | ✓ | progress.md, complete-milestone.md, transition.md |
| plan:roadmap update-plan-progress | cmdRoadmapUpdatePlanProgress | roadmap.js | ✓ | ✓ | execute-plan.md |
| plan:phases list | cmdPhasesList | phase.js | ✓ | ✓ | audit-milestone.md, plan-milestone-gaps.md |
| plan:find-phase | cmdFindPhase | misc.js | ✓ | ✓ | audit-milestone.md |
| plan:milestone complete | cmdMilestoneComplete | phase.js | ✓ | ✓ | complete-milestone.md |
| plan:milestone summary | cmdMilestoneSummary | milestone.js | ✓ | ✓ | — |
| plan:milestone info | cmdMilestoneInfo | milestone.js | ✓ | ✓ | — |
| plan:phase next-decimal | cmdPhaseNextDecimal | phase.js | ✓ | ✓ | — |
| plan:phase add | cmdPhaseAdd | phase.js | ✓ | ✓ | add-phase.md |
| plan:phase insert | cmdPhaseInsert | phase.js | ✓ | ✓ | insert-phase.md |
| plan:phase remove | cmdPhaseRemove | phase.js | ✓ | ✓ | remove-phase.md |
| plan:phase complete | cmdPhaseComplete | phase.js | ✓ | ✓ | execute-phase.md, transition.md |

**Assessment:** All plan routes are fully functional and documented.

### execute Namespace Routes (9 top-level, 18+ sub-routes)

| Route | Handler | Module | Exported | COMMAND_HELP | Workflow Callers |
|-------|---------|--------|:--------:|:------------:|-----------------|
| execute:commit | cmdCommit | misc.js | ✓ | ✓ | 16 workflows |
| execute:rollback-info | cmdRollbackInfo | features.js | ✓ | ✓ | cmd-rollback-info.md |
| execute:session-diff | cmdSessionDiff | features.js | ✓ | ✓ | cmd-session-diff.md |
| execute:session-summary | cmdSessionSummary | features.js | ✓ | ✓ | — |
| execute:velocity | cmdVelocity | features.js | ✓ | ✓ | cmd-velocity.md |
| execute:worktree create | cmdWorktreeCreate | worktree.js | ✓ | ✓ | execute-phase.md |
| execute:worktree list | cmdWorktreeList | worktree.js | ✓ | ✓ | — |
| execute:worktree remove | cmdWorktreeRemove | worktree.js | ✓ | ✓ | — |
| execute:worktree cleanup | cmdWorktreeCleanup | worktree.js | ✓ | ✓ | execute-phase.md |
| execute:worktree merge | cmdWorktreeMerge | worktree.js | ✓ | ✓ | execute-phase.md |
| execute:worktree check-overlap | cmdWorktreeCheckOverlap | worktree.js | ✓ | ✓ | — |
| execute:tdd * | cmdTdd | misc.js | ✓ | ✓ | tdd.md, execute-plan.md |
| execute:test-run | cmdTestRun | features.js | ✓ | ✓ | cmd-test-run.md |
| execute:trajectory checkpoint | cmdTrajectoryCheckpoint | trajectory.js | ✓ | ✓ | — |
| execute:trajectory list | cmdTrajectoryList | trajectory.js | ✓ | ✓ | — |
| execute:trajectory pivot | cmdTrajectoryPivot | trajectory.js | ✓ | ✓ | — |
| execute:trajectory compare | cmdTrajectoryCompare | trajectory.js | ✓ | ✓ | — |
| execute:trajectory choose | cmdTrajectoryChoose | trajectory.js | ✓ | ✓ | — |
| execute:trajectory dead-ends | cmdTrajectoryDeadEnds | trajectory.js | ✓ | ✓ | — |
| execute:profile | *(error only)* | — | — | ✗ | — |

**Issue:** `execute:profile` (router.js L524-526) is a dead route — it just throws an error saying "Set BGSD_PROFILE=1". Should be removed or turned into a proper command.

### verify Namespace Routes (18+ sub-routes)

| Route | Handler | Module | Exported | COMMAND_HELP | Workflow Callers |
|-------|---------|--------|:--------:|:------------:|-----------------|
| verify:state load | cmdStateLoad | state.js | ✓ | ✓ | debug.md, settings.md, set-profile.md |
| verify:state update | cmdStateUpdate | state.js | ✓ | ✓ | — |
| verify:state get | cmdStateGet | state.js | ✓ | ✓ | — |
| verify:state patch | cmdStatePatch | state.js | ✓ | ✓ | — |
| verify:state advance-plan | cmdStateAdvancePlan | state.js | ✓ | ✓ | execute-plan.md |
| verify:state record-metric | cmdStateRecordMetric | state.js | ✓ | ✓ | execute-plan.md |
| verify:state update-progress | cmdStateUpdateProgress | state.js | ✓ | ✓ | execute-plan.md |
| verify:state add-decision | cmdStateAddDecision | state.js | ✓ | ✓ | execute-plan.md, github-ci.md |
| verify:state add-blocker | cmdStateAddBlocker | state.js | ✓ | ✓ | — |
| verify:state resolve-blocker | cmdStateResolveBlocker | state.js | ✓ | ✓ | — |
| verify:state record-session | cmdStateRecordSession | state.js | ✓ | ✓ | execute-plan.md, discuss-phase.md, github-ci.md |
| verify:state validate | cmdStateValidate | state.js | ✓ | ✓ | execute-phase.md |
| verify:verify plan-structure | cmdVerifyPlanStructure | verify.js | ✓ | ✓ | — |
| verify:verify phase-completeness | cmdVerifyPhaseCompleteness | verify.js | ✓ | ✓ | — |
| verify:verify references | cmdVerifyReferences | verify.js | ✓ | ✓ | — |
| verify:verify commits | cmdVerifyCommits | verify.js | ✓ | ✓ | — |
| verify:verify artifacts | cmdVerifyArtifacts | verify.js | ✓ | ✓ | — |
| verify:verify key-links | cmdVerifyKeyLinks | verify.js | ✓ | ✓ | — |
| verify:verify analyze-plan | cmdAnalyzePlan | verify.js | ✓ | ✓ | — |
| verify:verify deliverables | cmdVerifyDeliverables | verify.js | ✓ | ✓ | — |
| verify:verify requirements | cmdVerifyRequirements | verify.js | ✓ | ✓ | — |
| verify:verify regression | cmdVerifyRegression | verify.js | ✓ | ✓ | — |
| verify:verify plan-wave | cmdVerifyPlanWave | verify.js | ✓ | ✓ | — |
| verify:verify plan-deps | cmdVerifyPlanDeps | verify.js | ✓ | ✓ | — |
| verify:verify quality | cmdVerifyQuality | verify.js | ✓ | ✓ | — |
| verify:regression | cmdVerifyRegression | verify.js | ✓ | ✗ | — |
| verify:quality | cmdVerifyQuality | verify.js | ✓ | ✗ | — |
| verify:review | cmdReview | misc.js | ✓ | ✓ | execute-plan.md |
| verify:assertions list | cmdAssertionsList | verify.js | ✓ | ✓ | plan-phase.md |
| verify:assertions validate | cmdAssertionsValidate | verify.js | ✓ | ✓ | — |
| verify:search-decisions | cmdSearchDecisions | features.js | ✓ | ✓ | cmd-search-decisions.md |
| verify:search-lessons | cmdSearchLessons | features.js | ✓ | ✓ | cmd-search-lessons.md, plan-phase.md |
| verify:context-budget | cmdContextBudget | features.js | ✓ | ✓ | cmd-context-budget.md, execute-plan.md |
| verify:context-budget baseline | cmdContextBudgetBaseline | features.js | ✓ | ✓ | — |
| verify:context-budget compare | cmdContextBudgetCompare | features.js | ✓ | ✓ | — |
| verify:context-budget measure | cmdContextBudgetMeasure | features.js | ✓ | ✓ | — |
| verify:token-budget | cmdTokenBudget | features.js | ✓ | ✓ | — |
| verify:summary | cmdVerifySummary | misc.js | ✓ | ✗ | — |
| verify:validate consistency | cmdValidateConsistency | verify.js | ✓ | ✗ | — |
| verify:validate health | cmdValidateHealth | verify.js | ✓ | ✗ | health.md |
| verify:validate roadmap | cmdValidateRoadmap | verify.js | ✓ | ✗ | execute-phase.md, new-milestone.md, new-project.md |
| verify:validate-dependencies | cmdValidateDependencies | features.js | ✓ | ✗ | execute-phase.md, cmd-validate-deps.md |
| verify:validate-config | cmdValidateConfig | features.js | ✓ | ✗ | cmd-validate-config.md |
| verify:test-coverage | cmdTestCoverage | features.js | ✓ | ✗ | — |
| **verify:handoff** | **MISSING** | — | — | — | **execute-phase.md L190** |
| **verify:agents** | **MISSING** | — | — | — | **execute-phase.md L196** |

**CRITICAL:** `verify:handoff` and `verify:agents` are called in `execute-phase.md` (the main execution workflow) but have NO router implementation, NO handler function, and NO module. These calls will fail at runtime.

### util Namespace Routes (40+ sub-routes)

All util routes verified as functional. Key routes with missing COMMAND_HELP:

| Route | Handler | COMMAND_HELP |
|-------|---------|:------------:|
| util:settings | cmdSettingsList | ✗ |
| util:parity-check | cmdParityCheck | ✗ |
| util:resolve-model | cmdResolveModel | ✗ |
| util:verify-path-exists | cmdVerifyPathExists | ✗ |
| util:config-ensure-section | cmdConfigEnsureSection | ✗ |
| util:scaffold | cmdScaffold | ✗ |
| util:phase-plan-index | cmdPhasePlanIndex | ✗ |
| util:state-snapshot | cmdStateSnapshot | ✗ |
| util:summary-extract | cmdSummaryExtract | ✗ |
| util:summary-generate | cmdSummaryGenerate | ✗ |
| util:quick-summary | cmdQuickTaskSummary | ✗ |
| util:extract-sections | cmdExtractSections | ✗ |
| util:tools | cmdToolsStatus | ✗ |
| util:runtime | cmdRuntimeStatus/Benchmark | ✗ |
| util:recovery | createAutoRecovery etc | ✗ |
| util:history | helpContext module | ✗ |
| util:examples | helpExamples module | ✗ |
| util:analyze-deps | cmdAnalyzeDeps | ✗ |
| util:estimate-scope | cmdEstimateScope | ✗ |
| util:test-coverage | cmdTestCoverage | ✗ |

### research Namespace Routes (8 commands) — All functional, all have COMMAND_HELP

### cache Namespace Routes (5 commands)

| Route | Handler | Module | COMMAND_HELP |
|-------|---------|--------|:------------:|
| cache:research-stats | cmdCacheResearchStats | cache.js | ✗ |
| cache:research-clear | cmdCacheResearchClear | cache.js | ✗ |
| cache:status | cmdCacheStatus | cache.js | ✗ |
| cache:clear | cmdCacheClear | cache.js | ✗ |
| cache:warm | cmdCacheWarm | cache.js | ✗ |

**Note:** cache commands also exist under `util:cache` — they are accessible both ways.

### audit Namespace Routes (1 command) — Functional, has COMMAND_HELP

### decisions Namespace Routes (4 commands) — All functional, all have COMMAND_HELP

### Standalone Routes (2 commands)

| Route | Handler | Also in util: |
|-------|---------|:-------------:|
| runtime | cmdRuntimeStatus/Benchmark | ✓ (duplicate) |
| measure | cmdMeasure | ✓ (duplicate) |
<!-- /section -->

<!-- section: dependencies -->
## Issue Classification

### CRITICAL — Broken Routes (Workflow calls non-existent CLI commands)

```
execute-phase.md L190
    └──calls──> verify:handoff --preview --from planner --to executor
                    └──MISSING: No router handler, no module, no function

execute-phase.md L196
    └──calls──> verify:agents --verify --from planner --to executor
                    └──MISSING: No router handler, no module, no function
```

**Impact:** The main `execute-phase` workflow references these commands. When an LLM encounters these steps, the CLI invocations will fail. The LLM may silently skip them, create confusing error output, or stall execution.

**Evidence:** `grep` confirms no handler in router.js, no export in any command module, no function definition anywhere in `src/`.

**Fix options:**
1. Remove the dead references from `execute-phase.md` (if handoff verification is no longer needed)
2. Implement the commands (if the feature was planned but never built)
3. Replace with `util:agent validate-contracts` which exists and does similar validation

### CRITICAL — Orphaned Command Module

```
src/commands/ci.js
    └──exports──> cmdExecuteCi (327 lines)
                    └──ORPHANED: No lazy loader in router.js, no route, never imported
```

**Impact:** 327 lines of dead code bundled into `bin/bgsd-tools.cjs` on every build. The `bgsd-github-ci` slash command works via its workflow (which calls `verify:state` commands), not this module.

**Evidence:** `grep -r 'commands/ci\|cmdExecuteCi\|lazyCi' src/` returns only definitions within `ci.js` itself.

**Fix:** Either wire `ci.js` into the router or delete it. The github-ci workflow doesn't use it.

### HIGH — Validator Missing Namespace

```
src/lib/commandDiscovery.js L341-463 (routerImplementations)
    └──missing──> 'audit' namespace
                    └──causes: util:validate-commands reports audit:scan as invalid
```

**Evidence:** Running `node bin/bgsd-tools.cjs util:validate-commands` outputs `"issue": "Unknown namespace: audit"`.

**Fix:** Add `'audit': { 'scan': null }` to `routerImplementations` in `commandDiscovery.js`.

### HIGH — Stale Subcommand Lists in commandDiscovery.js

The `routerImplementations` object has several entries that don't match the actual router:

| Namespace | commandDiscovery says | Router actually has |
|-----------|----------------------|---------------------|
| plan:roadmap | `['add', 'insert', 'remove', 'list']` | `['get-phase', 'analyze', 'update-plan-progress']` |
| plan:milestone | `['new', 'complete', 'audit', 'gaps']` | `['complete', 'summary', 'info']` |
| execute:tdd | `['init', 'red', 'green', 'refactor', 'cycle', 'auto']` | Dynamic (passes to cmdTdd) |
| verify:state | includes `'add-todo'` | No `add-todo` in router |
| util:git | `['status', 'log', 'diff', 'branch', 'checkout']` | `['log', 'diff-summary', 'blame', 'branch-info', 'rewind', 'trajectory-branch']` |

**Impact:** `util:validate-commands` may miss real routing issues or report false positives.

### MODERATE — Missing COMMAND_HELP Entries

20 `util:` routes, 7 `verify:` routes, and 5 `cache:` routes lack `COMMAND_HELP` entries. This means `bgsd-tools <command> --help` outputs "No help available" for these commands.

### MODERATE — Dead Route

`execute:profile` (router.js L524-526) only outputs an error message. It's not a real command.

### MODERATE — Duplicate Routes

`runtime` and `measure` are accessible both as `util:runtime`/`util:measure` and as standalone `runtime`/`measure`. This works but is confusing for discoverability.

### LOW — bgsd-quick.md Orphaned Wrapper

`commands/bgsd-quick.md` is described as "backward-compatible wrapper for quick command" but has no execution_context workflow reference (unlike `bgsd-quick-task.md` which properly references `workflows/quick.md`). This wrapper likely does nothing useful.
<!-- /section -->

<!-- section: mvp -->
## Prioritized Fix List

### P1: Must Fix (Broken at runtime)

- [ ] **Remove or implement `verify:handoff` and `verify:agents`** in execute-phase.md — these are dead code references that fail at runtime
  - File: `workflows/execute-phase.md` L190, L196
  - Likely fix: Replace with `util:agent validate-contracts` or remove the blocks entirely

- [ ] **Add `audit` namespace to `commandDiscovery.js` routerImplementations** — causes the built-in validator to report false failures
  - File: `src/lib/commandDiscovery.js` ~L341
  - Fix: Add `'audit': { 'scan': null }` entry

- [ ] **Fix stale routerImplementations subcommand lists** — validator lies about valid/invalid commands
  - File: `src/lib/commandDiscovery.js` L341-463
  - Fix: Sync all subcommand arrays with actual router.js case statements

### P2: Should Fix (Dead code, missing docs)

- [ ] **Remove or wire `src/commands/ci.js`** — 327 lines of dead code bundled into every build
  - If needed: Add `lazyCi` loader and router route
  - If not needed: Delete the file

- [ ] **Remove `execute:profile` dead route** — confusing; just prints an error
  - File: `src/router.js` L524-526

- [ ] **Add COMMAND_HELP for 20 util: routes** — `--help` returns nothing for these commands
  - File: `src/lib/constants.js`

- [ ] **Add COMMAND_HELP for 7 verify: routes** (regression, quality, summary, validate, validate-dependencies, validate-config, test-coverage)

- [ ] **Add COMMAND_HELP for 5 cache: routes**

### P3: Nice to Have (Cleanup)

- [ ] **Remove `bgsd-quick.md` duplicate wrapper** — `bgsd-quick-task.md` already handles this
- [ ] **Consolidate `runtime`/`measure` standalone routes** — decide if standalone access is intentional or should be deprecated
- [ ] **Remove `research collect --resume` from COMMAND_HELP** — this is a flag variant, not a command
<!-- /section -->

<!-- section: prioritization -->
## Summary Statistics

| Metric | Count |
|--------|-------|
| Total registered router routes | ~130 |
| Total COMMAND_HELP entries | 81 |
| Slash commands (commands/) | 41 |
| Workflows referencing CLI | 35 |
| Command modules (src/commands/) | 24 |
| Lazy loaders in router | 25 |
| **Missing routes (broken)** | **2** (verify:handoff, verify:agents) |
| **Orphaned modules (dead code)** | **1** (ci.js) |
| **Dead routes** | **1** (execute:profile) |
| **Missing COMMAND_HELP** | **32** |
| **Stale validator entries** | **5 namespace groups** |
| **Duplicate routes** | **2** (runtime, measure) |

## Cross-Reference Matrix: Slash Commands → Workflows → CLI

All 41 slash commands verified. Routing chain:
- 40/41 properly reference workflows via `execution_context`
- 1/41 (`bgsd-quick.md`) is an orphaned backward-compat wrapper
- All referenced workflows exist on disk
- 2 CLI commands referenced by workflows don't exist in router
- 0 workflows reference non-existent slash commands
<!-- /section -->

---
*CLI Command Routing Audit for: bGSD Plugin v11.4*
*Researched: 2026-03-13*
*Method: Static analysis of router.js (1337 lines), constants.js (1021 lines), commandDiscovery.js (584 lines), 24 command modules, 41 slash commands, 43 workflows*
