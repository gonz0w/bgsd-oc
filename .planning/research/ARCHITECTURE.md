# Architecture Research: Context Reduction Integration

**Domain:** Context reduction for Node.js CLI-driven AI workflow orchestration
**Researched:** 2026-02-22
**Confidence:** HIGH

## System Overview

```
CONTEXT REDUCTION INTEGRATION POINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Layer 1: CLI Tool (bin/gsd-tools.cjs)
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  src/lib/                              src/commands/                      │
│  ┌──────────────────┐                  ┌────────────────────┐            │
│  │ [NEW] context.js │◀─── used by ────│ init.js            │            │
│  │  - tokenEstimate │                  │  - init commands   │            │
│  │  - sectionFilter │                  │  now return LESS   │            │
│  │  - outputTrimmer │                  │  data by default   │            │
│  └──────────────────┘                  ├────────────────────┤            │
│  ┌──────────────────┐                  │ features.js        │            │
│  │ [MOD] output.js  │                  │  - context-budget  │            │
│  │  - output() now  │◀─── used by ────│    enhanced        │            │
│  │  supports field  │                  ├────────────────────┤            │
│  │  filtering via   │                  │ misc.js            │            │
│  │  --fields flag   │                  │  - summary-extract │            │
│  └──────────────────┘                  │    enhanced        │            │
│  ┌──────────────────┐                  └────────────────────┘            │
│  │ [MOD] helpers.js │                                                    │
│  │  - section       │                                                    │
│  │  extraction gets │                                                    │
│  │  selective read   │                                                    │
│  └──────────────────┘                                                    │
│                                                                          │
│  [MOD] router.js — adds --fields and --sections global flags             │
│  [MOD] constants.js — adds SECTION_WEIGHTS, TOKEN_ESTIMATES              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

 Layer 2: Workflow Prompts (workflows/*.md)
┌──────────────────────────────────────────────────────────────────────────┐
│  [MOD] Reduce redundant instructions, remove duplicated references       │
│  [MOD] Tighten init JSON parsing — request only needed fields            │
│  [MOD] Add context-budget checks to more workflows                       │
│  Target: 30%+ token reduction across workflow prompt layer               │
└──────────────────────────────────────────────────────────────────────────┘

 Layer 3: Templates & References (templates/*.md, references/*.md)
┌──────────────────────────────────────────────────────────────────────────┐
│  [MOD] Tighten templates — remove verbose examples, keep structure       │
│  [MOD] Deduplicate reference material loaded by multiple workflows       │
│  [MOD] Research output templates — produce compact research files        │
└──────────────────────────────────────────────────────────────────────────┘

 Layer 4: Planning Docs (.planning/ in target projects)
┌──────────────────────────────────────────────────────────────────────────┐
│  [INDIRECT] Smaller templates → smaller generated documents              │
│  [INDIRECT] summary-extract enhanced → agents read less from summaries   │
│  [INDIRECT] Selective section reads → agents don't load full files       │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Current Responsibility | Context Reduction Change |
|-----------|----------------------|--------------------------|
| `src/lib/output.js` | JSON-to-stdout, tmpfile overflow | Add field filtering support to `output()` |
| `src/lib/helpers.js` | File reads, phase helpers, milestone detection | Add selective markdown section extraction |
| `src/lib/constants.js` | MODEL_PROFILES, CONFIG_SCHEMA, COMMAND_HELP | Add TOKEN_ESTIMATES, SECTION_WEIGHTS constants |
| `src/commands/init.js` | Compound context gathering for workflows | Reduce default payloads, add `--compact` flag |
| `src/commands/features.js` | 12 feature commands including context-budget | Enhance context-budget with workflow-level estimation |
| `src/commands/misc.js` | summary-extract, history-digest, etc. | Enhance summary-extract with field-level selection |
| `src/router.js` | CLI argv parsing + command dispatch | Parse `--fields` and `--sections` global flags |
| `workflows/*.md` (32 files) | Orchestration prompts for AI agents | Reduce verbosity, deduplicate, tighten instructions |
| `templates/*.md` (24+ files) | Document structure definitions | Remove verbose examples, compact structure guidance |
| `references/*.md` (13 files) | Behavioral rules for agents | Deduplicate cross-referenced content |

## Recommended Architecture: Where Context Reduction Happens

### Decision 1: Token counting — CLI side, not caller side

**Recommendation: CLI side.** Token counting belongs in `src/lib/context.js` (new module).

**Rationale:**
- The CLI already has file access and caching infrastructure
- Token estimation is a pure computation (chars/4 approximation, or line-count × 4)
- Callers (workflow prompts) are markdown — they can't do math
- The existing `cmdContextBudget()` already does this for individual plans
- Extending it to cover init command payloads and workflow prompts is natural

**Implementation:** A new `src/lib/context.js` module with:
```javascript
// Token estimation for any string content
function estimateTokens(text) {
  // Simple heuristic: ~4 chars per token for English text
  // More accurate than line-count × 4 for mixed content
  return Math.ceil(text.length / 4);
}

// Estimate tokens for a JSON payload (before stringification)
function estimateJsonTokens(obj) {
  return estimateTokens(JSON.stringify(obj));
}

// Budget check: returns { tokens, percent, warning, recommendation }
function checkBudget(tokens, config) {
  const window = config.context_window || 200000;
  const target = config.context_target_percent || 50;
  const percent = Math.round((tokens / window) * 100);
  return {
    tokens,
    percent,
    warning: percent > target,
    recommendation: percent > 60 ? 'split' : percent > target ? 'trim' : 'ok',
  };
}
```

**What NOT to do:** Don't use tiktoken or any tokenizer library. The CLI has zero runtime dependencies. The chars/4 heuristic is accurate enough for budgeting (±15%), and the actual token count doesn't matter — what matters is detecting "this is too big" vs "this is fine."

### Decision 2: Selective section extraction — extend existing markdown parser

**Recommendation: Add to `src/lib/helpers.js` as section-aware read functions.**

**Rationale:**
- The existing `getRoadmapPhaseInternal()` already extracts sections by heading
- The pattern generalizes: extract section(s) from any markdown file by heading
- This reduces context when agents only need one section (e.g., "Current Position" from STATE.md)
- Fits the existing "commands → lib" dependency direction

**Implementation:**
```javascript
// In src/lib/helpers.js

/**
 * Extract specific sections from markdown content by heading text.
 * Returns only matched sections, dramatically reducing token count.
 * 
 * @param {string} content - Full markdown file content
 * @param {string[]} sections - Heading texts to extract (case-insensitive)
 * @param {object} options - { level: 2, includeSubheadings: true }
 * @returns {string} Extracted sections concatenated
 */
