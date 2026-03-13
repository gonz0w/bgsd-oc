# Architecture Research — LLM Offloading Integration

**Domain:** Programmatic Decision-Making Integration  
**Researched:** 2026-03-13  
**Confidence:** HIGH  
**Research mode:** Architecture — How programmatic decisions integrate with existing bGSD architecture

---

<!-- section: compact -->
<architecture_compact>

**Architecture:** Three-layer decision pipeline (Plugin hooks → CLI commands → Workflow prompts) with new decision engine module bridging plugin.js and bgsd-tools.cjs

**Major components:**

| Component | Responsibility |
|-----------|----------------|
| `src/plugin/decision-engine.js` | In-process deterministic decision resolution for plugin hooks |
| `src/lib/decisions.js` | CLI-callable decision functions for workflow-invoked decisions |
| `src/lib/decision-rules.js` | Shared rule definitions consumed by both plugin and CLI layers |
| Plugin hooks (existing) | Intercept points where decisions currently flow to LLM |
| CLI commands (existing) | Data providers that already compute deterministic results |
| Workflow prompts (existing) | LLM instructions that embed decision-requesting patterns |

**Key patterns:** Rule-based resolution, decision registry, fallback-to-LLM, progressive offloading

**Anti-patterns:** Duplicating decision logic across plugin/CLI, offloading non-deterministic decisions, breaking LLM escape hatch

**Scaling priority:** Start with highest-frequency deterministic decisions (phase numbering, file paths, state transitions), measure token savings before expanding
</architecture_compact>
<!-- /section -->

---

<!-- section: standard_architecture -->
## System Overview — Current vs. Target

### Current Architecture: Three Independent Layers

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    HOST EDITOR (OpenCode)                                  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         LLM Agent                                    │  │
│  │  • Reads workflow prompts                                           │  │
│  │  • Makes ALL decisions (deterministic + non-deterministic)          │  │
│  │  • Calls CLI for data                                               │  │
│  │  • Calls plugin tools for state mutations                           │  │
│  └──────────┬───────────────────────────┬──────────────────────────────┘  │
│             │ workflow prompts           │ tool calls                      │
│             ▼                           ▼                                 │
│  ┌───────────────────┐      ┌────────────────────────────────────────┐   │
│  │  45 Workflows     │      │  plugin.js (6 hooks + 5 tools)        │   │
│  │  (markdown)       │      │  • system prompt injection             │   │
│  │  • Decision logic │      │  • command enrichment                  │   │
│  │    embedded in    │      │  • compaction context                  │   │
│  │    natural lang   │      │  • advisory guardrails                 │   │
│  └──────────┬────────┘      │  • stuck detection                    │   │
│             │ execSync      │  • idle validation                    │   │
│             ▼               └──────────────┬─────────────────────────┘   │
│  ┌──────────────────────────────────────────┴────────────────────────┐   │
│  │              bgsd-tools.cjs (CLI — 100+ commands)                  │   │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────────┐   │   │
│  │  │ router  │→│ commands │→│  lib/      │→│ .planning/ files   │   │   │
│  │  │ (1 file)│ │ (22 files)│ │ (26 files)│ │ (data on disk)     │   │   │
│  │  └─────────┘ └──────────┘ └───────────┘ └────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

**Problem:** The LLM sits at the top and makes every decision — including ones that are fully deterministic and could be resolved by code. Each LLM decision costs tokens and latency.

