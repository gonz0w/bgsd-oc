# Architecture Research: v2.0 Integration with Existing Module Structure

**Domain:** CLI plugin architecture — new capability integration into existing 16-module structure
**Researched:** 2026-02-22
**Confidence:** HIGH (based on direct codebase analysis of all source files, not external sources)

<!-- section: compact -->
<architecture_compact>

**Architecture:** Layered CLI with `lib/` foundation (7 modules) → `commands/` business logic (7 modules) → router dispatch → esbuild bundle → single-file deploy. 16 source modules, 8,208 LOC, 202 tests.

**Current module structure:**

| Layer | Module | Lines | Responsibility |
|-------|--------|-------|----------------|
| lib | constants.js | 560 | CONFIG_SCHEMA, MODEL_PROFILES, COMMAND_HELP |
| lib | helpers.js | 452 | File I/O cache, phase lookup, milestone detection |
| lib | frontmatter.js | 151 | YAML frontmatter extract/reconstruct/splice |
| lib | output.js | 112 | JSON output, field filtering, tmpfile, debug |
| lib | context.js | 97 | Token estimation (tokenx), budget checking |
| lib | config.js | 66 | Config loading with schema defaults |
| lib | git.js | 28 | execSync git wrapper |
| cmd | features.js | 1,461 | 15 feature commands (session-diff, velocity, etc.) |
| cmd | misc.js | 1,422 | 25 utility commands (slug, scaffold, etc.) |
| cmd | init.js | 1,008 | 12 workflow init commands (context builders) |
| cmd | phase.js | 901 | Phase CRUD, milestone, requirements |
| cmd | verify.js | 668 | 8 verification commands |
| cmd | state.js | 390 | 11 state commands |
| cmd | roadmap.js | 302 | 3 roadmap commands |
| core | router.js | 585 | Argv parsing, flag extraction, dispatch |
| core | index.js | 5 | Entry point |

**v2.0 integration strategy:** Add 2 new lib modules + 1 new command module. Extend 3 existing command modules + 3 lib modules. No structural changes to router pattern, index, or build pipeline.

**Key patterns to preserve:**
- Commands import from lib, NEVER from other commands
- Every command: `(cwd, ...args, raw)` → `output(result, raw)` → `process.exit(0)`
- Config-driven thresholds via CONFIG_SCHEMA
- Tests exercise bundled binary via subprocess

**Key constraint:** All changes bundle to single CJS file. Zero new runtime dependencies.
</architecture_compact>
<!-- /section -->

<!-- section: standard_architecture -->
## Current System Architecture

### Module Dependency Graph (strict direction: commands → lib, never commands → commands)

```
                         index.js (5 LOC)
                            │
                         router.js (585 LOC)
                            │
            ┌───────────────┼───────────────┬───────────────┐
            │               │               │               │
       commands/        commands/       commands/       commands/
        init.js         state.js       verify.js      features.js
        (1008)          (390)           (668)          (1461)
            │               │               │               │
       commands/        commands/       commands/            │
        phase.js        roadmap.js      misc.js             │
        (901)           (302)           (1422)              │
            │               │               │               │
            └───────┬───────┴───────┬───────┴───────────────┘
                    │               │
                    ▼               ▼
               lib/helpers.js  lib/frontmatter.js  lib/git.js
                  (452)            (151)             (28)
                    │
                    ▼
               lib/config.js   lib/context.js   lib/constants.js
                  (66)            (97)              (560)
                    │               │               │
                    └───────┬───────┘               │
                            ▼                       │
                       lib/output.js ◄──────────────┘
                          (112)
```

### Data Flow: CLI Invocation

```
User/AI invokes:  node gsd-tools.cjs <command> [args] [--raw] [--compact] [--fields]

                    ┌──────────────────────────────────┐
                    │          router.js                 │
                    │  1. Parse global flags (--raw,     │
                    │     --fields, --compact, --manifest)│
                    │  2. Switch on command name          │
                    │  3. Delegate to command function    │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────▼───────────────────┐
                    │       commands/<module>.js         │
                    │  1. Validate args                  │
                    │  2. Load config (lib/config)       │
                    │  3. Read files (lib/helpers cache)  │
                    │  4. Parse markdown (lib/frontmatter)│
                    │  5. Query git (lib/git)             │
                    │  6. Compute result object           │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────▼───────────────────┐
                    │         lib/output.js              │
                    │  1. Apply --fields filter           │
                    │  2. JSON.stringify result            │
                    │  3. If >50KB: write tmpfile          │
                    │  4. stdout → process.exit(0)        │
                    └──────────────────────────────────┘
```