function extractSections(content, sections, options = {}) {
  const level = options.level || 2;
  const includeSubheadings = options.includeSubheadings !== false;
  // ... heading-based extraction using existing regex patterns
}
```

**Integration with existing commands:**
- `cmdStateGet(cwd, field, raw)` — already does field extraction; generalize to section extraction
- `summary-extract --fields key1,key2` — already supports field filtering; works as-is
- New: `state load --sections "Current Position,Blockers"` — return only those STATE.md sections

**What NOT to do:** Don't build a markdown AST parser. The regex approach works for section extraction (heading-delimited text blocks are structurally simple). The PROJECT.md explicitly says "Markdown AST parser — Would add heavy dependencies" is out of scope.

### Decision 3: JSON output filtering — CLI flag, not caller side

**Recommendation: CLI-side `--fields` flag parsed in router.js.**

**Rationale:**
- Callers (workflow prompts) already parse specific fields from JSON output
- But the full JSON is still transmitted through stdout → Bash variable → agent parsing
- A `--fields` flag lets the CLI return only requested fields, reducing stdout bytes
- This is the single highest-impact change for init commands (which return 20-40 fields)

**Implementation:**
```javascript
// In src/router.js — parse --fields before dispatch
const fieldsIdx = args.indexOf('--fields');
const requestedFields = fieldsIdx !== -1 
  ? args.splice(fieldsIdx, 2)[1].split(',')
  : null;