### Target Architecture: Decision Engine Layer

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    HOST EDITOR (OpenCode)                                  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         LLM Agent                                    │  │
│  │  • Reads workflow prompts (SIMPLIFIED — fewer decision points)      │  │
│  │  • Makes ONLY non-deterministic decisions                           │  │
│  │  • Receives pre-computed suggestions via system prompt               │  │
│  │  • Calls CLI for data + decisions combined                          │  │
│  └──────────┬───────────────────────────┬──────────────────────────────┘  │
│             │ simplified workflows      │ tool calls (enriched)           │
│             ▼                           ▼                                 │
│  ┌───────────────────┐      ┌────────────────────────────────────────┐   │
│  │  45 Workflows     │      │  plugin.js (hooks + tools + decisions) │   │
│  │  (trimmed)        │      │  • system prompt + DECISION INJECTION  │   │
│  │  • Fewer decision │      │  • command enrichment + PRE-RESOLUTION │   │
│  │    points         │      │  • advisory guardrails                 │   │
│  └──────────┬────────┘      │  ┌──────────────────────────────────┐  │   │
│             │ execSync      │  │  decision-engine.js (NEW)        │  │   │
│             ▼               │  │  • Rule evaluation in-process    │  │   │
│  ┌────────────────────────┐ │  │  • Pre-compute & inject results  │  │   │
│  │  bgsd-tools.cjs (CLI)  │ │  │  • Fallback flag for LLM        │  │   │
│  │  ┌──────────────────┐  │ │  └──────────────────────────────────┘  │   │
│  │  │ decisions.js     │  │ └──────────────────┬─────────────────────┘   │
│  │  │ (NEW — shared    │  │                    │                          │
│  │  │  decision logic) │  │                    │                          │
│  │  ├──────────────────┤  │                    │                          │
│  │  │ decision-rules.js│◄─┼────────────────────┘                          │
│  │  │ (NEW — shared    │  │  (imported by both plugin and CLI)            │
│  │  │  rule defs)      │  │                                               │
│  │  └──────────────────┘  │                                               │
│  └────────────────────────┘                                               │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `decision-engine.js` (plugin) | In-process decision resolution during plugin hooks | Evaluates rules against parsed project state, injects results into system prompt and command enrichment |
| `decisions.js` (CLI lib) | CLI-accessible decision functions for workflow-invoked resolution | Exports decision functions callable via `bgsd-tools.cjs util:decide <type>` |
| `decision-rules.js` (shared) | Rule definitions (the "what to decide") | JSON-like rule registry with conditions, resolution functions, confidence levels |
| Existing plugin hooks | Injection points for pre-computed decisions | `system.transform` injects decision context; `command.execute.before` pre-resolves params |
| Existing CLI commands | Data providers + now decision resolvers | Commands like `init:execute-phase` already compute deterministic values |
| Existing workflows | Simplified prompts that consume pre-resolved decisions | Replace "figure out X" with "use pre-resolved X from `<bgsd-context>`" |

<!-- /section -->

---

<!-- section: three_layer_integration -->
## Three-Layer Integration Analysis

### Layer 1: Plugin Hooks (In-Process, Fastest)

The plugin runs **in-process** with the host editor — no subprocess overhead. This is the optimal location for high-frequency, low-latency decisions.

**Current hooks that already make decisions programmatically:**

| Hook | Current Decision | How It Works |
|------|-----------------|--------------|
| `system.transform` | What context to inject | `buildSystemPrompt()` reads state, computes phase/plan/milestone info |
| `command.execute.before` | What enrichment to inject | `enrichCommand()` detects phase args, resolves paths, counts plans |
| `tool.execute.after` | Whether agent is stuck | `stuckDetector.trackToolCall()` counts error repeats |
| `event` (idle) | Whether state needs validation | `idleValidator.onIdle()` checks cooldowns, runs checks |
| `tool.execute.after` | Whether conventions violated | `guardrails.onToolAfter()` checks naming patterns |

**New decisions to add at plugin layer:**

| Decision | Current Owner | Offload Logic |
|----------|--------------|---------------|
| Next task to execute | LLM reads plan | Plugin parses plan XML, computes next incomplete task |
| Whether phase is complete | LLM checks summaries | Plugin counts plan files vs summary files |
| Whether to run tests | LLM decides | Plugin checks if source files changed since last test |
| Current plan number | LLM reads STATE.md | Plugin already parses this — expose more explicitly |
| Phase directory path | LLM computes from slug | Plugin already resolves this in `enrichCommand()` |
| Model recommendation | LLM guesses | `orchestration.js` already computes — pipe to plugin |

**Integration pattern for plugin-layer decisions:**

