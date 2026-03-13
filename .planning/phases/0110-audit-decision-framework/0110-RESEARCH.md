# Phase 110: Audit & Decision Framework - Research

**Researched:** 2026-03-13
**Domain:** Static analysis of workflow decision points, rubric-based scoring, token estimation
**Confidence:** HIGH

## Summary

Phase 110 is an audit phase — no new runtime code, no new dependencies. The deliverable is a CLI scan command (`audit:scan` or similar) that reads all 44 workflow `.md` files and agent definitions, identifies logical decision points where the LLM currently reasons about things that have finite inputs and deterministic outputs, scores each candidate against a 7-criteria rubric, and produces a prioritized catalog as a JSON artifact with token savings estimates.

The codebase already has strong precedents for this pattern: `util:agent audit` scans agent files and reports responsibility overlap, `verify:validate roadmap` scans planning artifacts for structural issues, and `util:codebase analyze` performs static analysis on source code. The new scan command follows the same architecture — read files, apply regex/heuristic extraction, score with lookup tables, output structured JSON.

The key technical challenge is not the scanning (straightforward regex + heuristic extraction on markdown) but the **rubric design** — defining the 3 critical + 4 preferred criteria precisely enough that they can be applied consistently, and the **token estimation model** — producing credible per-candidate savings numbers without runtime telemetry (which doesn't exist yet; FLOW-03 adds it in Phase 112).

**Primary recommendation:** Build the scan as a single new command in `src/commands/` following the existing `codebase analyze` pattern. Use regex-based extraction on workflow markdown to find decision indicators. Score with a pure-function rubric. Estimate tokens using a static model based on decision-pattern complexity and invocation frequency from workflow structure.

<user_constraints>

## User Constraints

From CONTEXT.md:

1. **Logical decision level granularity** — Scan identifies individual decisions within workflow steps (e.g., "classify scope creep", "pick question format"), not coarser workflow-step level items
2. **Pattern-based scanning** — CLI scans workflow markdown for decision indicators (conditionals, if/then patterns, option lists, "choose"/"decide" language) to identify candidates programmatically
3. **Action list only** — The catalog contains offloadable decisions only; candidates that fail the rubric are explicitly marked "keep in LLM" with rationale (per success criteria SC-4), but the catalog is fundamentally an action list
4. **Context capture depth is agent's discretion** — How much surrounding context to capture per candidate is flexible

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Requirement | Mapping |
|----|-------------|---------|
| AUDIT-01 | User can run a codebase scan that catalogs all LLM-offloadable decisions across workflows and agents | CLI `audit:scan` command with JSON output |
| AUDIT-02 | Each offloading candidate is evaluated against a decision criteria rubric (finite inputs, deterministic output, no NLU needed) | Pure-function rubric scorer with 3 critical + 4 preferred criteria |
| AUDIT-03 | User can see estimated token savings per offloaded decision and per category | Token estimation model with per-candidate and aggregate savings |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs` | built-in | Read workflow/agent `.md` files | Already used everywhere in bgsd-tools.cjs |
| Node.js `path` | built-in | Resolve file paths | Already used everywhere |
| Regex | built-in | Pattern-based decision point detection | User constraint: pattern-based scanning |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/frontmatter.js` | existing | Extract YAML frontmatter from plan/workflow files | If scanning PLAN.md files for decision metadata |
| `src/lib/output.js` | existing | Structured JSON/TTY output | For command output formatting |
| `src/lib/format.js` | existing | Tables, colors, banners | For TTY-formatted catalog display |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex-based markdown scanning | AST-based markdown parser (remark, unified) | Over-engineering — workflow files are structured enough for regex; zero-dependency constraint blocks external parsers |
| Static token estimation | Runtime token counting via LLM API | Not available until Phase 112 adds telemetry; static estimates are sufficient for prioritization |
| Manual rubric application | LLM-assisted rubric scoring | Defeats the purpose — this is about identifying what code can handle WITHOUT LLM involvement |

## Architecture Patterns

### Recommended Project Structure

```
src/commands/audit.js          # New command module (audit:scan, audit:catalog)
src/lib/audit/                 # (Optional) If audit logic is complex enough to split
  scanner.js                   # Decision point extractor from markdown
  rubric.js                    # 7-criteria rubric scorer (pure functions)
  token-estimator.js           # Token savings estimation model
```

However, given the project convention of single-file CLI and the existing pattern where commands like `codebase.js` (481 lines) contain both command handlers and analysis logic, the simpler approach is:

```
src/commands/audit.js          # All audit logic: scanning, rubric, estimation, output
```

Register in `src/router.js` under a new `audit` namespace or as subcommands under `util:audit`.

### Pattern 1: File-Scanning Command (follows `codebase analyze`)

The existing `codebase analyze` command demonstrates the exact pattern needed:
1. Discover target files via glob/directory listing
2. Read each file
3. Apply extraction heuristics (regex patterns)
4. Score/classify extracted items
5. Output structured JSON with TTY formatting

The audit scanner follows this same flow:
1. Discover all `workflows/*.md` and agent `.md` files
2. Read each file
3. Extract decision points using indicator patterns
4. Score each candidate against rubric
5. Output catalog with token estimates

### Pattern 2: Rubric as Lookup Table (follows `orchestration.js` complexity classifier)

`orchestration.js` already implements a scoring pattern: `classifyTaskComplexity()` takes a task object, applies multiple scoring factors with numeric weights, clamps to a range, and returns `{score, label, factors}`. The rubric scorer follows this exact pattern:

```javascript
function scoreCandidate(candidate) {
  const criteria = {
    // 3 Critical (must ALL pass)
    finite_inputs: assessFiniteInputs(candidate),      // boolean
    deterministic_output: assessDeterministic(candidate), // boolean
    no_nlu_needed: assessNoNLU(candidate),              // boolean
    // 4 Preferred (nice to have)
    high_frequency: assessFrequency(candidate),          // boolean
    low_complexity: assessComplexity(candidate),         // boolean
    existing_pattern: assessExistingPattern(candidate),  // boolean
    low_blast_radius: assessBlastRadius(candidate),      // boolean
  };
  const passes = criteria.finite_inputs && criteria.deterministic_output && criteria.no_nlu_needed;
  const preferredScore = [criteria.high_frequency, criteria.low_complexity, criteria.existing_pattern, criteria.low_blast_radius].filter(Boolean).length;
  return { passes, criteria, preferred_score: preferredScore, total_score: passes ? 3 + preferredScore : 0 };
}
```

### Pattern 3: Token Estimation Model (static, no runtime)

Since no runtime telemetry exists yet (Phase 112 adds FLOW-03), token estimates must be static. Base the model on:
- **Decision pattern complexity**: simple lookup (50-100 tokens saved) vs multi-step reasoning (200-500 tokens saved) vs conditional chain (300-800 tokens saved)
- **Invocation frequency**: estimated from workflow structure (how many times per session the workflow runs × how many times the decision point fires)
- **Context overhead**: each LLM decision requires the decision context to be in the prompt (~100-300 tokens per decision depending on surrounding instructions)

This aligns with STATE.md's existing estimate: "~39K tokens/session savings from P1 offloading opportunities."

### Anti-Patterns to Avoid

1. **Don't scan source `.js` files for decisions** — The LLM-offloadable decisions live in workflow `.md` files and agent definitions, not in code. The source code already IS the programmatic implementation.

2. **Don't conflate "the LLM reads this" with "the LLM decides this"** — Many workflow instructions are procedural (read file X, write file Y, commit). Only extract actual decision points where the LLM is choosing between alternatives or classifying input.

3. **Don't try to parse natural language instructions as code** — The scanner uses pattern indicators (conditionals, option lists, routing tables) not full NL understanding.

4. **Don't estimate tokens with false precision** — Order-of-magnitude estimates (50/200/500 tokens) are more honest and useful than claiming "exactly 347 tokens saved."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File discovery | Custom file finder | `readdirSync` + glob on `workflows/` and agent paths | Already used in `codebase analyze` |
| Frontmatter parsing | Custom YAML parser | `src/lib/frontmatter.js` `extractFrontmatter()` | Proven in 50+ call sites |
| JSON output formatting | Custom formatter | `src/lib/output.js` `output()` | Handles TTY vs piped modes |
| Table rendering | Custom table builder | `src/lib/format.js` `formatTable()` | Rich TTY tables already working |
| Command routing | Custom dispatch | Register in `src/router.js` namespace switch | All 100+ commands use this pattern |

## Common Pitfalls

### Pitfall 1: Over-Classifying Everything as "Offloadable"
**What goes wrong:** Scanner marks every conditional in a workflow as a decision point, producing hundreds of false-positive candidates that dilute the catalog's value.
**Why it happens:** Workflow files are full of procedural conditionals ("if file exists → read it") that aren't LLM decisions — they're instruction steps.
**How to avoid:** Apply a clear filter: a decision point is only where the LLM must CHOOSE between alternatives or CLASSIFY input. Procedural conditionals (file exists, command succeeds) are not decisions.
**Warning signs:** Catalog has 100+ candidates where most are "check if X exists" patterns.

### Pitfall 2: Rubric Criteria Too Vague
**What goes wrong:** Criteria like "deterministic output" are interpreted differently for each candidate, making the rubric inconsistent.
**Why it happens:** Without concrete examples of what passes/fails each criterion, the scorer applies subjective judgment.
**How to avoid:** Define each criterion with 2-3 clear pass/fail examples in the rubric definition. For example, "deterministic output" PASSES for "route command to workflow" (same command → same workflow), FAILS for "assess code quality" (same code → different assessments based on context).
**Warning signs:** Same type of decision scores differently in different workflows.

### Pitfall 3: Token Estimates Without a Model
**What goes wrong:** Token savings numbers are invented ("save 200 tokens") without a systematic model, making the estimates useless for prioritization.
**Why it happens:** No runtime telemetry exists, so the temptation is to guess.
**How to avoid:** Build explicit token estimation categories (simple lookup: 50-100, conditional chain: 200-500, multi-step reasoning: 300-800) and assign each candidate to a category. Document the model.
**Warning signs:** All candidates have the same savings estimate, or estimates vary wildly for similar decisions.

### Pitfall 4: Scanning Only Workflows, Missing Agents
**What goes wrong:** Agent `.md` files (planner, executor, verifier, etc.) contain decision instructions that never appear in workflow files.
**Why it happens:** Workflow files are the obvious scan target, but agents contain their own decision logic.
**How to avoid:** Scan both `workflows/*.md` AND agent definition files. The agent system prompts include decision patterns (deviation classification, severity inference, scope creep detection).
**Warning signs:** Catalog only references workflow files.

### Pitfall 5: Ignoring "Keep in LLM" Candidates
**What goes wrong:** Candidates that fail the rubric are silently dropped, leaving the user wondering if they were ever considered.
**Why it happens:** Success criteria SC-4 requires explicit "keep in LLM" marking, but it's easy to forget when focusing on the positive catalog.
**How to avoid:** The scanner should emit ALL identified decision points, with rubric scores. The output partitions them into "offloadable" and "keep in LLM" with rationale per SC-4.
**Warning signs:** User can't see why certain obvious decisions were excluded.

## Code Examples

### Decision Point Extraction Patterns

Based on analysis of all 44 workflow files, these are the concrete patterns that indicate LLM decision points:

```javascript
// Pattern indicators in workflow markdown
const DECISION_INDICATORS = [
  // Explicit routing/choice tables
  /\|\s*Condition\s*\|\s*(?:Meaning|Action|Route)\s*\|/i,     // Routing tables
  /\|\s*(?:Route|Pattern)\s+[A-F]\b/i,                        // Named routes
  
  // Conditional logic requiring LLM judgment
  /\bIf\s+.*(?:ask|offer|present|suggest|route|classify)\b/i, // Decision conditionals
  /\b(?:choose|decide|determine|select|pick)\b/i,             // Decision verbs
  
  // Option presentation (LLM picks for user)
  /options?:\s*\n\s*-/i,                                       // YAML-style options
  /(?:offer|present).*(?:options?|choice)/i,                   // Option offering
  
  // Classification/inference
  /\b(?:infer|classify|categorize|severity|priority)\b/i,      // Classification language
  /\b(?:heuristic|rule|criteria)\b.*\b(?:apply|check|use)\b/i, // Rule application
];
```

### Rubric Criteria Definitions

```javascript
const CRITICAL_CRITERIA = {
  finite_inputs: {
    description: 'Decision has a bounded set of possible inputs',
    pass_examples: ['command name → workflow', 'file extension → language', 'error code → severity'],
    fail_examples: ['user description → requirements', 'code diff → review feedback'],
    test: (candidate) => candidate.input_type === 'enum' || candidate.input_type === 'pattern'
  },
  deterministic_output: {
    description: 'Same inputs always produce same output',
    pass_examples: ['phase complete + more phases → suggest next phase', 'plan has checkpoints → Pattern B'],
    fail_examples: ['code quality assessment', 'scope creep judgment'],
    test: (candidate) => candidate.output_variability === 'none'
  },
  no_nlu_needed: {
    description: 'No natural language understanding required to make the decision',
    pass_examples: ['count summaries vs plans', 'check file existence', 'parse frontmatter field'],
    fail_examples: ['detect scope creep', 'infer severity from user description', 'judge code quality'],
    test: (candidate) => !candidate.requires_language_understanding
  }
};

const PREFERRED_CRITERIA = {
  high_frequency: { description: 'Decision executes frequently (every plan, every session)' },
  low_complexity: { description: 'Implementation is simple (lookup table, <20 lines)' },
  existing_pattern: { description: 'Similar logic already exists in codebase' },
  low_blast_radius: { description: 'Changing this decision affects few downstream consumers' }
};
```

### Token Estimation Categories

```javascript
const TOKEN_CATEGORIES = {
  simple_lookup: {
    label: 'Simple Lookup',
    range: [50, 100],
    midpoint: 75,
    examples: ['command → workflow routing', 'file extension → language type', 'error code → message']
  },
  conditional_chain: {
    label: 'Conditional Chain',
    range: [200, 500],
    midpoint: 350,
    examples: ['next action routing in progress', 'execution pattern selection (A/B/C)', 'plan status determination']
  },
  multi_step_reasoning: {
    label: 'Multi-Step Reasoning',
    range: [300, 800],
    midpoint: 550,
    examples: ['deviation classification (4 rules)', 'severity inference from text', 'checkpoint type selection']
  },
  context_overhead: {
    label: 'Context Overhead',
    range: [100, 300],
    midpoint: 200,
    description: 'Instructions for the decision that must be in prompt whether or not decision fires'
  }
};
```

## Identified Decision Categories (From Codebase Analysis)

Based on reading all 44 workflows, here are the concrete decision categories found with examples:

### Category 1: Workflow Routing / Next-Step Selection
**Frequency:** Every workflow invocation
**Examples found:**
- `progress.md` Route A/B/C/D/E/F (6 routes based on plan/summary/milestone counts) — lines 104-330
- `execute-plan.md` Pattern A/B/C selection (based on checkpoint presence) — lines 44-57
- `resume-project.md` Next action routing (8 branches based on state) — lines 116-148
- `verify-work.md` Post-completion routing (issues → diagnose, no issues → suggest next)
**Rubric prediction:** PASS critical (finite inputs: plan/summary counts; deterministic: same counts → same route; no NLU). HIGH priority.

### Category 2: Model/Agent Selection
**Frequency:** Every agent spawn
**Examples found:**
- `plan-phase.md` Model resolution for researcher, planner, checker — lines 17, 51, 111
- `execute-plan.md` executor_model selection
- `quick.md` 4 model resolutions (planner, executor, checker, verifier)
- `orchestration.js` `classifyTaskComplexity()` → `recommended_model` already does this in code
**Rubric prediction:** PASS critical (finite inputs: config + complexity; deterministic). Already partially offloaded — orchestration.js proves it works.

### Category 3: Execution Mode / Plan Classification
**Frequency:** Every plan execution
**Examples found:**
- `execute-plan.md` "parse_segments" step: count checkpoints → select Pattern A/B/C
- `execute-plan.md` "deviation_rules" table: classify deviation → pick rule 1-4
- `execute-plan.md` "auto_test_after_edit": decide when to run tests
- `quick.md` `--full` mode routing (5+ branch points)
**Rubric prediction:** PASS critical (finite inputs: checkpoint count, deviation type; deterministic). MEDIUM priority — some fire per-task, not per-session.

### Category 4: State Assessment / Progress Determination
**Frequency:** Multiple times per session
**Examples found:**
- `progress.md` "current_phase is complete" determination (summaries == plans && plans > 0)
- `complete-milestone.md` readiness check (all phases complete, requirements checked off)
- `resume-project.md` incomplete work detection (plans without summaries, interrupted agents)
**Rubric prediction:** PASS critical (finite inputs: file counts; deterministic). Already partially offloaded — `plan:roadmap analyze` computes this.

### Category 5: Severity / Priority Classification
**Frequency:** Per finding/issue
**Examples found:**
- `verify-work.md` severity inference from user text ("crash" → blocker, "doesn't work" → major) — lines 131-139
- `execute-plan.md` deviation classification (4 rules based on error type) — lines 99-110
- `src/lib/review/severity.js` — Already offloaded! Pattern-based classification in code.
**Rubric prediction:** MIXED. Simple keyword → severity PASSES. Complex "assess code quality" FAILS (requires NLU).

### Category 6: File/Path Resolution
**Frequency:** Every workflow invocation
**Examples found:**
- All workflows: resolve phase directory, plan paths, summary paths from phase number
- `discuss-phase.md` check existing CONTEXT.md, decide whether to create/update
- `plan-phase.md` RESEARCH.md existence check → skip/use existing
**Rubric prediction:** PASS critical. Already MOSTLY offloaded — `command-enricher.js` pre-computes paths. Remaining gaps are workflow-specific path logic.

### Category 7: Template / Format Selection
**Frequency:** Per document creation
**Examples found:**
- `execute-plan.md` commit message type selection (feat/fix/test/refactor/perf/docs/style/chore)
- `complete-milestone.md` milestone naming heuristic (major/minor versioning)
- `discuss-phase.md` gray area generation from phase domain type
**Rubric prediction:** MIXED. Commit type from file changes PASSES. Gray area generation from domain FAILS (requires understanding).

### Candidates That FAIL the Rubric (Keep in LLM)

Based on analysis, these decision types should be explicitly marked "keep in LLM":

1. **Scope creep detection** (`discuss-phase.md`) — Requires understanding whether a feature extends existing scope vs adds new capability. Requires NLU.
2. **Gray area identification** (`discuss-phase.md`) — Requires domain understanding to generate relevant questions. Not deterministic.
3. **Code quality assessment** (`execute-plan.md` post_execution_review) — Requires judgment about code conventions, style, intent. Requires NLU.
4. **Task decomposition** (planner agent) — Requires understanding problem space to create tasks. Not deterministic.
5. **Gap diagnosis** (`verify-work.md` diagnose_issues) — Root cause analysis from test failures. Requires reasoning.
6. **Research synthesis** (researcher agents) — Requires evaluating and combining information. Not deterministic.
7. **Questioning / interview** (`new-project.md`, `discuss-phase.md`) — Requires understanding user responses and generating follow-ups. Requires NLU.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All workflow routing via LLM reasoning | `command-enricher.js` pre-computes some paths | v9.0 (2026-03-09) | Eliminated init subprocess calls |
| LLM classifies task complexity | `orchestration.js` `classifyTaskComplexity()` | v10.0 (2026-03-11) | Proves pattern works for this codebase |
| LLM determines severity from patterns | `src/lib/review/severity.js` regex-based classification | v10.0 (2026-03-11) | Small-scale precedent for the rubric pattern |
| All model selection via LLM | `util:resolve-model` command with config lookup | v9.3 (2026-03-10) | Already offloaded |

## Open Questions

1. **Where to register the command?** — New `audit` namespace (e.g., `audit:scan`, `audit:catalog`) or under existing `util` namespace (e.g., `util:audit scan`)? New namespace is cleaner and aligns with AUDIT-01 requirement naming.

2. **Catalog output format?** — JSON artifact in `.planning/` (e.g., `.planning/audit-catalog.json`) vs inline CLI output? Recommend both: JSON artifact for Phase 111 consumption + TTY formatted summary for user.

3. **How to handle agent definition files?** — Agent `.md` files live in the host editor config dir, not in `$PWD`. The scanner needs the `$BGSD_HOME` path to find them. The `command-enricher.js` already resolves this via environment.

4. **Invocation frequency estimation** — How to estimate how often each decision fires per session without runtime data? Recommend a simple model: categorize workflows by type (every-session: progress/resume/execute, per-phase: plan/research/discuss, rare: new-project/milestone) and multiply by expected decisions per invocation.

## Sources

### Primary (HIGH confidence)
- **Direct codebase analysis**: Read all 44 workflow files, 6 key source modules, router, orchestration, plugin hooks
- `src/lib/orchestration.js` — Existing complexity classifier demonstrates rubric pattern
- `src/lib/review/severity.js` — Existing severity classifier demonstrates regex-based decision offloading
- `src/plugin/command-enricher.js` — Existing path pre-computation demonstrates context injection pattern

### Secondary (MEDIUM confidence)
- `STATE.md` — "~39K tokens/session savings from P1 offloading opportunities" (pre-existing estimate, methodology unknown)
- Token estimation model — Based on typical GPT/Claude token counts for structured decision instructions; validated against known workflow sizes

### Tertiary (LOW confidence)
- Invocation frequency estimates — Based on typical bGSD session patterns; no runtime data to validate

## Metadata

**Confidence breakdown:**
- Scanner architecture: HIGH (follows proven codebase patterns)
- Rubric design: HIGH (criteria are well-defined from CONTEXT.md and success criteria)
- Token estimation: MEDIUM (static model without runtime validation)
- Candidate identification: HIGH (systematic workflow analysis, concrete examples)
- Invocation frequency: LOW (no runtime data)

**Research date:** 2026-03-13
**Valid until:** Phase 110 completion — catalog becomes the authoritative source