// In src/lib/output.js — filter before serialization
function output(result, raw, rawValue) {
  let filtered = result;
  if (global._gsdRequestedFields && typeof result === 'object' && result !== null) {
    filtered = {};
    for (const field of global._gsdRequestedFields) {
      if (field in result) filtered[field] = result[field];
    }
  }
  // ... existing output logic
}
```

**Impact analysis for init commands:**

| Command | Current Fields | Typical Usage | Reduction with --fields |
|---------|---------------|---------------|------------------------|
| `init execute-phase` | 24 fields | Workflow uses 15 | ~38% JSON reduction |
| `init plan-phase` | 22 fields | Workflow uses 12 | ~45% JSON reduction |
| `init progress` | 20 fields + phases[] | Workflow uses 10 | ~50% JSON reduction |
| `init new-project` | 16 fields | Workflow uses 10 | ~38% JSON reduction |
| `init quick` | 16 fields | Workflow uses 8 | ~50% JSON reduction |

**Backward compatibility:** Without `--fields`, behavior is identical. This is additive.

**What NOT to do:** Don't filter on the caller side (in workflow markdown). The full JSON still flows through stdout and Bash variable assignment — filtering after that doesn't save context. The filtering must happen before serialization.

### Decision 4: Workflow prompt compression — structured rewriting

**Recommendation: Manual rewrite of each workflow, targeting 30%+ reduction without losing agent clarity.**

**Rationale:**
- Workflows are the single largest context consumer (11,050 lines across 32 files)
- They're loaded into agent context at the start of every invocation
- Reduction techniques: remove redundant `<required_reading>` refs, inline short references instead of @-loading separate files, deduplicate instructions repeated across workflows, tighten verbose step descriptions
- This is NOT automated — each workflow needs human judgment about what's essential

**Approach — three compression techniques:**

1. **Dedup cross-workflow instructions:** Several workflows repeat identical blocks (error handling, banner display, config parsing). Extract to a shared preamble pattern loaded once.

2. **Tighten step descriptions:** Many steps have 10+ lines of explanation where 3-4 would suffice. Agents don't need prose — they need clear instructions.

3. **Reduce @-file references:** `checkpoints.md` (776 lines) is loaded by 3+ workflows. Most workflows only need 1-2 checkpoint types. Either split the reference or inline the relevant checkpoint definition.

**Estimated impact by file size:**

| Workflow | Current Lines | Estimated After | Savings |
|----------|--------------|-----------------|---------|
| new-project.md | 1,116 | ~780 | ~30% |
| complete-milestone.md | 700 | ~490 | ~30% |
| verify-work.md | 569 | ~400 | ~30% |
| execute-phase.md | 529 | ~370 | ~30% |
| execute-plan.md | 485 | ~340 | ~30% |
| plan-phase.md | 455 | ~320 | ~30% |
| quick.md | 453 | ~320 | ~30% |
| **Total (all 32)** | **11,050** | **~7,700** | **~30%** |

**What NOT to do:** Don't use automated summarization or templating to compress workflows. Each workflow is a carefully structured prompt — compression requires understanding what each instruction does and whether agents need it. Lossy compression = broken workflows.

### Decision 5: Context budgeting integration pattern

**Recommendation: Enhance `cmdContextBudget()` to estimate full workflow context, not just plan files.**

**Current state:** `cmdContextBudget()` (in `src/commands/features.js`) only estimates tokens for a single PLAN.md file. It counts `<task>` blocks, files_modified, and line counts.

**Enhanced design:** A new `context-budget-workflow` command (or enhancement to existing) that estimates the total context load for an entire workflow invocation:

```javascript
// Estimate context for a workflow invocation
function cmdContextBudgetWorkflow(cwd, workflowName, phase, raw) {
  const workflowPath = path.join(PLUGIN_DIR, 'workflows', `${workflowName}.md`);
  const workflowContent = safeReadFile(workflowPath);
  
  let total = 0;
  const breakdown = {};
  
  // 1. Workflow prompt itself
  const workflowTokens = estimateTokens(workflowContent);
  breakdown.workflow_prompt = workflowTokens;
  total += workflowTokens;
  
  // 2. @-referenced files (extract from <required_reading>)
  const refs = extractAtReferences(workflowContent);
  let refTokens = 0;
  for (const ref of refs) {
    const refContent = safeReadFile(ref);
    if (refContent) refTokens += estimateTokens(refContent);
  }
  breakdown.referenced_files = refTokens;
  total += refTokens;
  
  // 3. Init command JSON output
  const initResult = simulateInit(cwd, workflowName, phase);
  const initTokens = estimateJsonTokens(initResult);
  breakdown.init_json = initTokens;
  total += initTokens;
  
  // 4. Files the workflow will read (STATE.md, ROADMAP.md, etc.)
  const fileReads = estimateFileReads(cwd, workflowName, phase);
  breakdown.file_reads = fileReads;
  total += fileReads;
  
  // Budget check
  const config = loadConfig(cwd);
  const budget = checkBudget(total, config);
  
  output({ workflow: workflowName, breakdown, ...budget }, raw);
}
```

**Integration point:** This can be called by workflows at initialization:
```bash
# In any workflow's first step
BUDGET=$(node gsd-tools.cjs context-budget-workflow "${WORKFLOW_NAME}" "${PHASE}" --raw 2>/dev/null)
```

### Decision 6: --compact flag for init commands

**Recommendation: Add `--compact` flag to init commands that returns a minimal payload.**

**Rationale:**
- Init commands currently return everything a workflow might need
- Many fields are only used in edge cases (e.g., `session_diff` in `init progress`, `branch_name` in `init execute-phase` when `branching_strategy` is "none")
- A `--compact` flag returns only the fields the workflow always uses
- The workflow can request additional fields only when needed

**Implementation pattern:**
```javascript
function cmdInitExecutePhase(cwd, phase, raw, compact = false) {
  // ... existing setup ...
  
  const result = {
    // Always included (minimal set)
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    plan_count: phaseInfo?.plans?.length || 0,
    incomplete_count: phaseInfo?.incomplete_plans?.length || 0,
    commit_docs: config.commit_docs,
    parallelization: config.parallelization,
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
  };
  
  if (!compact) {
    // Extended fields (only when not compact)
    result.verifier_model = resolveModelInternal(cwd, 'gsd-verifier');
    result.branching_strategy = config.branching_strategy;
    result.branch_name = /* ... */;
    result.plans = phaseInfo?.plans || [];
    result.summaries = phaseInfo?.summaries || [];
    result.milestone_version = milestone.version;
    result.milestone_name = milestone.name;
    // ... etc
  }
  
  output(result, raw);
}
```

**Router change:**
```javascript
// In router.js, for init commands
const compact = args.includes('--compact');
if (compact) args.splice(args.indexOf('--compact'), 1);
```

## Data Flow Changes

### Current Flow (no context reduction)

```
Workflow loads:
  workflow.md                    ~500 lines    (~2,000 tokens)
  + @references/checkpoints.md   776 lines    (~3,100 tokens)
  + @references/ui-brand.md      160 lines    (~640 tokens)
  + @references/git-integration.md 248 lines  (~992 tokens)
                                              ─────────────
                                              ~6,732 tokens just in prompt

  + init command JSON output                  (~800-2,000 tokens)
  + STATE.md full read                        (~400-1,200 tokens)
  + ROADMAP.md full read                      (~200-800 tokens)
  + PLAN.md files read                        (~800-2,400 tokens)
                                              ─────────────
                                              ~8,932-13,132 tokens per invocation