```javascript
// src/plugin/decision-engine.js
import { getProjectState } from './project-state.js';
import { evaluateRules } from './decision-rules.js'; // Shared rules

export function resolveDecisions(cwd, context) {
  const projectState = getProjectState(cwd);
  if (!projectState) return { decisions: [], fallback: true };

  const decisions = evaluateRules(projectState, context);

  // Each decision: { id, type, value, confidence, fallback }
  // confidence: HIGH = code is certain, MEDIUM = likely correct, LOW = suggest to LLM
  // fallback: true = LLM should verify, false = code answer is authoritative

  return { decisions, fallback: false };
}
```

**Injection via existing `system.transform` hook:**

```javascript
// In src/plugin/index.js — extend existing systemTransform
const systemTransform = safeHook('system.transform', async (input, output) => {
  const sysDir = directory || process.cwd();
  const prompt = buildSystemPrompt(sysDir);
  if (prompt && output?.system) output.system.push(prompt);

  // NEW: inject pre-resolved decisions
  const decisions = resolveDecisions(sysDir, { hook: 'system' });
  if (decisions.decisions.length > 0) {
    const xml = formatDecisionsXml(decisions);
    output.system.push(xml);
  }
});
```

### Layer 2: CLI Commands (Subprocess, Reliable)

The CLI runs as a subprocess via `execSync`. It's the right place for decisions that:
- Need heavy computation (AST parsing, dependency analysis)
- Are invoked explicitly by workflows
- Need persistent caching (SQLite L1/L2)

**Current CLI commands that already resolve decisions:**

| Command | Decision It Resolves | Current Consumer |
|---------|---------------------|-----------------|
| `init:execute-phase` | Phase dir, plan list, branching | execute-phase workflow |
| `init:plan-phase` | Phase info, research status, models | plan-phase workflow |
| `util:classify plan` | Task complexity, model recommendation | Orchestration |
| `plan:find-phase` | Phase number from partial input | Multiple workflows |
| `verify:state validate` | State consistency issues | Idle validator |
| `util:resolve-model` | Model for agent/profile | Agent spawning |

**New CLI decision commands to add:**

| Command | Decision | Currently Done By |
|---------|----------|-------------------|
| `util:decide next-action` | What the agent should do next | LLM reads state + reasons |
| `util:decide phase-transition` | Whether to advance phase | LLM checks completeness |
| `util:decide commit-message` | Conventional commit prefix | LLM generates from diff |
| `util:decide plan-template` | Which plan template to use | LLM reasons about type |
| `util:decide file-placement` | Where a new file should go | LLM reasons about conventions |

**Integration pattern:**

```javascript
// src/lib/decisions.js — shared decision logic
function decideNextAction(cwd) {
  const state = parseState(cwd);
  const plans = findPhasePlans(cwd, state.phase);
  const summaries = findPhaseSummaries(cwd, state.phase);

  if (!plans.length) return { action: 'plan-phase', confidence: 'HIGH' };
  if (summaries.length < plans.length) return { action: 'execute-phase', confidence: 'HIGH' };
  if (summaries.length === plans.length) return { action: 'verify-work', confidence: 'HIGH' };

  return { action: null, confidence: 'LOW', fallback: true };
}
```

### Layer 3: Workflow Prompts (LLM-Consumed, Simplified)

Workflows are markdown prompts that the LLM reads and follows. They currently embed decision logic in natural language that the LLM must reason through.

**Current pattern (expensive):**
```markdown
## 4. Determine Next Step
Parse STATE.md to find current phase. Check if plans exist.
If no plans → run plan-phase. If incomplete plans → execute next.
If all complete → run verify-work.
```

**Target pattern (pre-resolved):**
```markdown
## 4. Next Step
Use `next_action` from `<bgsd-context>` JSON:
- `plan-phase` → Run plan-phase workflow
- `execute-phase` → Run execute-phase workflow  
- `verify-work` → Run verify-work workflow
```

**The `<bgsd-context>` block already exists** — the `command.execute.before` hook injects it for every `/bgsd-*` command. Extending it with pre-resolved decisions is a natural evolution:

