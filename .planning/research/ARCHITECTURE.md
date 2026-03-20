# Architecture Research

**Domain:** CLI-based AI agent orchestration with question design system integration
**Researched:** 2026-03-19
**Confidence:** HIGH
**Research mode:** Ecosystem — How a question taxonomy and option generation system fits into existing bGSD architecture

---

<!-- section: compact -->
<architecture_compact>

**Architecture:** Workflow-driven agent orchestration with structured question routing via taxonomy-tagged templates

**Major components:**

| Component | Responsibility |
|-----------|----------------|
| `workflows/*.md` | Step sequences with `question()` calls — where questions are asked |
| `prompts.js` | inquirer-based question primitives — MODIFY to add taxonomy + option generation |
| `decision-rules.js` | Pure decision functions in DECISION_REGISTRY — NEW: question-type routing rules |
| `context.js` | Agent manifests with field scoping — MODIFY: add question context fields |

**Key patterns:** Decision-first question routing, taxonomy-tagged question templates, manifest-driven question context injection

**Anti-patterns:** Bare open-ended questions without options, inline question text scattered across 45 workflows, LLM generating options without taxonomy guidance

**Scaling priority:** Inline question text duplication (45 workflows × 5 questions = 225 inline texts) — centralize into `prompts.js` question templates first

</architecture_compact>
<!-- /section -->

---

<!-- section: standard_architecture -->
## System Overview