```

### Proposed Flow (with context reduction)

```
Workflow loads:
  workflow.md (compressed)       ~350 lines    (~1,400 tokens) ← 30% smaller
  + @references/checkpoints.md   (inlined)     (~200 tokens)  ← only relevant type
  + @references/ui-brand.md      (inlined)     (~200 tokens)  ← only banner pattern
  + @references/git-integration.md (inlined)   (~200 tokens)  ← only commit pattern
                                              ─────────────
                                              ~2,000 tokens in prompt (70% reduction)

  + init command JSON (--compact) (~400-800 tokens)   ← 50% smaller
  + STATE.md section read         (~100-300 tokens)   ← selective sections
  + ROADMAP.md section read       (~100-200 tokens)   ← selective sections
  + PLAN.md files read            (~800-2,400 tokens) ← unchanged (needed in full)
                                              ─────────────
                                              ~3,400-5,700 tokens per invocation
```

**Estimated total reduction: 50-60% per workflow invocation.**

## Module Integration Map

### New Module: `src/lib/context.js`

```
Dependencies: src/lib/helpers.js (for safeReadFile), src/lib/config.js (for loadConfig)
Used by:      src/commands/features.js (context-budget), src/commands/init.js (compact mode)
Exports:      estimateTokens(), estimateJsonTokens(), checkBudget(), extractSections()
```

### Modified Modules

| Module | What Changes | Why | Risk |
|--------|-------------|-----|------|
| `src/lib/output.js` | `output()` respects `global._gsdRequestedFields` | Field filtering before serialization | LOW — additive, no-op when flag absent |
| `src/lib/helpers.js` | Add `extractSections()` | Section-level markdown extraction | LOW — new function, no existing code changed |
| `src/lib/constants.js` | Add `TOKEN_ESTIMATES`, `SECTION_WEIGHTS` | Static data for budget estimation | LOW — additive constants |
| `src/router.js` | Parse `--fields`, `--compact`, `--sections` flags | Global flag support | LOW — flag parsing before dispatch |
| `src/commands/init.js` | Support `--compact` in all 12 init commands | Reduce default payload sizes | MEDIUM — modifies 12 functions |
| `src/commands/features.js` | Enhance `cmdContextBudget()` | Workflow-level budget estimation | LOW — extends existing function |
| `src/commands/misc.js` | Enhance `cmdSummaryExtract()` | Better field-level selection | LOW — extends existing function |

### Unchanged Modules

| Module | Why Unchanged |
|--------|---------------|
| `src/lib/config.js` | Config loading doesn't change (already has `context_window`, `context_target_percent`) |
| `src/lib/frontmatter.js` | Frontmatter parsing is already lean |
| `src/lib/git.js` | Git operations unaffected by context reduction |
| `src/commands/state.js` | State mutations are write operations, not context consumers |
| `src/commands/roadmap.js` | Roadmap operations are already targeted |
| `src/commands/phase.js` | Phase operations don't load unnecessary context |
| `src/commands/verify.js` | Verification suite reads specific files |

## Architectural Patterns

### Pattern 1: Progressive Disclosure in Init Commands

**What:** Init commands return a minimal "compact" payload by default, with the full payload available via explicit request.
**When to use:** For any command whose JSON output exceeds ~1KB. The workflow parses the compact response for its critical path, then requests extended data only when conditional branches need it.
**Trade-offs:** Slightly more complex workflow logic (two CLI calls in edge cases) vs significantly reduced default context consumption. The second call is rare — most workflow runs follow the happy path.

**Example:**
```bash
# Workflow step 1: Get compact context
INIT=$(node gsd-tools.cjs init execute-phase "${PHASE}" --compact)
# Parse: phase_found, phase_dir, plan_count, incomplete_count, parallelization