```json
{
  "phase_number": "3",
  "phase_dir": ".planning/phases/03-testing",
  "plans": ["03-01-PLAN.md", "03-02-PLAN.md"],
  "incomplete_plans": ["03-02-PLAN.md"],
  "decisions": {
    "next_action": "execute-phase",
    "next_plan": "03-02-PLAN.md",
    "phase_complete": false,
    "suggested_commit_prefix": "feat",
    "test_command": "npm test"
  }
}
```

<!-- /section -->

---

<!-- section: patterns -->
## Architectural Patterns

### Pattern 1: Decision Registry

**What:** Central registry of decision rules that can be evaluated by both plugin (ESM) and CLI (CJS) layers.

**When to use:** For every deterministic decision being offloaded from LLM to code.

**Trade-offs:**
- ✅ Single source of truth for decision logic
- ✅ Testable in isolation (pure functions)
- ✅ Both plugin and CLI can consume
- ❌ Requires careful module format handling (ESM/CJS boundary)

**Critical constraint:** The plugin is ESM (`src/plugin/`), the CLI is CJS (`src/lib/`). They are built as separate bundles by esbuild. Shared decision rules must work in both formats.

**Solution:** Write decision rules as pure functions in `src/lib/decision-rules.js` (CJS). The plugin can import the bundled output or the esbuild build can inline the shared module into both bundles. Since esbuild already bundles both targets, this is transparent — just `require()` in CJS and the build handles it.

```javascript
// src/lib/decision-rules.js (CJS — consumed by both builds)
'use strict';

const DECISION_RULES = {
  'next-action': {
    evaluate(state, roadmap, plans, summaries) {
      if (!plans || plans.length === 0) return { value: 'plan-phase', confidence: 'HIGH' };
      const incomplete = plans.filter(p => !summaries.includes(p.replace('-PLAN.md', '-SUMMARY.md')));
      if (incomplete.length > 0) return { value: 'execute-phase', confidence: 'HIGH' };
      return { value: 'verify-work', confidence: 'HIGH' };
    }
  },

  'phase-complete': {
    evaluate(state, roadmap, plans, summaries) {
      if (!plans || plans.length === 0) return { value: false, confidence: 'LOW' };
      return {
        value: summaries.length >= plans.length,
        confidence: 'HIGH'
      };
    }
  },

  'commit-prefix': {
    evaluate(state, roadmap, plans, summaries, context) {
      const phase = state?.phase || '';
      if (/test/i.test(phase)) return { value: 'test', confidence: 'HIGH' };
      if (/refactor/i.test(phase)) return { value: 'refactor', confidence: 'HIGH' };
      if (/fix/i.test(phase)) return { value: 'fix', confidence: 'HIGH' };
      if (/doc/i.test(phase)) return { value: 'docs', confidence: 'HIGH' };
      return { value: 'feat', confidence: 'MEDIUM' };
    }
  }
};

module.exports = { DECISION_RULES };
```

### Pattern 2: Progressive Offloading (Confidence-Gated)

**What:** Each decision has a confidence level. HIGH confidence = code is authoritative. MEDIUM = code suggests, LLM confirms. LOW = code provides data, LLM decides.

**When to use:** For all offloaded decisions — prevents premature automation of nuanced decisions.

**Trade-offs:**
- ✅ Safe — bad decisions fall back to LLM
- ✅ Measurable — can track confidence vs. LLM override rate
- ❌ LLM must still read LOW-confidence suggestions (partial savings only)

```javascript
// Decision result format
{
  id: 'next-action',
  value: 'execute-phase',
  confidence: 'HIGH',     // HIGH | MEDIUM | LOW
  fallback: false,         // true = LLM should verify/override
  rationale: '1 incomplete plan in phase 3',
  metadata: { incomplete_plan: '03-02-PLAN.md' }
}
```

**Workflow consumption:**
```markdown
<!-- HIGH confidence: use directly -->
Next action: ${decisions.next_action.value}

<!-- MEDIUM confidence: use with brief validation -->
Suggested commit prefix: ${decisions.commit_prefix.value}
(verify this matches the change type)

<!-- LOW confidence: use as input to LLM reasoning -->
Possible next action: ${decisions.next_action.value}
Rationale: ${decisions.next_action.rationale}
Make your own determination.
```