### Data Flow: AI Workflow Integration

```
Workflow .md prompt (loaded into AI context)
    │
    │ instructs AI to run:
    │ node gsd-tools.cjs init execute-phase "03" --compact
    │
    ▼
AI reads JSON from stdout ──► AI parses fields ──► AI makes decisions
    │                                                    │
    │                                                    ▼
    │                                          AI reads plan files
    │                                                    │
    │                                                    ▼
    │                                          AI executes plan tasks
    │                                                    │
    ├─────────────────────────────────► AI calls gsd-tools state/verify
    │                                                    │
    ▼                                                    ▼
gsd-tools writes STATE.md ◄────────── gsd-tools verify artifacts/commits
```
<!-- /section -->

<!-- section: integration_map -->
## v2.0 Feature → Module Integration Map

### Feature 1: State Validation

**What:** Detect when STATE.md drifts from git/filesystem reality.
**Example drift:** STATE.md says "Phase 10, Plan 02" but no phase 10 directory exists, or plan 02 already has a SUMMARY.md (i.e., it's complete, not in-progress).

#### New module: `src/lib/validation.js` (~150-200 lines)

Reusable validation primitives consumed by multiple command modules.

```javascript
// Core validation functions
function validateStatePosition(cwd, stateContent)        // → {valid, issues[]}
function validatePhaseExists(cwd, phaseNum)               // → {exists, directory}
function validatePlanStatus(cwd, phaseDir, planId)        // → {status, hasSummary, isActive}
function validateMilestoneAlignment(cwd, state, roadmap)  // → {valid, issues[]}
function validateProgressAccuracy(cwd)                    // → {valid, drift, issues[]}
```

#### Modifications to existing modules:

| Module | Change | Lines Added | Rationale |
|--------|--------|-------------|-----------|
| `commands/state.js` | Add `cmdStateValidate(cwd, raw)` | ~60 | Entry point for `gsd-tools state validate` |
| `commands/verify.js` | Extend `cmdValidateHealth()` to call validation.js | ~15 | Health check should include drift detection |
| `commands/init.js` | Add `validation_warnings[]` to init outputs | ~20 | Workflows see drift warnings upfront |
| `lib/helpers.js` | Extract `parseStatePosition(content)` | ~25 | Both state.js and validation.js need position parsing |
| `router.js` | Add `state validate` subcommand route | ~3 | Wire new command |
| `lib/constants.js` | Add COMMAND_HELP for `state validate` | ~15 | --help support |

#### Data flow change:

```
Before:  AI reads STATE.md → trusts content → may act on stale data

After:   gsd-tools state validate → {valid: false, issues: [
           "STATE says plan 02 but 02-SUMMARY.md exists (plan complete)",
           "STATE says phase 10 but no phase-10 directory"
         ]}
         init commands include validation_warnings[] → AI warned upfront
```

#### Why a new lib module (not inline in commands/state.js):
- Validation logic is consumed by `state.js`, `verify.js`, AND `init.js`
- Putting it in any one command module creates a cross-command dependency (currently commands NEVER import from each other — this is a strict invariant)
- `helpers.js` is already 452 lines and validation is a distinct concern

---

### Feature 2: Atomic Plan Decomposition

**What:** Enforce single-responsibility per plan. Detect when a plan bundles too many unrelated concerns.

#### Extends: `commands/verify.js` (add ~100-150 lines)

```javascript
function cmdVerifyPlanAtomicity(cwd, planFilePath, raw)
// Checks:
//   1. Task count > config.max_tasks_per_plan (default 8) → warning
//   2. files_modified spans > N unrelated directories → warning
//   3. must_haves.artifacts span > N unrelated paths → warning
//   4. Plan has tasks touching both src/ and workflows/ → warning (scope mixing)
```

#### Modifications:

| Module | Change | Lines Added | Rationale |
|--------|--------|-------------|-----------|
| `commands/verify.js` | Add `cmdVerifyPlanAtomicity()` | ~120 | New verify subcommand |
| `router.js` | Add `verify plan-atomicity` route | ~3 | Wire command |
| `lib/constants.js` | Add `max_tasks_per_plan` to CONFIG_SCHEMA | ~2 | Configurable threshold |
| `lib/constants.js` | Add COMMAND_HELP entry | ~10 | --help |

#### Data flow change:

```
Before:  Planner generates plan → executor runs it (may be too large)
After:   Planner generates plan → atomicity check → split recommendation → focused plan
```

#### Why extend verify.js (not new module):
- It's a verification concern — fits alongside plan-structure and phase-completeness checks
- verify.js is 668 lines; adding 120 keeps it under 800 (reasonable)
- No new cross-module dependencies needed (uses existing frontmatter + helpers)

---

### Feature 3: Cross-Session Memory

**What:** Persist decisions, codebase patterns, position, and contextual knowledge across `/clear` or session restart. Currently STATE.md captures position but loses rich context.

#### New module: `src/lib/memory.js` (~200-250 lines)

Structured memory persistence and token-budgeted retrieval.

```javascript
// Storage: .planning/memory.json (JSON, not markdown)
function loadMemory(cwd)                                // → {decisions[], patterns[], codebase{}, lessons[]}
function saveMemory(cwd, memory)                        // → writes .planning/memory.json
function addMemoryEntry(cwd, category, entry)           // → appends to category array
function queryMemory(cwd, category, query)              // → filtered entries (substring match)
function pruneMemory(cwd, options)                      // → remove old entries, enforce maxEntries/maxTokens
function getMemoryDigest(cwd, tokenBudget)              // → compressed summary within token limit
```

#### New module: `src/commands/memory.js` (~250-300 lines)

CLI interface for memory operations.

```javascript
function cmdMemoryLoad(cwd, raw)                        // gsd-tools memory load
function cmdMemoryAdd(cwd, category, entry, raw)        // gsd-tools memory add --category decisions --entry "..."
function cmdMemoryQuery(cwd, category, query, raw)      // gsd-tools memory query --category codebase --query "auth"
function cmdMemoryPrune(cwd, options, raw)              // gsd-tools memory prune [--max-tokens 5000]
function cmdMemoryDigest(cwd, options, raw)             // gsd-tools memory digest [--budget 3000]
```

#### Modifications:

| Module | Change | Lines Added | Rationale |
|--------|--------|-------------|-----------|
| `commands/init.js` | Include `memory_digest` in init outputs | ~25 | Workflows get context automatically |
| `commands/state.js` | `cmdStateRecordSession()` dual-writes to memory | ~10 | Session context flows to both stores |
| `lib/context.js` | Add `compressForBudget(entries, maxTokens)` | ~35 | Memory digest respects token limits |
| `router.js` | Add `memory` command with 5 subcommand routes | ~30 | Wire all memory commands |
| `lib/constants.js` | Add COMMAND_HELP for `memory` + CONFIG_SCHEMA entries | ~40 | --help + config for max_memory_entries, memory_digest_budget |

#### Data flow change:

```
Before:  Session ends → STATE.md gets position + session log
         Session starts → reads STATE.md → limited context (position only)

After:   Session ends → STATE.md + memory.json both updated
         Session starts → init command outputs include memory_digest field
         AI reads digest → has decisions, patterns, codebase knowledge
```

#### Why memory.json (not extending STATE.md):
- STATE.md is markdown parsed by regex — poor for structured data queries
- JSON enables fast key-based lookups, category filtering, token-budget pruning
- STATE.md stays human-readable; memory.json is machine-optimized
- memory.json can grow large without bloating AI context (digest extracts what fits)

#### Why a new command module (not extending features.js):
- features.js is already 1,461 lines — the largest command module
- Memory is a distinct domain (5+ commands) deserving its own module
- Follows the pattern: one command module per domain (state, verify, phase, roadmap, memory)

---

### Feature 4: Comprehensive Verification

**What:** Auto-test execution with regression detection, requirement delivery tracing, combined deliverables verdict.

#### Extends: `commands/verify.js` (add ~250-300 lines)

```javascript
function cmdVerifyRequirements(cwd, phase, raw)      // Trace requirement IDs → deliverable files
function cmdVerifyRegression(cwd, options, raw)       // Compare test results with stored baseline
function cmdVerifyDeliverables(cwd, phase, raw)       // Combined: artifacts + key-links + requirements + tests
```

#### Extends: `commands/features.js` (modify existing `cmdTestRun`)

```javascript
// Enhanced cmdTestRun:
// 1. After running tests, stores results in .planning/baselines/{phase}-{timestamp}.json
// 2. On next run, compares with most recent baseline
// 3. Detects regressions: tests that passed before but fail now
// 4. Returns: { pass_count, fail_count, regressions[], new_failures[] }
```

#### Modifications:

| Module | Change | Lines Added | Rationale |
|--------|--------|-------------|-----------|
| `commands/verify.js` | Add 3 new verify subcommands | ~280 | Comprehensive verification suite |
| `commands/features.js` | Enhance `cmdTestRun` with baseline storage + comparison | ~80 | Regression detection |
| `lib/helpers.js` | Add `parseRequirementIds(content)` | ~20 | Used by verify + roadmap for requirement tracing |
| `router.js` | Add `verify requirements`, `verify regression`, `verify deliverables` | ~10 | Wire commands |
| `lib/constants.js` | Add help text for 3 new commands | ~30 | --help |

#### Data flow change:

```
Before:  Verification = manual UAT + artifact/key-link existence checks

After:   Full verification pipeline:
         1. gsd-tools test-run → stores baseline → regression comparison
         2. gsd-tools verify requirements {phase} → trace IDs to files
         3. gsd-tools verify artifacts {plan}     → (existing, unchanged)
         4. gsd-tools verify key-links {plan}     → (existing, unchanged)
         5. gsd-tools verify deliverables {phase} → combined verdict JSON
```

---

### Feature 5: Integration Tests

**What:** End-to-end workflow tests exercising command chains: init → plan → execute → verify.

#### New file: `bin/gsd-integration.test.cjs` (~400-600 lines)

```javascript
describe('init → execute → verify workflow', () => {
  // Creates temp project with ROADMAP, STATE, config, phase dirs, plans
  // Runs init execute-phase → verifies JSON output structure
  // Runs state patch → verifies state mutation
  // Runs verify phase-completeness → checks verdict
});

describe('state validation detects drift', () => {
  // Creates temp project with valid STATE.md
  // Corrupts STATE.md (wrong phase number, completed plan marked active)
  // Runs state validate → expects issues array
});

describe('memory persistence and retrieval', () => {
  // Creates temp project
  // Runs memory add → memory load → verifies entry
  // Runs memory prune → verifies size reduction
  // Runs memory digest → verifies token budget respected
});

describe('comprehensive verification pipeline', () => {
  // Creates temp project with plans + fake test output
  // Runs test-run → stores baseline
  // Runs verify requirements → checks trace
  // Runs verify deliverables → checks combined verdict
});
```

#### Modifications:

| Module | Change | Rationale |
|--------|--------|-----------|
| `package.json` | Add `"test:integration": "node --test bin/gsd-integration.test.cjs"` | Separate test command |

**No source module changes** — integration tests exercise the bundled binary via subprocess, same as existing unit tests.

**Test isolation:** Each test creates ephemeral temp directory, scaffolds `.planning/` structure, runs `bin/gsd-tools.cjs` as subprocess, parses JSON stdout, cleans up with `fs.rmSync(recursive)`.

---

### Feature 6: Dependency & Token Optimization

**What:** Analysis task — evaluate Node.js modules for bundle size/token reduction. May produce zero code changes.

#### Minor modifications:

| Module | Change | Lines Added | Rationale |
|--------|--------|-------------|-----------|
| `build.js` | Add `metafile: true` to esbuild config | ~5 | Bundle analysis reporting |
| `commands/features.js` | Enhance `cmdContextBudgetCompare` | ~20 | Better optimization visibility |

This feature is primarily research/analysis, not new code. Output is decisions documented in PROJECT.md.

<!-- /section -->

<!-- section: new_modules -->
## New vs. Modified Module Summary

### New modules (3)

| Module | Location | Lines (est.) | Purpose | Imports From | Imported By |
|--------|----------|-------------|---------|--------------|-------------|
| `validation.js` | src/lib/ | 150-200 | State drift detection, position validation | helpers, config, output | commands/state, commands/verify, commands/init |
| `memory.js` | src/lib/ | 200-250 | Structured memory CRUD, token-budgeted digest | helpers, context, output | commands/memory, commands/init, commands/state |
| `memory.js` | src/commands/ | 250-300 | CLI interface: memory load/add/query/prune/digest | lib/memory, lib/output | router.js |

### New files (1)

| File | Location | Lines (est.) | Purpose |
|------|----------|-------------|---------|
| `gsd-integration.test.cjs` | bin/ | 400-600 | End-to-end workflow chain tests |

### Modified modules

| Module | Nature of Change | Est. Lines Added |
|--------|-----------------|-----------------|
| `commands/verify.js` (668→~1,060) | 4 new functions: plan-atomicity, requirements, regression, deliverables | +350-400 |
| `commands/features.js` (1,461→~1,560) | Enhanced test-run with baseline storage/comparison | +80-100 |
| `commands/state.js` (390→~460) | New validate subcommand + memory dual-write | +50-80 |
| `commands/init.js` (1,008→~1,060) | validation_warnings + memory_digest in outputs | +40-60 |
| `lib/helpers.js` (452→~500) | parseStatePosition + parseRequirementIds extractions | +30-50 |
| `lib/context.js` (97→~135) | compressForBudget() for memory digest | +30-40 |
| `lib/constants.js` (560→~680) | CONFIG_SCHEMA entries + COMMAND_HELP for 9 new commands | +80-120 |
| `router.js` (585→~660) | New routes: state validate, verify (3), memory (5) | +40-60 |
| `build.js` (63→~70) | metafile option | +5-10 |
| `package.json` | test:integration script | +1 |

### Size projection

| Metric | Current | After v2.0 | Change |
|--------|---------|------------|--------|
| Source modules | 16 | 19 | +3 |
| Source LOC | 8,208 | ~10,000-10,500 | +22-28% |
| Bundle size (LOC) | 7,367 | ~8,800-9,200 | +19-25% |
| Unit tests | 202 | ~230-250 | +14-24% |
| Integration tests | 0 | ~30-50 | new |
| Commands (total) | ~79 | ~90 | +11 |

<!-- /section -->

<!-- section: data_flow -->
## Data Flow Changes

### Current State Read/Write

```
                    ┌─────────────────────────────────┐
                    │          STATE.md                 │
                    │  (markdown, regex-parsed)         │
                    │                                   │
                    │  **Current phase:** 10             │
                    │  **Plan:** 02                      │
                    │  **Status:** executing             │
                    │  ## Decisions                      │
                    │  ## Blockers                       │
                    └──────────┬──────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                   │
      state load         state get           state patch
      (full parse)     (field parse)       (regex replace)
```

### v2.0 Dual-Store Flow

```
                    ┌──────────────────┐    ┌──────────────────────┐
                    │    STATE.md       │    │    memory.json        │
                    │ (human-readable)  │    │ (machine-optimized)   │
                    │ position, status  │    │ {                     │
                    │ session log       │    │   decisions: [...],   │
                    └────────┬─────────┘    │   patterns: [...],    │
                             │              │   codebase: {...},     │
                             │              │   lessons: [...]       │
                             │              │ }                      │
                             │              └────────┬──────────────┘
         ┌───────────────────┼──────────┐            │
         │                   │          │            │
    state validate     state load    memory load   memory digest
    (cross-reference)  (existing)    (JSON parse)  (budget-limited)
         │                   │          │            │
         ▼                   ▼          ▼            ▼
    ┌──────────────────────────────────────────────────────────┐
    │                  init command output                       │
    │  {                                                        │
    │    ...existing fields...,                                 │
    │    validation_warnings: ["plan 02 already complete"],     │
    │    memory_digest: {                                       │
    │      decisions: ["Chose esbuild", "CJS over ESM"],        │
    │      patterns: ["lib→cmd dependency direction"],          │
    │      budget_used: 1240  // tokens                         │
    │    }                                                      │
    │  }                                                        │
    └──────────────────────────────────────────────────────────┘
```

### v2.0 Verification Pipeline

```
AI completes plan execution
         │
         ▼
gsd-tools test-run          ──► .planning/baselines/{phase}-{timestamp}.json
         │                                    │
         ▼                                    ▼
gsd-tools verify regression  ◄── compare with most recent baseline
         │                        {regressions: [...], new_failures: [...]}
         ▼
gsd-tools verify requirements {phase}  ──► trace PROJECT.md requirement IDs
         │                                  → deliverable files on disk
         ▼
gsd-tools verify artifacts {plan}      ──► existing (unchanged)
         │
         ▼
gsd-tools verify key-links {plan}      ──► existing (unchanged)
         │
         ▼
gsd-tools verify deliverables {phase}  ──► combined verdict:
         │                                  {complete: bool, tests, requirements,
         │                                   artifacts, key_links, overall}
         ▼
AI reads verdict → decides: advance / fix / flag
```

### File System Touchpoints

| File | Read By | Written By | v2.0 Change |
|------|---------|------------|-------------|
| `.planning/STATE.md` | state, init, features, verify | state | + read by validation.js |
| `.planning/memory.json` | — | — | **NEW** — read by memory.js, init.js; written by memory.js, state.js |
| `.planning/baselines/*.json` | — | — | **NEW DIR** — read by verify.js; written by features.js (test-run) |
| `.planning/config.json` | config.js | misc.js | + new CONFIG_SCHEMA entries |
| `.planning/ROADMAP.md` | helpers, roadmap, init, verify | roadmap, phase | + read by validation.js |
| `.planning/phases/*/` | helpers, phase, verify, init | phase | + read by validation.js |

<!-- /section -->

<!-- section: patterns -->
## Architectural Patterns (to follow)

### Pattern 1: Lib Module as Shared Foundation

**What:** New reusable logic goes in `src/lib/`. New CLI surface goes in `src/commands/`. Commands import from lib, NEVER from other commands.
**When to use:** Always. This is the strict invariant.

```
commands/* → lib/*      ✅ (all commands import from lib)
lib/* → lib/*           ✅ (lib modules can import other lib)
commands/* → commands/*  ✗ NEVER (no cross-command imports)
router.js → commands/*  ✅ (router imports command functions)
router.js → lib/*       ✅ (router imports constants)
```

**v2.0 implication:** State validation logic needed by both `commands/state.js` and `commands/verify.js` MUST live in `lib/validation.js`.

### Pattern 2: Command Output Protocol

**What:** Every command function: `(cwd, ...args, raw)` → `output(result, raw)` → exits.
**When to use:** Every new command. No exceptions.

```javascript
function cmdMemoryLoad(cwd, raw) {
  const memory = loadMemory(cwd);            // lib function
  if (!memory) {
    output({ entries: 0, categories: {} }, raw);
    return;
  }
  output({
    entries: Object.values(memory).flat().length,
    categories: Object.keys(memory),
    ...memory,
  }, raw);
}
```

### Pattern 3: Config-Driven Thresholds

**What:** Configurable values go in CONFIG_SCHEMA with defaults. Commands read via `loadConfig()`.
**When to use:** Any threshold, toggle, or limit that users might want to customize.

```javascript
// In constants.js — single source of truth
const CONFIG_SCHEMA = {
  max_tasks_per_plan:     { type: 'number',  default: 8,    description: 'Max tasks before atomicity warning', ... },
  max_memory_entries:     { type: 'number',  default: 100,  description: 'Max entries per memory category', ... },
  memory_digest_budget:   { type: 'number',  default: 3000, description: 'Token budget for memory digest', ... },
};
```

### Pattern 4: Graceful Degradation for New Files

**What:** New features that depend on new files (memory.json, baselines/) must gracefully handle their absence.
**When to use:** Every feature that reads a file that may not exist yet.

```javascript
function loadMemory(cwd) {
  const memPath = path.join(cwd, '.planning', 'memory.json');
  try {
    const raw = fs.readFileSync(memPath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    debugLog('memory.load', 'no memory file, returning empty', e);
    return { decisions: [], patterns: [], codebase: {}, lessons: [] };
  }
}
```

**Critical:** Existing projects that upgrade to v2.0 won't have memory.json. All memory reads MUST return sensible defaults. All init commands MUST work identically when memory.json is absent.

<!-- /section -->

<!-- section: build_order -->
## Suggested Build Order

### Dependency Graph Between v2.0 Features

```
1. State Validation  ◄── foundation: everything benefits from validated state
        │
        ▼
2. Cross-Session Memory  ◄── depends: should persist only validated state
        │
        ▼
3. Comprehensive Verification  ◄── uses: validation (drift check) + memory (baselines)
        │
        ▼
4. Integration Tests  ◄── requires: all features exist to test end-to-end

5. Atomic Plan Decomposition  ◄── independent: can parallel with 4
6. Dependency & Token Optimization  ◄── independent: research task, parallel with 4-5
```

### Phase 1: State Validation (foundation)

**Build:**
1. Create `src/lib/validation.js` — core validation functions
2. Extract `parseStatePosition()` into `lib/helpers.js`
3. Add `cmdStateValidate()` to `commands/state.js`
4. Wire in `router.js` + `constants.js` (route + help)
5. Extend `cmdValidateHealth()` in verify.js to use validation
6. Add `validation_warnings[]` to 3-4 key init command outputs
7. Unit tests for validation functions

**Why first:** Every subsequent feature benefits from knowing if STATE.md is accurate. Memory should persist validated state. Verification should detect drift. Integration tests need validation to be testable.

**Estimated effort:** 1 phase, 2-3 plans

### Phase 2: Cross-Session Memory

**Build:**
1. Create `src/lib/memory.js` — persistence, query, pruning, digest
2. Create `src/commands/memory.js` — 5 CLI commands
3. Add `compressForBudget()` to `lib/context.js`
4. Wire in `router.js` + `constants.js`
5. Modify `cmdStateRecordSession()` for dual-write to memory.json
6. Add `memory_digest` field to key init command outputs
7. Unit tests for memory CRUD and token budgeting

**Why second:** Memory depends on validated state (don't persist invalid state). Comprehensive verification uses memory (baseline storage builds on session knowledge).

**Estimated effort:** 1 phase, 2-3 plans

### Phase 3: Comprehensive Verification

**Build:**
1. Add `cmdVerifyRequirements()` to verify.js
2. Add `cmdVerifyRegression()` to verify.js
3. Add `cmdVerifyDeliverables()` to verify.js
4. Enhance `cmdTestRun()` in features.js with baseline storage
5. Add `parseRequirementIds()` to helpers.js
6. Wire routes + help text
7. Update `workflows/verify-work.md` to call comprehensive verification
8. Unit tests for each new verify command

**Why third:** Uses validation (for state accuracy) and memory (for baseline storage). Must exist before integration tests can verify the full pipeline.

**Estimated effort:** 1 phase, 2-3 plans

### Phase 4: Integration Tests

**Build:**
1. Create `bin/gsd-integration.test.cjs`
2. Add `test:integration` to package.json
3. Write test chains: init → validate → execute → verify
4. Write memory persistence tests
5. Write drift detection tests
6. Write regression detection tests

**Why fourth:** Integration tests exercise the assembled system. All features must exist first.

**Estimated effort:** 1 phase, 1-2 plans

### Phase 5: Atomic Plan Decomposition (can parallel with Phase 4)

**Build:**
1. Add `cmdVerifyPlanAtomicity()` to verify.js
2. Add `max_tasks_per_plan` to CONFIG_SCHEMA
3. Wire route + help text
4. Update `workflows/plan-phase.md` to include atomicity check
5. Unit tests

**Why late:** Purely additive. No dependencies on other v2.0 features. Can parallel with integration tests.

**Estimated effort:** 1 plan (within a larger phase)

### Phase 6: Dependency & Token Optimization (parallel with 4-5)

**Build:**
1. Add esbuild metafile analysis
2. Benchmark token cost per command
3. Evaluate optimization opportunities
4. Implement any with clear benefit
5. Document decisions in PROJECT.md

**Why late:** Research/analysis task. May produce zero code changes. Low risk.

**Estimated effort:** 1 plan (within a larger phase)

### Practical Phase Grouping for Roadmap

The 6 features group naturally into 4 phases:

| Roadmap Phase | Features | Plans (est.) | Rationale |
|---------------|----------|-------------|-----------|
| Phase 10: State Intelligence | State Validation | 2-3 | Foundation for everything else |
| Phase 11: Session Continuity | Cross-Session Memory | 2-3 | Builds on validated state |
| Phase 12: Quality Gates | Comprehensive Verification + Atomic Decomposition | 3-4 | Both are verification concerns |
| Phase 13: Test Infrastructure + Polish | Integration Tests + Token Optimization | 2-3 | Final quality gate + cleanup |

<!-- /section -->

<!-- section: anti_patterns -->
## Anti-Patterns to Avoid

### Anti-Pattern 1: Cross-Command Imports

**What people do:** Import helpers from `commands/state.js` into `commands/verify.js` to avoid duplication.
**Why it's wrong:** Creates tangled dependencies, makes modules hard to test independently, risk of circular imports. Currently zero cross-command imports — this is a strict invariant.
**Do this instead:** Extract shared logic to a `lib/` module. That's exactly why `lib/validation.js` exists for v2.0.

### Anti-Pattern 2: Markdown as Structured Database

**What people do:** Store complex structured data in STATE.md and parse it with regex.
**Why it's wrong:** Regex is fragile for nested data, slow for queries, prone to drift between write format and read regex.
**Do this instead:** Use JSON for machine-optimized data (`memory.json`). Keep markdown for human-readable state (`STATE.md`). Dual-store pattern: write to both, each optimized for its consumer.

### Anti-Pattern 3: Growing the Largest Module

**What people do:** Add new commands to `features.js` because "it has feature commands."
**Why it's wrong:** features.js is 1,461 lines — already the largest module. Adding 250+ lines for memory commands would push it past 1,700.
**Do this instead:** Create `commands/memory.js` for the new domain. Follow the pattern: one module per distinct domain.

### Anti-Pattern 4: Testing Internal Functions Directly

**What people do:** Import and test helper functions from source modules by requiring the source file.
**Why it's wrong:** Couples tests to implementation details, breaks when functions move between modules. The source structure can change freely if the CLI interface is stable.
**Do this instead:** Test via the CLI binary (subprocess). Tests call `node bin/gsd-tools.cjs <command>`, parse JSON output, assert on results. This is the existing pattern (all 202 tests work this way).

### Anti-Pattern 5: Unbounded Memory Growth

**What people do:** Append to memory.json indefinitely, accumulating every decision from every session.
**Why it's wrong:** memory.json grows without bound. Digest function can't compress arbitrarily large input within token budget. Old entries become irrelevant noise.
**Do this instead:** Implement pruning in `lib/memory.js` — configurable `max_memory_entries` per category (default 100). The `getMemoryDigest()` function enforces the `memory_digest_budget` token limit by prioritizing recent entries.

### Anti-Pattern 6: Validation That Blocks

**What people do:** Make state validation a hard gate — refuse to run commands if validation fails.
**Why it's wrong:** Sometimes STATE.md is intentionally out of sync (user manually edited, different tool wrote it, mid-migration). Hard blocking frustrates users.
**Do this instead:** Validation is advisory — returns warnings, never blocks. Init commands include `validation_warnings[]` for the AI to consider. The AI decides whether to self-correct or proceed. Explicit `state validate` command for intentional validation.

<!-- /section -->

<!-- section: scaling -->
## Scaling Considerations

| Concern | Current | After v2.0 | Mitigation |
|---------|---------|------------|------------|
| Module count | 16 | 19 | Still small; esbuild handles easily |
| Bundle size | 7,367 LOC | ~9,000 LOC | <200KB; no performance impact |
| Build time | <500ms | <600ms | esbuild is fast; 3 more modules are trivial |
| Test time (unit) | ~3s | ~4s | Still fast enough for pre-commit |
| Test time (integration) | 0s | ~30-60s | Run separately via `npm run test:integration` |
| memory.json size | N/A | Bounded by pruning | max_memory_entries config (default 100/category) |
| baselines/ dir | N/A | One file per test run | Prune old baselines (keep last 10) |

### What Breaks First

1. **features.js size** — At 1,461 lines, it's already the largest module. v2.0 adds ~80 lines to it. If it grows further in v3.0, consider splitting into `features-analysis.js` and `features-tools.js`.
2. **CONFIG_SCHEMA size** — Currently 18 entries. v2.0 adds 3 more (21 total). At 30+ entries, consider grouping by domain with sections.
3. **COMMAND_HELP size** — Already 460 lines of help text. Adding 9 more commands adds ~90 lines. Manageable but approaching the point where a help generator might be worthwhile.

<!-- /section -->

<!-- section: integration -->
## Build Pipeline Impact

| Concern | Impact |
|---------|--------|
| esbuild bundle | ~1,500 new LOC → ~3-4KB increase (trivial) |
| New npm dependencies | None (memory uses fs.readFileSync/writeFileSync, not a database) |
| Build time | Negligible increase (<100ms) |
| Deploy footprint | Unchanged — still `bin/gsd-tools.cjs` + workflows + templates |
| `deploy.sh` changes | None needed — already copies `src/` directory |

## Backward Compatibility

| Concern | Mitigation |
|---------|------------|
| memory.json doesn't exist | All memory reads return `{ decisions: [], patterns: [], ... }` |
| baselines/ directory doesn't exist | Created on first `test-run` with `--baseline` flag |
| New CONFIG_SCHEMA keys | CONFIG_SCHEMA defaults mean old config.json files work unchanged |
| New validation_warnings field | Only present when issues found; absent = no warnings (falsy) |
| New memory_digest field | Only present when memory.json exists; absent = no digest |
| New router commands | Strictly additive — no existing routes changed |
| Existing test suite | Unchanged — all 202 tests continue to pass (new code doesn't modify tested paths) |

## Sources

- Direct source analysis: all 16 modules (8,208 LOC), `bin/gsd-tools.test.cjs` (4,591 LOC, 202 tests)
- `build.js` and `deploy.sh` analysis for pipeline constraints
- 43 workflow files analyzed for integration patterns
- `package.json` and `node_modules` for dependency constraints
- All line counts measured via `wc -l` (exact, not estimated)

---
*Architecture research for: GSD Plugin v2.0 — Integration with existing module structure*
*Researched: 2026-02-22*