# Workflow step 2: Only if branching needed
if [ "$BRANCHING_STRATEGY" != "none" ]; then
  BRANCH=$(node gsd-tools.cjs init execute-phase "${PHASE}" --fields branch_name,milestone_version)
fi
```

### Pattern 2: Section-Aware File Reads

**What:** Instead of loading a full markdown file into agent context, extract only the sections the agent needs.
**When to use:** When workflows read STATE.md, ROADMAP.md, or SUMMARY.md but only use specific sections.
**Trade-offs:** Requires knowing which sections you need upfront. If a workflow needs "most" of a file, just read the whole file.

**Example — reading only Current Position from STATE.md:**
```bash
# Instead of: Read STATE.md (the agent reads the full 100+ line file)
# Do: Extract just the section needed
POSITION=$(node gsd-tools.cjs state get "Current Phase" --raw)
```

The existing `state get <field>` command already does this for single fields. The enhancement is supporting multiple fields or section-level extraction.

### Pattern 3: Inline Short References Instead of @-Loading

**What:** For reference files under ~50 lines, inline the relevant content directly in the workflow rather than @-loading the full file.
**When to use:** When a workflow only needs a small portion of a reference file. `ui-brand.md` (160 lines) is loaded by 5+ workflows, but each only needs the banner pattern (~15 lines).
**Trade-offs:** Duplicates content across workflows (maintenance burden) vs saves ~600 tokens per workflow invocation.

**Mitigation:** Only inline truly stable content (banner format, checkpoint types). Keep @-loading for content that changes frequently.

## Build Order

The features should be built in this order based on dependencies between them:

### Phase 1: Foundation — Token Estimation & Measurement (build first)

**What:** Create `src/lib/context.js` with token estimation utilities. Enhance `context-budget` to measure workflow-level context consumption. Add `--fields` flag support to router and output.

**Why first:** Everything else depends on being able to measure impact. Without measurement, you can't verify 30%+ reduction target. The `--fields` flag is also foundational — it's used by every subsequent optimization.

**Modules touched:**
- `src/lib/context.js` (NEW)
- `src/lib/output.js` (MODIFY — field filtering)
- `src/lib/constants.js` (MODIFY — token estimates)
- `src/router.js` (MODIFY — parse --fields flag)
- `src/commands/features.js` (MODIFY — enhance context-budget)

**Dependencies:** None — this is the foundation.

**Deliverables:**
- `context-budget` command can estimate workflow-level token usage
- `--fields` flag works on any command
- Baseline measurements for all 32 workflows documented

### Phase 2: CLI Output Reduction — Init Command Compaction

**What:** Add `--compact` flag to all 12 init commands. Reduce default payloads. Document which fields are "compact" vs "extended" for each init command.

**Why second:** Init commands are the primary data source for workflows. Reducing their output directly reduces context consumption. Depends on Phase 1 for measurement.

**Modules touched:**
- `src/commands/init.js` (MODIFY — all 12 init commands)
- `src/router.js` (MODIFY — parse --compact flag)

**Dependencies:** Phase 1 (for --fields infrastructure and measurement).

**Deliverables:**
- All 12 init commands support `--compact`
- Measured token reduction per init command (target: 40-50% per command)

### Phase 3: Workflow Prompt Compression

**What:** Rewrite all 32 workflow files for token efficiency. Deduplicate cross-workflow instructions. Inline short references. Tighten step descriptions.

**Why third:** Workflows are the largest context consumer (11,050 lines). This phase has the highest absolute token savings. Depends on Phase 1 for measurement (before/after), and Phase 2 so workflow changes can leverage `--compact` init calls.

**Files touched:**
- `workflows/*.md` (ALL 32 files)
- `references/*.md` (potentially split or trim some)

**Dependencies:** Phase 1 (measurement), Phase 2 (--compact flag availability).

**Deliverables:**
- All 32 workflows rewritten for reduced context
- Measured before/after token counts (target: 30%+ reduction in prompt tokens)
- No behavioral regression (workflows produce identical outcomes)

### Phase 4: Template & Research Output Reduction

**What:** Tighten document templates to produce smaller generated documents. Compact research output templates. Add section-aware reading for generated documents.

**Why fourth:** Templates control the size of documents created by GSD. Smaller templates → smaller STATE.md, SUMMARY.md, RESEARCH.md → less context when agents read these files. Less urgent than workflow compression because template impact is indirect.

**Files touched:**
- `templates/*.md` (MODIFY — tighten structure guidance)
- `templates/research-project/*.md` (MODIFY — produce compact research)
- `src/lib/helpers.js` (MODIFY — add extractSections())

**Dependencies:** Phase 1 (measurement). Independent of Phases 2-3, but logically follows them.

**Deliverables:**
- Templates produce 20-30% smaller documents
- `extractSections()` available for selective file reads
- Before/after measurements for document sizes

### Phase 5: Tech Debt Cleanup (parallel-safe)

**What:** Fix broken `roadmap analyze` test. Add missing --help text for 36 commands. Create plan template files.

**Why last/parallel:** These are independent tech debt items that don't depend on context reduction features. They can be done in parallel with any phase, or deferred to the end.

**Modules touched:**
- `src/commands/roadmap.js` (FIX — test expectation)
- `src/lib/constants.js` (ADD — 36 help entries)
- `templates/plans/` (NEW — plan template files)

**Dependencies:** None — fully independent.

### Build Order Dependency Graph

```
Phase 1: Foundation
  └──▶ Phase 2: CLI Output Reduction
  │     └──▶ Phase 3: Workflow Compression
  └──▶ Phase 4: Template Reduction (can start after Phase 1)

Phase 5: Tech Debt (independent, can run in parallel with any phase)
```

## Anti-Patterns

### Anti-Pattern 1: Lossy Workflow Compression

**What people do:** Use automated summarization or aggressive deletion to shrink workflow files, removing "obvious" instructions.
**Why it's wrong:** Workflow prompts are precision instruments — each instruction exists because an agent previously did the wrong thing without it. Removing "you must read STATE.md first" seems safe until an agent skips it and corrupts project state. Every deleted line must be individually evaluated for necessity.
**Do this instead:** Rewrite for conciseness, don't delete for brevity. "Read STATE.md before any operation to load project context" → "Read STATE.md first." Same instruction, fewer tokens.

### Anti-Pattern 2: Dynamic Token Counting with External Libraries

**What people do:** Import tiktoken or similar tokenizer for accurate token counts.
**Why it's wrong:** Adds a runtime dependency (violates zero-dependency constraint), requires model-specific tokenizer data, and the precision isn't needed. Context budgeting is about "is this too big?" not "exactly how many tokens."
**Do this instead:** Use chars/4 heuristic. It's consistently within ±15% for English text and mixed code/markdown. For JSON, it's even more predictable.

### Anti-Pattern 3: Caller-Side JSON Filtering

**What people do:** Let the CLI output full JSON, then filter in the workflow with `jq` or string manipulation.
**Why it's wrong:** The full JSON is already in the agent's context by the time it's assigned to a Bash variable. The agent parsed it. Filtering after assignment doesn't reduce context consumption — the damage is done.
**Do this instead:** Filter at the CLI level with `--fields` so the JSON never enters context.

### Anti-Pattern 4: Splitting Workflow Files into Smaller Pieces

**What people do:** Split a 500-line workflow into 5 files of 100 lines, loaded with @-references.
**Why it's wrong:** @-references are loaded into context too — there's no lazy loading. Five 100-line files consume the same tokens as one 500-line file. Splitting adds indirection without saving context.
**Do this instead:** Make the single file shorter through rewriting, not splitting.

### Anti-Pattern 5: Removing @-References Without Inlining Critical Content

**What people do:** Remove `@references/checkpoints.md` from a workflow to save ~3,100 tokens.
**Why it's wrong:** The agent now doesn't know about checkpoint types and will skip human-verify checkpoints, leading to unchecked phase completions.
**Do this instead:** Inline only the checkpoint type(s) relevant to this specific workflow (~50 tokens instead of 3,100).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (32 workflows, ~11K lines) | Manual compression + --fields/--compact flags handles this |
| 50+ workflows (~20K lines) | Consider a "workflow preprocessor" that strips comments and whitespace at build time |
| 100+ workflows (~40K lines) | Consider workflow inheritance (base workflow + overrides) to eliminate duplication |

### Scaling Priorities

1. **First bottleneck: Workflow prompt size.** At 11,050 lines, this is already the primary context consumer. The 30% compression target addresses this directly.
2. **Second bottleneck: @-referenced files.** `checkpoints.md` (776 lines) and `verification-patterns.md` (612 lines) are loaded by multiple workflows. Inlining relevant excerpts is the fix.
3. **Third bottleneck: Init command payloads.** Currently returning 16-24 fields when 8-15 are used. The `--compact` / `--fields` approach addresses this.

## Integration Points

### How Context Reduction Integrates With Each Existing Module

| Existing Module | Integration | Effort |
|-----------------|-------------|--------|
| `src/lib/output.js` (47 lines) | Add ~15 lines for field filtering in `output()` | LOW |
| `src/lib/helpers.js` (420 lines) | Add ~40 lines for `extractSections()` | LOW |
| `src/lib/constants.js` (528 lines) | Add ~20 lines for TOKEN_ESTIMATES | LOW |
| `src/router.js` (546 lines) | Add ~10 lines for --fields/--compact flag parsing | LOW |
| `src/commands/init.js` (730 lines) | Modify all 12 init functions for --compact | MEDIUM |
| `src/commands/features.js` (1045 lines) | Enhance cmdContextBudget ~50 lines | LOW |
| `src/commands/misc.js` | Enhance summary-extract ~20 lines | LOW |
| `workflows/*.md` (32 files, 11K lines) | Rewrite each for 30% reduction | HIGH (effort) |
| `templates/*.md` (24+ files) | Tighten each by 20-30% | MEDIUM |
| `references/*.md` (13 files) | Split or trim for selective loading | MEDIUM |

### New Components Summary

| Component | Type | Location | Lines (est.) | Purpose |
|-----------|------|----------|-------------|---------|
| `src/lib/context.js` | NEW module | `src/lib/` | ~60 | Token estimation, budget checking |
| `--fields` flag | MODIFY router | `src/router.js` | ~10 | Global output field filtering |
| `--compact` flag | MODIFY router | `src/router.js` | ~5 | Init command payload reduction |
| `extractSections()` | NEW function | `src/lib/helpers.js` | ~40 | Selective markdown section reading |
| Context measurement script | NEW dev tool | `scripts/measure-context.js` | ~100 | Before/after token measurement for benchmarks |

### Backward Compatibility

Every change is additive:
- Without `--fields`: output is identical to current
- Without `--compact`: init commands return full payloads
- Compressed workflows: produce identical outcomes, just fewer tokens in prompt
- Templates: generate compatible documents (same headings, same frontmatter)
- No changes to JSON output schema — fields are never removed, only made optional

## Sources

- **Current codebase analysis** — Direct inspection of 15 source modules, 32 workflow files, 24+ templates, 13 references — **HIGH confidence**
- **Token estimation heuristics** — OpenAI tokenizer documentation confirms ~4 chars/token for English; anthropic documentation confirms similar for Claude models — **HIGH confidence**
- **Context window sizes** — Claude Opus/Sonnet: 200K tokens, configurable via `context_window` in config.json — **HIGH confidence** (existing implementation)
- **Workflow line counts** — Measured via `wc -l` across all files — **HIGH confidence** (exact measurements)

---
*Architecture research for: Context reduction integration with GSD plugin*
*Researched: 2026-02-22*