### Pattern 3: Enrichment Extension (Zero New Hooks)

**What:** Extend the existing `enrichCommand()` function and `<bgsd-context>` JSON to include pre-resolved decisions — no new hooks needed.

**When to use:** Always — this is the integration seam.

**Trade-offs:**
- ✅ Zero API changes to host editor integration
- ✅ Uses existing, tested infrastructure
- ✅ Backward compatible — new fields in existing JSON
- ❌ All decisions must be computable at command-start time

**Implementation:**

```javascript
// In src/plugin/command-enricher.js — extend enrichCommand()
function enrichCommand(input, output, cwd) {
  // ... existing enrichment logic ...

  // NEW: resolve decisions based on command type
  const decisions = resolveDecisionsForCommand(command, projectState);
  if (decisions) {
    enrichment.decisions = decisions;
  }

  // ... existing output injection ...
}
```

<!-- /section -->

---

<!-- section: data_flow -->
## Data Flow

### Current Flow: LLM Decides Everything

```
User types: /bgsd-execute-phase 3
    │
    ▼
[command.execute.before hook]
    │ enrichCommand() → <bgsd-context> JSON
    │   (phase_dir, plans, config)
    ▼
[LLM reads workflow: execute-phase.md]
    │ LLM reasons: "phase 3 has 2 plans, 1 complete..."
    │ LLM decides: "execute plan 03-02-PLAN.md next"
    │ LLM decides: "run sequentially (no parallelization)"
    │ LLM decides: "use sonnet model"
    │                     ← 4 LLM decisions, ~500 tokens each
    ▼
[LLM calls CLI]
    │ bgsd-tools.cjs init:execute-phase 3
    │ bgsd-tools.cjs util:classify phase 3
    ▼
[CLI returns data]
    │ JSON results
    ▼
[LLM reasons about results]
    │ LLM decides: "spawn executor subagent"
    │                     ← 1 more LLM decision
    ▼
[Execution begins]
```

### Target Flow: Code Decides Deterministic Parts

```
User types: /bgsd-execute-phase 3
    │
    ▼
[command.execute.before hook]
    │ enrichCommand() → <bgsd-context> JSON
    │   (phase_dir, plans, config)
    │ resolveDecisions() → decisions block
    │   next_plan: "03-02-PLAN.md"
    │   execution_mode: "sequential"
    │   recommended_model: "sonnet"
    │   phase_complete: false
    │                     ← 0 LLM decisions needed for these
    ▼
[LLM reads SIMPLIFIED workflow]
    │ LLM sees pre-resolved decisions in <bgsd-context>
    │ LLM confirms/overrides (MEDIUM/LOW confidence only)
    │ LLM handles ONLY non-deterministic decisions
    │   (e.g., "should I ask user about this blocker?")
    │                     ← ~1 LLM decision instead of 5
    ▼
[Execution begins — faster, cheaper]
```

### Key Data Flows After Offloading

1. **System prompt injection:** `buildSystemPrompt()` → already injects phase/plan → **ADD** decision summary for "what to do next"
2. **Command enrichment:** `enrichCommand()` → already injects paths/config → **ADD** resolved decisions per command type
3. **Compaction context:** `buildCompactionContext()` → already preserves sacred/trajectory → **ADD** last-known decisions for session continuity
4. **Plugin tools:** `bgsd_progress` → already mutates state → **ADD** auto-compute next step after state change

<!-- /section -->

---

<!-- section: module_placement -->
## Where Decision Logic Should Live

### Decision Placement Matrix