### Current Architecture (Before v15.0)

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Layer (workflows/*.md)             │
│  45 markdown workflow files with <step> definitions           │
│  question() calls embedded inline with raw question text      │
├─────────────────────────────────────────────────────────────┤
│                    Orchestration Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ orchestration │  │ decision-    │  │ context.js   │     │
│  │ .js          │  │ rules.js     │  │ AGENT_       │     │
│  │ Task routing │  │ DECISION_    │  │ MANIFESTS    │     │
│  │ Model select │  │ REGISTRY(19) │  │ (9 agents)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────┤
│                    CLI Layer                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   prompts.js                             │   │
│  │   inputPrompt, listPrompt, checkboxPrompt, confirm      │   │
│  │   NO taxonomy — bare primitives only                  │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    State / Data Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ STATE.md │  │ SQLite   │  │ DECISION_│                │
│  └──────────┘  └──────────┘  │ REGISTRY  │                │
│                               └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

**Problem:** Every workflow step that asks a question embeds raw question text inline. Options are generated ad-hoc by the LLM without guidance. No taxonomy means no systematic way to audit "which questions still use bare open-ended prompts?"

### Target Architecture (v15.0)

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Layer (workflows/*.md)             │
│  45 markdown files — question() calls reference taxonomy IDs │
│  No inline question text — all questions come from prompts.js│
├─────────────────────────────────────────────────────────────┤
│                    Question Taxonomy Layer                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  prompts.js (ENHANCED)                  │   │
│  │  - Question type router (clarify/decide/prioritize/   │   │
│  │    discover/confirm/scope)                            │   │
│  │  - Option generation per type (3-5 thoughtful options) │   │
│  │  - Taxonomy-tagged question templates                 │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Orchestration Layer (UNCHANGED)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ orchestration │  │ decision-    │  │ context.js   │    │
│  │ .js          │  │ rules.js     │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                    DECISION_REGISTRY (EXTENDED)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  NEW: resolveQuestionType, resolveOptionGeneration     │   │
│  │  +3-5 question-routing decision functions            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Location | Status |
|-----------|----------------|----------|--------|
| `workflows/*.md` | Step sequences, agent spawning, question references | `workflows/` (45 files) | MODIFY — replace inline text with template IDs |
| `prompts.js` | inquirer wrappers (input, list, checkbox, confirm) | `src/lib/prompts.js` | **MODIFY — add taxonomy + option generation** |
| `decision-rules.js` | Pure decision functions | `src/lib/decision-rules.js` | **MODIFY — add question-type routing rules** |
| `context.js` | Agent manifests, context scoping | `src/lib/context.js` | MODIFY — add question context to manifests |
| `orchestration.js` | Task classification, execution mode | `src/lib/orchestration.js` | NO CHANGE for v15.0 |
| `src/commands/questions.js` | CLI for question taxonomy audit | `src/commands/` (new) | **NEW** |

## Recommended Project Structure

```
src/
├── lib/
│   ├── prompts.js           # MODIFY: add question taxonomy + option generation
│   ├── decision-rules.js     # MODIFY: add question-type routing rules to DECISION_REGISTRY
│   ├── context.js            # MODIFY: add question context fields to manifests
│   ├── orchestration.js     # NO CHANGE
│   └── ...
├── commands/
│   ├── questions.js          # NEW: CLI commands for question taxonomy management
│   └── ...
└── ...

workflows/
├── discuss-phase.md          # MODIFY: use question taxonomy template IDs
├── new-milestone.md         # MODIFY: use question taxonomy template IDs
├── plan-phase.md            # MODIFY: use question taxonomy template IDs
└── ... (45 total)
```

### Structure Rationale

- **`prompts.js` as question template library:** Centralize all question templates here instead of scattering raw question text across 45 workflows. This enables reuse, consistent option generation, and systematic taxonomy enforcement.
- **`questions.js` CLI:** Inspection/debugging commands — `questions:audit` scans workflows for taxonomy compliance, `questions:list` shows available templates.
- **Workflows reference templates by ID:** `question(id="discover_phase_areas", type="discover", context="gray_areas")` instead of embedding raw text. The prompts.js template renderer expands this at runtime.
- **No new agents:** Per the agent cap constraint (max 9), question intelligence is delivered as CLI data, not new agent roles.

<!-- /section -->

---

<!-- section: patterns -->
## Architectural Patterns

### Pattern 1: Question Taxonomy Routing

**What:** Classify each question by intent type before presenting it. The taxonomy determines option generation strategy, prompt structure, and inquirer type.

**When to use:** Any workflow step that asks the user to choose, prioritize, clarify, or decide.

**Question Taxonomy (proposed for v15.0):**

| Type | When to Use | inquirer type | Options |
|------|-------------|--------------|---------|
| `clarify` | User needs to explain intent | `input` | None — freeform (but this is the anti-pattern to minimize) |
| `decide` | Binary or fixed choice | `list` | 2-3 options + "you decide" fallback |
| `prioritize` | Rank or select top-N | `checkbox` | Multi-select with count hint (e.g., "pick 3") |
| `discover` | Explore possibilities | `list` | 4-6 options with "other" escape hatch |
| `confirm` | Validate understanding | `confirm` | Yes/No only |
| `scope` | Include/exclude scope items | `checkbox` | Checkbox multi-select |

**Example question template in `prompts.js`:**
```javascript
// Question taxonomy router
function routeQuestionType(decisionType, context) {
  const routes = {
    decide:     { inquirerType: 'list',     minOptions: 2, maxOptions: 3, includeDefault: true },
    prioritize: { inquirerType: 'checkbox', countHint: 3, criteria: ['specific', 'ranked-by-impact'] },
    discover:   { inquirerType: 'list',     minOptions: 4, maxOptions: 6, includeOther: true },
    confirm:    { inquirerType: 'confirm',  },
    scope:      { inquirerType: 'checkbox', },
    clarify:    { inquirerType: 'input',    }, // Minimize — the problem being solved
  };
  return routes[decisionType] || routes.clarify;
}

// Example: question template for "discover phase areas"
const QUESTION_TEMPLATES = {
  discover_phase_areas: {
    id: 'discover_phase_areas',
    type: 'discover',
    render: (context) => ({
      message: `Which areas do you want to discuss for ${context.phase_name}?`,
      options: context.gray_areas, // e.g., ['Session handling', 'Error responses', ...]
      type: 'discover',
    }),
  },
  decide_version: {
    id: 'decide_version',
    type: 'decide',
    render: (context) => ({
      message: 'What type of release is this?',
      options: [
        { value: 'patch', label: 'Patch — bug fixes only' },
        { value: 'minor', label: 'Minor — new features, backward compatible' },
        { value: 'major', label: 'Major — breaking changes' },
      ],
      type: 'decide',
    }),
  },
};
```

### Pattern 2: Decision-First Question Routing

**What:** Use `DECISION_REGISTRY` to pre-compute question routing before the workflow step executes. The enriched `bgsd-context` carries question taxonomy decisions.

**When to use:** When the same question type recurs across multiple workflows and you want consistent option generation.

**Existing precedent:** `resolvePlanExistenceRoute` routes between `needs-research`, `needs-planning`, `ready`, `blocked-deps`. New `resolveQuestionType` follows the same pattern.

**Example decision function:**
```javascript
// In decision-rules.js
function resolveQuestionType(state) {
  const { workflow_step, decision_category } = state || {};
  const taxonomy = {
    'discuss-phase:present_gray_areas': 'discover',
    'discuss-phase:discuss_areas': 'decide',
    'new-milestone:determine_version': 'decide',
    'new-milestone:research': 'confirm',
    'plan-phase:validate_approach': 'decide',
  };
  const type = taxonomy[`${workflow_step}:${decision_category}`] ||
               taxonomy[workflow_step] ||
               'clarify';
  return { value: type, confidence: 'HIGH', rule_id: 'question-type' };
}
```

### Pattern 3: Scaffold-Then-Fill for Question Options

**What:** Use CLI to pre-generate options from structured data (roadmap phases, gray areas, requirement categories) before the question is asked. Options aren't generated ad-hoc by the LLM — they come from deterministic data.

**When to use:** When options can be derived from project data rather than invented.

**Existing precedent:** `cmdSummaryGenerate` in `misc.js` pre-builds SUMMARY.md data sections. Apply the same pattern to question options.

**Example:**
```javascript
// Gray areas derived from phase domain analysis — not invented by LLM
function generateGrayAreaOptions(phaseData) {
  const domain = phaseData.domain; // e.g., "CLI tool integration"
  return GRAY_AREA_TEMPLATES[domain] || GRAY_AREA_TEMPLATES.default;
}

// Options come from structured data, LLM doesn't need to invent them
const options = generateGrayAreaOptions({ domain: 'question-taxonomy', phase_name: 'v15.0' });
// → ['Session handling', 'Error responses', 'Multi-device policy', 'Recovery flow']
```

### Pattern 4: Workflow Section Compression (existing — note for integration)

**What:** Workflows use `<!-- section:name -->` markers for selective loading. Question templates in `prompts.js` should also use section markers internally so they compress cleanly.

**Integration note:** Question taxonomy does NOT add significant token overhead if templates are section-marked and loaded only when the workflow step reaches that question.

<!-- /section -->

---

<!-- section: data_flow -->
## Data Flow

### Question Presentation Flow

```
[Workflow Step]
    │
    ├─→ Parse <bgsd-context> for question-relevant fields
    │      (phase_dir, phase_name, gray_areas, etc.)
    │
    ├─→ Decision: resolveQuestionType({ workflow_step, decision_category })
    │      → Returns { type: 'discover', confidence: 'HIGH', rule_id: 'question-type' }
    │
    ├─→ prompts.js: questionTemplate('discover_phase_areas', context)
    │      → Returns { message, options: [...], type: 'discover' }
    │
    └─→ inquirer: listPrompt / checkboxPrompt / confirmPrompt
             │
             ├─→ CLI displays question with 4-6 options
             │
             └─→ User selects → answer captured
                      │
                      └─→ Continue to next step
```

### Option Generation Flow

```
[Project Data]                    [prompts.js]              [Workflow]
     │                                  │                        │
     ├─→ gray_areas from phase ──────→│                        │
     ├─→ requirements from roadmap ───→│  optionGeneration()    │
     ├─→ phase domains ───────────────→│  → structured options  │
     │                                  │                        │
     │                                  │  ← render(template, ctx)│
     │                                  │                        │
     │                                  │  → 4-6 concrete options│
     │                                  │                        │
     │←─────────────────────────────── │  options passed to     │
     │                                  │  listPrompt()          │
     └────────────────────────────────→│                        │
                                       │                        │
```

### Decision Recording Flow (for downstream agent reuse)

```
[User selects option]
    │
    └─→ prompts.js captures answer
             │
             ├─→ Workflow continues
             │
             └─→ recordDecision('question_answer', { question_id, answer })
                      │
                      └─→ DECISION_REGISTRY entry
                               │
                               ├─→ bgsd-context enrichment includes question decisions
                               │
                               └─→ Downstream agents (planner, executor) see what was decided
```

### Key Data Flows

1. **Question context injection:** `bgsd-context` enrichment → workflow step reads phase/plan state → options generated from structured data (not ad-hoc LLM generation)
2. **Decision recording:** User answer → `prompts.js` → `decision-rules.js` → DECISION_REGISTRY entry → SQLite + STATE.md dual-write
3. **Question taxonomy audit:** `questions:audit` CLI → scans all workflows → reports which use bare `inputPrompt` vs taxonomy-tagged questions

<!-- /section -->

---

<!-- section: integration_map -->
## Integration Points — New vs Modified vs Unchanged

### NEW Components

| Component | Type | Location | Depends On | Consumed By |
|-----------|------|----------|------------|-------------|
| Question templates | Data + functions | `src/lib/prompts.js` (new section) | `routeQuestionType`, option generation helpers | Workflows via `question()` calls |
| `questions:audit` | CLI command | `src/commands/questions.js` | `extractSectionsFromFile`, workflow scanning | Developers debugging taxonomy compliance |
| `questions:list` | CLI command | `src/commands/questions.js` | `QUESTION_TEMPLATES` registry | Developers discovering available templates |
| `resolveQuestionType` | Decision function | `src/lib/decision-rules.js` | Workflow step parsing | `evaluateDecisions()` — consumed by bgsd-context |
| `resolveOptionGeneration` | Decision function | `src/lib/decision-rules.js` | `routeQuestionType` | Option generation in `prompts.js` |

### MODIFIED Components

| Component | What Changes | Why |
|-----------|-------------|-----|
| `src/lib/prompts.js` | Add `QUESTION_TEMPLATES`, `routeQuestionType()`, `questionTemplate()`, option generation helpers, section markers | Centralize question text + add taxonomy layer |
| `src/lib/decision-rules.js` | Add `resolveQuestionType` and `resolveOptionGeneration` to DECISION_REGISTRY | Pre-compute question routing decisions |
| `src/lib/context.js` | Add `question_context` to relevant agent manifests (planner, phase-researcher, executor) | Downstream agents need question decisions |
| `workflows/discuss-phase.md` | Replace inline question text with `question(id, context)` references | Taxonomied questions — primary target |
| `workflows/new-milestone.md` | Replace inline question text with `question(id, context)` references | Taxonomied questions |
| `workflows/plan-phase.md` | Replace inline question text with `question(id, context)` references | Taxonomied questions |
| `workflows/transition.md` | Replace inline question text with `question(id, context)` references | Taxonomied questions |

### UNCHANGED Components

| Component | Why Unchanged |
|-----------|--------------|
| `src/lib/orchestration.js` | Task routing and model selection unaffected by question taxonomy |
| `src/lib/db.js` | No new SQLite tables needed — question decisions stored via existing dual-write pattern |
| `src/commands/decisions.js` | Already handles DECISION_REGISTRY entries — new rules auto-discovered |
| `src/plugin/command-enricher.js` | Question decisions flow through existing enricher pipeline automatically |
| `src/router.js` | New CLI commands use existing namespace routing (`questions:*`) |
| Templates (`templates/*.md`) | Document templates unaffected |
| `build.cjs` | No new entry points — all code goes into existing modules |
| `AGENTS.md` | Agent definitions unchanged — question intelligence is CLI data, not new agents |

<!-- /section -->

---

<!-- section: build_order -->
## Suggested Build Order

### Wave 1: Core Infrastructure (No Dependencies)

**Task 1: Add question taxonomy to `prompts.js`**
- File: `src/lib/prompts.js`
- Action: Add `QUESTION_TEMPLATES` registry, `routeQuestionType()`, `questionTemplate()`, option generation helpers
- Pattern: Follow `cmdSummaryGenerate` pattern — templates with data/judgment separation
- Verify: `prompts.js` exports `routeQuestionType` and `questionTemplate`
- Dependencies: None

**Task 2: Add question routing decision functions to `decision-rules.js`**
- File: `src/lib/decision-rules.js`
- Action: Add `resolveQuestionType`, `resolveOptionGeneration` to DECISION_REGISTRY
- Pattern: Follow existing decision functions (pure, state → { value, confidence, rule_id })
- Verify: `decisions:list` shows new rules; `decisions:evaluate question-type --state '{...}'` works
- Dependencies: None (can parallelize with Task 1)

### Wave 2: Workflow Migration (Depends on Wave 1)

**Task 3: Migrate discuss-phase.md to use question taxonomy**
- File: `workflows/discuss-phase.md`
- Key steps to migrate:
  - `present_gray_areas` step: 5 inline gray area options → `question(id="discover_phase_areas")`
  - `discuss_areas` step: "More questions" / "Next area" → taxonomy-tagged options
  - `customer_stress_test` step: "No changes" / "Revisit" → `question(id="decide_stress_outcome")`
- Verify: Workflow behaves identically — measure before/after token count
- Dependencies: Task 1 (templates must exist)

**Task 4: Migrate new-milestone.md to use question taxonomy**
- File: `workflows/new-milestone.md`
- Key steps:
  - `determine_version` step: inline version options → `question(id="decide_version")`
  - `research` step: "Research first" / "Skip research" → `question(id="confirm_research")`
  - `define_requirements` step: category scoping checkboxes → `question(id="scope_requirements")`
- Verify: Workflow behaves identically
- Dependencies: Task 1 (templates must exist)

**Task 5: Migrate remaining workflow question steps**
- Files: `workflows/transition.md`, `workflows/plan-phase.md`, `workflows/add-phase.md`, etc.
- Pattern: Same as Tasks 3-4
- Dependencies: Task 1 (templates must exist)

### Wave 3: Tooling + Agent Context (Depends on Wave 1)

**Task 6: Add `questions:audit` and `questions:list` CLI commands**
- File: `src/commands/questions.js` (new)
- Actions:
  - `questions:audit` — scan all workflow .md files, detect bare `question(` calls without taxonomy IDs, report findings
  - `questions:list` — list all registered `QUESTION_TEMPLATES` with their types
- Verify: `questions:audit` reports remaining non-taxonomied questions
- Dependencies: Task 1 (template registry must exist)

**Task 7: Add question context to agent manifests**
- File: `src/lib/context.js`
- Action: Add `question_decisions` to AGENT_MANIFESTS for planner, phase-researcher
- Pattern: Follow existing manifest field addition pattern
- Verify: `bgsd-context` JSON includes `question_decisions` for relevant agents
- Dependencies: Task 2 (decision functions must exist)

### Dependency Graph

```
Wave 1:  Task 1 (prompts taxonomy) ──┬──→ Task 2 (decision functions)
                                      │
Wave 2:  Task 3 (discuss-phase) ───←─┤
          Task 4 (new-milestone) ───←─┤
          Task 5 (remaining workflows)←─┘

Wave 3:  Task 6 (questions CLI) ────←──┐
          Task 7 (agent manifests) ───←──┘
```

**Parallel opportunities:**
- Tasks 1 and 2 can start in parallel (different files, same layer)
- Tasks 3, 4, 5 can run in parallel (different workflow files)
- Tasks 6 and 7 can start once Task 1 is complete

<!-- /section -->

---

<!-- section: anti_patterns -->
## Anti-Patterns

### Anti-Pattern 1: Bare Open-Ended Questions (The Problem Being Solved)

**What people do:** Asking users to make decisions without presenting options:
```
question: "What do you want to build next?"
```

**Why it's wrong:** Forces the user to generate options from scratch — cognitive load is high, quality varies. This is the exact anti-pattern v15.0 eliminates.

**Do this instead:**
```
question(id="discover_milestone_goals", type="discover", context={ previous_features })
// prompts.js renders:
// "What do you want to build next?"
// Options: [Feature from research, Feature from research, Feature from research, "Something else"]
```

### Anti-Pattern 2: Inline Question Text in Workflows

**What people do:** Embedding raw question text directly in workflow markdown:
```
question: "Which areas do you want to discuss for [phase name]?"
options: ["Session handling", "Error responses", "Multi-device policy", "Recovery flow"]
```

**Why it's wrong:** Same question text duplicated across workflows. No reuse. No taxonomy. Hard to audit which questions still need upgrading.

**Do this instead:** Reference a question template from `prompts.js`:
```
question(id="discover_phase_areas", type="discover", context="gray_areas")
```

### Anti-Pattern 3: LLM Generating Options Without Taxonomy

**What people do:** Workflow instructs LLM to "generate 3-5 options" without providing a taxonomy or criteria for good options.

**Why it's wrong:** LLM option quality is inconsistent. No guarantee of coverage, clarity, or appropriateness.

**Do this instead:** Provide taxonomy-specific option generation guidance in `prompts.js`:
```javascript
const QUESTION_GUIDANCE = {
  discover: {
    minOptions: 4,
    maxOptions: 6,
    criteria: ['specific', 'mutually-exclusive', 'actionable'],
    includeOther: true,
  },
  decide: {
    minOptions: 2,
    maxOptions: 3,
    criteria: ['concrete', 'high-contrast', 'actionable'],
    includeDefault: true,
  },
  prioritize: {
    type: 'checkbox',
    countHint: 3,
    criteria: ['specific', 'ranked-by-impact'],
  },
};
```

### Anti-Pattern 4: Questions Without Decision Recording

**What people do:** Asking for user input but not recording the decision for downstream agents.

**Why it's wrong:** Downstream agents (planner, executor) can't see what was decided. Either the question gets asked again or agents make different choices.

**Do this instead:** Every question that captures a decision should:
1. Record to `DECISION_REGISTRY` via `decision-rules.js` (already handled by `evaluateDecisions`)
2. Write to `STATE.md` under "Decisions" section
3. Include the decision in `bgsd-context` for downstream agents

### Anti-Pattern 5: Options That Are Just Labels

**What people do:**
```
options: ["Option A", "Option B", "Option C"]
```

**Why it's wrong:** Users can't make informed decisions from unlabeled options. Options should be self-explanatory without requiring the user to remember what the question was.

**Do this instead:**
```
options: [
  { value: 'session', label: 'Session handling — how state persists across calls' },
  { value: 'errors', label: 'Error responses — what happens when things fail' },
  { value: 'multi', label: 'Multi-device policy — how state syncs across devices' },
]
```

<!-- /section -->

---

<!-- section: sizing -->
## Sizing Estimates

### Token Impact Analysis

| Target | Current State | After v15.0 | Savings |
|--------|--------------|-------------|---------|
| 45 workflows × avg 5 questions | ~225 inline question texts | ~225 template references (shorter) | ~2-3K tokens total |
| Option generation | Ad-hoc LLM generation (variable) | Structured from templates (deterministic) | Consistent, auditable |
| Question taxonomy decision routing | None | Pre-computed via DECISION_REGISTRY | ~200 tokens per question decision |

### Effort Estimates

| Task | Complexity | Files | Estimated Duration |
|------|-----------|-------|-------------------|
| prompts.js taxonomy infrastructure | Medium — design taxonomy, template registry | `src/lib/prompts.js` | 45-60 min |
| decision-rules.js question routing | Low — pure functions, follows existing pattern | `src/lib/decision-rules.js` | 20-30 min |
| questions:audit + questions:list CLI | Low — scanning + listing | `src/commands/questions.js` | 30-45 min |
| discuss-phase.md migration | Medium — 5-6 questions to migrate | `workflows/discuss-phase.md` | 20-30 min |
| new-milestone.md migration | Medium — 4-5 questions to migrate | `workflows/new-milestone.md` | 15-20 min |
| Remaining workflows migration | Low-Medium — per workflow | ~40 other workflows | 60-90 min total |

<!-- /section -->

---

<!-- section: sources -->
## Sources

- `src/lib/prompts.js` — Existing inquirer wrapper primitives (verified in codebase, HIGH confidence)
- `src/lib/decision-rules.js` — DECISION_REGISTRY with 19 existing pure decision functions (verified in codebase, HIGH confidence)
- `src/lib/context.js` — AGENT_MANIFESTS with field scoping (verified in codebase, HIGH confidence)
- `workflows/discuss-phase.md` — 538-line workflow with inline question text (verified in filesystem, HIGH confidence)
- `workflows/new-milestone.md` — 275-line workflow with inline question text (verified in filesystem, HIGH confidence)
- [Azure AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) — Orchestration patterns (sequential, parallel, multi-agent), HIGH confidence
- [Screech 120-Agent Architecture](https://www.decodingai.com/p/scaling-120-ai-agents-two-tier-orchestration) — Two-tier orchestration (conductor + specialists), routing before expensive calls, MEDIUM confidence
- [Anthropic Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/introduction-to-prompt-engineering) — Option generation guidance, few-shot examples, HIGH confidence
- [Google Cloud Prompt Engineering](https://cloud.google.com/discover/what-is-prompt-engineering) — Prompt structure and role engineering, MEDIUM confidence

---
*Architecture research for: v15.0 Workflow Questioning & Decision Quality — question design system integration*
*Researched: 2026-03-19*