| Decision Type | Frequency | Latency Req | Location | Rationale |
|--------------|-----------|-------------|----------|-----------|
| Next action (plan/execute/verify) | Every command | <10ms | Plugin `decision-engine.js` | Hot path, pure state lookup |
| Phase completion status | Every command | <10ms | Plugin `decision-engine.js` | Already computed in `getProjectState()` |
| Next plan to execute | Per execute-phase | <10ms | Plugin `command-enricher.js` | Already resolves `incomplete_plans` |
| Execution mode (seq/parallel) | Per execute-phase | <50ms | CLI `decisions.js` | Needs plan classification (heavy) |
| Model recommendation | Per agent spawn | <50ms | CLI `orchestration.js` (existing) | Already implemented, needs surfacing |
| Commit prefix suggestion | Per commit | <5ms | Plugin `decision-engine.js` | Phase name → prefix is pure string match |
| File placement convention | Per new file | <10ms | Plugin `advisory-guardrails.js` | Already has convention detection |
| Template selection | Per plan creation | <20ms | CLI `decisions.js` | Needs frontmatter analysis |
| Phase numbering (next decimal) | Per phase add | <10ms | CLI `phase.js` (existing) | Already implemented as `cmdPhaseNextDecimal` |
| Requirement ID generation | Per requirement | <5ms | CLI `decisions.js` | Deterministic counter |

### Module Architecture

```
src/
├── plugin/                      # ESM — in-process with host editor
│   ├── decision-engine.js       # NEW — evaluates rules, returns decisions
│   ├── command-enricher.js      # MODIFIED — calls decision-engine, injects results
│   ├── context-builder.js       # MODIFIED — includes decision summary in system prompt
│   ├── project-state.js         # EXISTING — provides state for decisions
│   ├── parsers/                 # EXISTING — parse .planning/ files
│   └── tools/                   # EXISTING — LLM-callable tools
│       └── bgsd-progress.js     # MODIFIED — auto-resolve next step after mutation
│
├── lib/                         # CJS — bundled into bgsd-tools.cjs
│   ├── decision-rules.js        # NEW — shared rule definitions (pure functions)
│   ├── decisions.js             # NEW — CLI-callable decision resolvers
│   ├── orchestration.js         # EXISTING — already classifies tasks/plans
│   ├── helpers.js               # EXISTING — findPhaseInternal, getPhaseTree
│   └── ...
│
├── commands/                    # CJS — CLI command handlers
│   └── (no new command files)   # Decisions exposed via existing namespaces
│
└── router.js                    # MODIFIED — add util:decide route
```

### Structure Rationale

- **`decision-rules.js` in `src/lib/`:** CJS module containing pure functions. esbuild bundles this into both the CJS CLI bundle AND the ESM plugin bundle. No runtime module format issues.
- **`decision-engine.js` in `src/plugin/`:** ESM module that imports rules and evaluates them against `getProjectState()`. Runs in-process — no subprocess overhead.
- **`decisions.js` in `src/lib/`:** CJS module for CLI access. Workflows can call `bgsd-tools.cjs util:decide <type>` when they need explicit decision resolution (rare — most go through enrichment).
- **No new command files:** Add `util:decide` route to existing `src/commands/misc.js` or create thin `src/commands/decide.js`. Prefer extending misc.js to avoid module count growth.

<!-- /section -->

---

<!-- section: build_integration -->
## Build & Deploy Integration

### Two-Bundle Architecture (Existing)

The project already builds two bundles via esbuild:

| Bundle | Entry Point | Format | Output | Contains |
|--------|-------------|--------|--------|----------|
| CLI | `src/index.js` | CJS | `bin/bgsd-tools.cjs` | router, commands, lib modules |
| Plugin | `src/plugin/index.js` | ESM | `plugin.js` | hooks, tools, parsers, event subsystems |

**Key insight:** `decision-rules.js` must be importable by both bundles. Since esbuild bundles dependencies inline, this is automatic — both entry points can `require()` or `import` the same source file, and esbuild duplicates it into each bundle. This is already how `constants.js` and helper functions work.

### Build Order for New Modules

1. **`src/lib/decision-rules.js`** — Pure rule definitions, no dependencies on other src/ modules
2. **`src/lib/decisions.js`** — Decision resolvers, depends on `helpers.js`, `decision-rules.js`
3. **`src/plugin/decision-engine.js`** — Plugin-side resolver, depends on `decision-rules.js`, `project-state.js`
4. **Modify `src/plugin/command-enricher.js`** — Call decision-engine, inject results
5. **Modify `src/plugin/context-builder.js`** — Include decision summary in system prompt
6. **Modify `src/router.js`** — Add `util:decide` route
7. **Modify workflows** — Replace LLM decision points with `<bgsd-context>` consumption

### Dependency Graph (New Modules)

```
                    ┌──────────────────────┐
                    │  decision-rules.js   │  ← Pure functions, no deps
                    │  (CJS, shared)       │
                    └──────┬───────┬───────┘
                           │       │
              ┌────────────┘       └────────────┐
              ▼                                  ▼
  ┌───────────────────────┐          ┌────────────────────────┐
  │  decisions.js         │          │  decision-engine.js    │
  │  (CJS, CLI bundle)   │          │  (ESM, plugin bundle)  │
  │  deps: helpers.js,    │          │  deps: project-state,  │
  │        decision-rules │          │        decision-rules   │
  └───────────┬───────────┘          └──────────┬─────────────┘
              │                                  │
              ▼                                  ▼
  ┌───────────────────────┐          ┌────────────────────────┐
  │  router.js            │          │  command-enricher.js   │
  │  (util:decide route)  │          │  (injects decisions)   │
  └───────────────────────┘          ├────────────────────────┤
                                     │  context-builder.js    │
                                     │  (system prompt)       │
                                     └────────────────────────┘
```

### Bundle Size Impact

| Component | Estimated Size (source) | Estimated Bundled |
|-----------|------------------------|-------------------|
| `decision-rules.js` | ~3KB | ~1.5KB (minified, duplicated in both bundles) |
| `decisions.js` | ~2KB | ~1KB (minified, CLI only) |
| `decision-engine.js` | ~2KB | ~1KB (minified, plugin only) |
| **Total new code** | ~7KB | ~3.5KB per bundle |
| **Current CLI bundle** | ~1163KB | +2.5KB = ~1166KB |
| **Current plugin bundle** | ~30KB | +2.5KB = ~33KB |

**Conclusion:** Well within all size budgets. Minimal bundle impact.

<!-- /section -->

---

<!-- section: anti_patterns -->
## Anti-Patterns

### Anti-Pattern 1: Duplicating Logic Across Plugin and CLI

**What people do:** Write the same decision function in both `src/plugin/` (ESM) and `src/lib/` (CJS).

**Why it's wrong:** Two implementations drift apart. Bug fixes must be applied twice. Tests must cover both.

**Do this instead:** Write decision rules once in `src/lib/decision-rules.js` (CJS). Let esbuild bundle it into both outputs. The plugin's `decision-engine.js` imports rules; the CLI's `decisions.js` imports the same rules.

### Anti-Pattern 2: Offloading Non-Deterministic Decisions

**What people do:** Try to programmatically decide things like "is this code change good enough?" or "should we add a test for this?"

**Why it's wrong:** These are judgment calls that require LLM reasoning. Offloading them produces brittle, wrong results.

**Do this instead:** Only offload decisions with clear, testable deterministic logic: "is phase complete?" (count files), "what's the next plan?" (sort by number), "what commit prefix?" (match phase name pattern). If you can't write a unit test with exact expected output, it's not deterministic.

### Anti-Pattern 3: Breaking the LLM Escape Hatch

**What people do:** Remove decision instructions from workflows entirely, forcing the code path with no override.

**Why it's wrong:** Edge cases exist. The LLM needs the ability to override code decisions when context demands it.

**Do this instead:** Always provide decisions as suggestions in `<bgsd-context>`, not as commands. Workflow text says "use pre-resolved value from context" not "this value is mandatory." MEDIUM/LOW confidence decisions explicitly invite LLM override.

### Anti-Pattern 4: Adding New Plugin Hooks

**What people do:** Create new hook types to intercept more decision points.

**Why it's wrong:** The host editor's hook API is fixed. New hooks require host editor changes. Current 6 hooks are sufficient.

**Do this instead:** Extend existing hooks. `system.transform` can inject any decision context. `command.execute.before` can pre-resolve any command parameter. `tool.execute.after` can trigger any post-action decision. No new hooks needed.

### Anti-Pattern 5: Making Decision Logic Async

**What people do:** Use `async/await` in decision-rules.js for file reads.

**Why it's wrong:** Decision rules should be pure functions that receive pre-parsed state. Async I/O in the decision layer makes it harder to test, harder to compose, and slower (awaiting in hot paths).

**Do this instead:** Parse state once (via `getProjectState()` or CLI's cached file reads), then pass the parsed data to synchronous rule evaluation functions.

<!-- /section -->

---

<!-- section: integration -->
## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Plugin ↔ Decision Engine | Direct function call (in-process) | `decision-engine.js` is imported by `command-enricher.js` and `context-builder.js` |
| Decision Engine ↔ Rules | Direct require/import (bundled) | `decision-rules.js` bundled into both outputs by esbuild |
| CLI ↔ Decisions | Direct require (same bundle) | `decisions.js` in same CJS bundle as router |
| Workflows ↔ Decisions | Via `<bgsd-context>` JSON | Workflows read pre-resolved `decisions` field from injected JSON |
| Plugin Tools ↔ Decisions | Post-mutation decision refresh | `bgsd_progress.execute()` invalidates cache → next system prompt reflects new state |

### Existing Integration Points (No Changes Needed)

| Integration | Current Status | Impact |
|-------------|---------------|--------|
| `getProjectState()` | Parses STATE, ROADMAP, PLAN, CONFIG, PROJECT, INTENT | Decision engine consumes this — no changes needed |
| `parseState()` cache | Map-based, invalidated on file change | Decisions always see fresh state after mutations |
| `parsePlans()` cache | Map-based with phase-scoped keys | Plan completion decisions use this directly |
| `invalidateAll()` | Clears all parser caches | Called by file watcher on .planning/ changes |
| `safeHook()` wrapper | Retry, timeout, circuit breaker | All decision injection goes through existing safe hooks |

### Workflow Integration Examples

**execute-phase.md — Before:**
```markdown
<step name="determine_next_plan">
Check incomplete_plans from init JSON.
If multiple incomplete plans, determine execution order by plan number.
Select the lowest-numbered incomplete plan.
</step>
```

**execute-phase.md — After:**
```markdown
<step name="determine_next_plan">
Use `decisions.next_plan` from `<bgsd-context>`.
If absent, fall back to lowest-numbered entry in `incomplete_plans`.
</step>
```

**Token savings:** ~200 tokens of LLM reasoning eliminated per execution.

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Plugin integration pattern | HIGH | Extends existing hooks and enrichment — proven infrastructure |
| CLI integration pattern | HIGH | Follows established module + router pattern |
| Shared rules via esbuild | HIGH | Already proven — constants.js works this way |
| Workflow simplification | HIGH | `<bgsd-context>` injection is battle-tested |
| Bundle size impact | HIGH | ~3.5KB per bundle, well within budgets |
| ESM/CJS boundary handling | HIGH | esbuild already handles this for 34 modules |
| Progressive confidence model | MEDIUM | Concept is sound but threshold tuning needs real data |
| Token savings estimates | MEDIUM | Per-decision savings clear; total savings depend on audit results |

<!-- /section -->

---

## Sources

1. **plugin.js source** — `src/plugin/index.js` (155 lines) — Current 6-hook architecture with tool registry
2. **command-enricher.js** — `src/plugin/command-enricher.js` — Existing `<bgsd-context>` injection pattern
3. **context-builder.js** — `src/plugin/context-builder.js` — System prompt and compaction context builders
4. **router.js** — `src/router.js` — Namespace routing with lazy-loaded command modules
5. **orchestration.js** — `src/lib/orchestration.js` — Existing task classification and execution mode selection
6. **build.cjs** — Dual-bundle esbuild config (CJS CLI + ESM plugin)
7. **advisory-guardrails.js** — `src/plugin/advisory-guardrails.js` — Example of decision-making in plugin layer
8. **stuck-detector.js** — `src/plugin/stuck-detector.js` — Example of pattern detection in plugin layer
9. **bgsd-progress.js** — `src/plugin/tools/bgsd-progress.js` — State mutation tool with cache invalidation
10. **execute-phase workflow** — `workflows/execute-phase.md` — Example of LLM decision points in workflows

---

*Architecture research for: LLM Offloading Integration*  
*Researched: 2026-03-13*
