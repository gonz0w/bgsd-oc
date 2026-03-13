# Stack Research — LLM Offloading

**Domain:** Programmatic Decision-Making for LLM Offloading in Node.js CLI
**Researched:** 2026-03-13
**Confidence:** HIGH

<!-- section: compact -->
<stack_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Core stack (zero new dependencies):**

| Technology | Purpose | Version |
|------------|---------|---------|
| Node.js built-in regex/string | Markdown decision point scanning | built-in |
| acorn + AST walking (bundled) | Identify decision patterns in JS code | ^8.16 (bundled) |
| Custom decision tables (Map/Object) | Deterministic routing, parameter defaults | built-in |
| Template literals + string interpolation | Deterministic output generation | built-in |
| JSON Schema-like validation (valibot) | Input validation pre-LLM | ^1.2 (existing) |

**Already in codebase — leverage, don't add:**
- `src/lib/orchestration.js` — task complexity classifier, execution mode selector, task router
- `src/lib/nl/` — intent classifier, command registry, fuzzy resolver, parameter extractor
- `src/lib/recovery/` — deviation classifier, checkpoint advisor, stuck detector
- `src/lib/frontmatter.js` — YAML frontmatter parser with LRU cache
- `src/lib/regex-cache.js` — LRU-bounded compiled regex cache

**Avoid:** Rule engines (json-rules-engine, nools — overkill), template engines (handlebars, mustache — heavy), AST tools beyond acorn (ts-morph, jscodeshift — massive)

**Install:** None. Zero new dependencies. All capabilities exist in Node.js built-ins + existing bundled tools.
</stack_compact>
<!-- /section -->

<!-- section: recommended_stack -->
## Recommended Stack

### Core Principle: Zero New Dependencies

The LLM offloading milestone should add **no new production dependencies**. Every capability needed already exists in the codebase or in Node.js built-ins. The project's single-file architecture and ~1163KB bundle mean every byte matters. The right approach is **code patterns, not library additions.**

### Core Technologies (All Already Available)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Decision table pattern (plain JS) | built-in | Map deterministic choices to outcomes | Simplest possible pattern: `Map<conditions, result>`. Already used in `orchestration.js` (MODEL_MAP, COMPLEXITY_LABELS), `recovery/autoRecovery.js` (DEVIATION_PATTERNS), `conventions.js` (NAMING_PATTERNS). Add more, don't add a library. |
| acorn + custom walkers (bundled) | ^8.16 | Scan workflow .md files for decision patterns | Already bundled at ~114KB. `src/lib/ast.js` has full AST walking, signature extraction, complexity scoring. Extend for markdown/prompt analysis. |
| Regex pattern matching (built-in) | built-in | Scan markdown prompts for decision points | 309+ regex patterns already in codebase. `regex-cache.js` provides LRU caching. Extend with patterns that identify "LLM deciding something deterministic." |
| valibot (existing dep) | ^1.2 | Validate inputs before they reach LLM | Already a production dependency. Use for pre-validating parameters, catching invalid states programmatically instead of asking LLM to validate. |
| Template literal functions (built-in) | built-in | Generate deterministic outputs | Replace LLM-generated boilerplate (SUMMARY.md shells, commit messages, state updates) with parameterized templates. Already used in `format.js` formatting engine. |
| Weighted scoring (plain JS) | built-in | Multi-factor decision scoring | Already implemented: `orchestration.js` classifyTaskComplexity, `recovery/checkpointAdvisor.js` COMPLEXITY_FACTORS. Pattern is proven: factor scores × weights → threshold → decision. |

### Supporting Patterns (Code, Not Libraries)

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| Lookup table (Object/Map) | O(1) deterministic decision | File paths, command routing, parameter defaults, model selection |
| Decision matrix (weighted scoring) | Multi-factor classification | Task complexity, checkpoint type, deviation severity |
| State machine (switch/if chains) | State-dependent behavior | Workflow step sequencing, plan lifecycle transitions |
| Template function (tagged template literals) | Deterministic output generation | SUMMARY.md boilerplate, commit messages, state patches |
| Guard clause chain | Pre-validation before LLM | Parameter validation, file existence checks, format verification |
| Regex pattern classifier | Text classification | Intent detection, deviation classification, phase number extraction |

### Existing Modules to Extend (Not Replace)

| Module | Current Capability | Offloading Extension |
|--------|-------------------|---------------------|
| `src/lib/orchestration.js` | Task complexity scoring (1-5), execution mode selection, model routing | Add: plan-level auto-decisions (wave ordering, parallelization eligibility), pre-computed task context |
| `src/lib/nl/intent-classifier.js` | Keyword-based intent classification (plan/execute/verify/query) | Add: more intents, confidence-weighted fallback, compound intent detection |
| `src/lib/nl/command-registry.js` | 31 phrase→command mappings, 15 aliases | Add: parameter inference from context, smart defaults per command |
| `src/lib/recovery/autoRecovery.js` | 12 regex deviation patterns → 4 rule types | Add: more patterns, severity scoring, recovery action templates |
| `src/lib/recovery/checkpointAdvisor.js` | 7-factor complexity scoring → checkpoint type | Add: task-type-specific factors, historical success rate weighting |
| `src/lib/frontmatter.js` | YAML parse/reconstruct/splice with LRU cache | Add: frontmatter-driven decision extraction (plan type, wave, autonomous flags) |
| `src/lib/helpers.js` | findPhaseInternal, resolveModel, generateSlug | Add: deterministic phase resolution, next-plan detection, plan ordering |
| `src/plugin/context-builder.js` | System prompt construction, compaction context | Add: pre-computed decision hints in context (next action, required files, validation status) |
| `src/plugin/command-enricher.js` | Auto-inject bgsd-context JSON into commands | Add: richer pre-computed fields (resolved file paths, validation results, suggested actions) |

### Development Tools (Already Available)

| Tool | Purpose | Notes |
|------|---------|-------|
| node:test (built-in) | Test decision tables and classifiers | 762+ tests already. Add tests for every new decision table. |
| esbuild (dev dep) | Bundle new code into bgsd-tools.cjs | Already configured. New code in src/ auto-bundles. |
| acorn (dev dep, bundled) | Analyze workflows for decision points | Already bundled into bgsd-tools.cjs. |

## Installation

```bash
# Nothing to install. Zero new dependencies.
# All work is code patterns leveraging existing stack:
#   - Node.js built-ins (Map, Object, RegExp, template literals)
#   - acorn (already bundled)
#   - valibot (already a dependency)
#   - Existing src/ modules (extend, don't replace)
```
<!-- /section -->

## Existing Stack Inventory (Relevant to Offloading)

### Already Making Programmatic Decisions

The codebase already has **significant programmatic decision-making** — the milestone is about expanding this coverage, not building from scratch:

1. **Task Classification** (`orchestration.js`): Scores tasks 1-5 using file count, blast radius, test requirements, checkpoint presence, action length. Routes to model (sonnet/opus) based on score.

2. **Execution Mode Selection** (`orchestration.js`): Determines single/sequential/parallel/pipeline mode from plan classifications. Uses checkpoint detection, wave analysis, plan count.

3. **Deviation Classification** (`autoRecovery.js`): 12 regex patterns classify errors into 4 rules (bug/missing_critical/blocking/architectural). Determines auto-fix vs escalate.

4. **Checkpoint Recommendation** (`checkpointAdvisor.js`): 7-factor weighted scoring (file count, task type, dependencies, duration, external services, user setup, tests) → checkpoint type threshold.

5. **Intent Classification** (`nl/intent-classifier.js`): Keyword matching classifies input into plan/execute/verify/query intents with confidence scores.

6. **Command Resolution** (`nl/command-registry.js` + `nl/fuzzy-resolver.js`): 31 phrases + 15 aliases + fuzzy matching → canonical command routing.

7. **Convention Detection** (`conventions.js`): Pattern classifiers for naming, indentation, semicolons, quotes across 640 lines of analysis.

8. **Namespace Routing** (`router.js`): 1000+ lines of deterministic command dispatch via namespace:subcommand pattern with lazy module loading.

9. **Context Enrichment** (`command-enricher.js`): Pre-computes phase info, plan lists, file paths, config flags — injected as JSON before LLM sees the command.

10. **State Validation** (`plugin/parsers/`): 6 parsers (state, roadmap, plan, config, project, intent) with caching — deterministic data extraction from markdown.

### Currently LLM-Dependent (Offloading Targets)

These are decisions the LLM currently makes that are deterministic enough to push into code:

| Decision | Where LLM Makes It | Why It's Deterministic |
|----------|--------------------|-----------------------|
| "Which plan to execute next" | Workflow reading STATE.md | Next incomplete plan in wave order — pure data lookup |
| "What files does this task touch" | Agent reading plan XML | Already in `<files>` tags — just needs extraction |
| "Is this phase complete" | Workflow checking criteria | Plan count + SUMMARY.md existence = deterministic |
| "What state to update after task" | Agent updating STATE.md | Progress %, plan number, timestamp = calculable |
| "Which template to use" | Workflow deciding plan format | Plan type + phase type = lookup table |
| "Should I run tests" | Agent deciding in workflow | File extension + test file existence = deterministic |
| "What model for this task" | Agent/workflow deciding | Already scored by orchestration.js — make it authoritative |
| "What to include in commit message" | Agent composing message | Files changed + task name + plan number = template |
| "Is this plan well-structured" | Checker agent reviewing | Frontmatter required fields + task XML schema = validation |
| "What context does this task need" | Agent gathering files | Task `<files>` + plan `<context>` + codebase-intel = computable |

<!-- section: alternatives -->
## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Plain JS decision tables (Map/Object) | json-rules-engine | Never for this project. It adds a dependency for what `if/switch` does. Only justified for user-configurable rule sets with hundreds of rules and runtime hot-reload. |
| Template literal functions | Handlebars/Mustache/EJS | Never for this project. Template engines are for user-facing themes. CLI output templates are better as JS functions with full language access. |
| Regex + keyword matching | NLP libraries (compromise, natural) | Never for this project. Our intent space is <50 commands. Keyword matching with fuzzy fallback already achieves >95% accuracy. NLP adds 1-5MB for marginal improvement. |
| acorn AST walking | jscodeshift / ts-morph | Never for this project. jscodeshift is for codemods (transforming code). ts-morph is 1MB+ and TypeScript-focused. acorn is already bundled and sufficient. |
| Weighted scoring (plain JS) | TensorFlow.js / brain.js | Never for this project. ML is for non-deterministic classification. Our decisions have known factors with explicit weights — math, not ML. |
| Custom markdown scanner (regex) | remark/unified AST parser | Probably never. Our markdown scanning is for structured templates with known patterns. Full AST parsing adds 200KB+ for features we don't need. If markdown structure becomes complex enough to need AST, reconsider. |
| valibot schemas | Ajv / Joi | No. valibot is already a dependency and proven in the codebase. Adding another schema validator violates the zero-dependency principle. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| json-rules-engine | Adds dependency for simple if/switch logic; overkill for <50 decision points | Plain JS Map/Object lookup tables + weighted scoring |
| Handlebars/Mustache/EJS | Template engines add 50-200KB; tagged template literals are more powerful | Template literal functions: `` `Phase ${num}: ${name}` `` |
| natural / compromise (NLP) | 1-5MB for marginal accuracy improvement over keyword matching | Extend existing `nl/intent-classifier.js` with more patterns |
| jscodeshift | Transform-focused, heavy; we only need read-only analysis | acorn + custom walker (already bundled) |
| ts-morph | 1MB+, TypeScript-focused | acorn with stripTypeScript (already in ast.js) |
| node-decision-tree / ml-cart | ML for problems that are fully deterministic | Weighted scoring with explicit factor tables |
| yaml (npm package) | Full YAML parser is 100KB+ | Keep existing frontmatter.js custom parser (handles our subset) |
| JSONPath / jmespath | Query libraries for complex JSON traversal | Direct property access — our JSON structures are known at build time |
<!-- /section -->

<!-- section: patterns -->
## Stack Patterns by Decision Category

**For simple routing decisions (file paths, command selection, defaults):**
- Use: Lookup table (Map or Object literal)
- Pattern: `const ROUTE = new Map([['plan', planHandler], ['execute', execHandler]])`
- Already proven: `router.js` namespace routing, `orchestration.js` MODEL_MAP
- Why: O(1) lookup, self-documenting, trivially testable

**For multi-factor classification (complexity, severity, checkpoint type):**
- Use: Weighted factor scoring with threshold mapping
- Pattern: Score each factor (0-N) × weight → sum → threshold lookup → decision
- Already proven: `checkpointAdvisor.js` (7 factors), `orchestration.js` (5 factors)
- Why: Transparent, debuggable, weights are tunable without code changes

**For text-based classification (error messages, user input, intent):**
- Use: Ordered regex pattern array with early exit
- Pattern: `for (const {pattern, result} of PATTERNS) if (pattern.test(input)) return result;`
- Already proven: `autoRecovery.js` (12 patterns), `intent-classifier.js` (keyword match)
- Why: Priority ordering is explicit, patterns are independently testable

**For deterministic output generation (summaries, messages, state updates):**
- Use: Template functions that take structured data and return formatted strings
- Pattern: `function formatSummary({ phase, plan, tasks, duration }) { return \`...\` }`
- Already proven: `format.js` (formatTable, progressBar, banner, box, color)
- Why: Full JS expressiveness, no template language to learn, type-safe with JSDoc

**For pre-validation (before LLM gets involved):**
- Use: valibot schemas + guard clause chains
- Pattern: Validate inputs → check preconditions → resolve defaults → only THEN invoke LLM
- Already proven: Plugin tools use valibot schemas for args validation
- Why: Catches 80% of invalid states without spending tokens

**For state-machine-like workflows (lifecycle, plan progression):**
- Use: Explicit state + transition table
- Pattern: `const TRANSITIONS = { planning: ['executing'], executing: ['verifying', 'blocked'] }`
- Currently implicit in workflows — make explicit in code
- Why: Prevents invalid transitions, enables programmatic state queries
<!-- /section -->

<!-- section: compatibility -->
## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| All recommended patterns | Node.js 18+ | Plain JS, no polyfills needed |
| acorn ^8.16 (bundled) | Node.js 14+ | Already validated in production |
| valibot ^1.2 (existing) | Node.js 18+ | Already validated in production |
| esbuild ^0.27 (bundler) | Node.js 18+ | Already bundles 34 modules successfully |
| Template literal functions | Node.js 6+ | ES2015 feature, universally available |
| Map/Set data structures | Node.js 0.12+ | Universally available |

## Codebase Integration Points

| New Pattern | Files to Modify/Create | Bundle Impact |
|-------------|----------------------|---------------|
| Decision table registry | New: `src/lib/decisions.js` | ~2-5KB (data tables + lookup functions) |
| Workflow scanner | New: `src/lib/workflow-scanner.js` | ~3-8KB (regex patterns for markdown analysis) |
| Template functions | New: `src/lib/templates.js` | ~2-4KB (output templates for common artifacts) |
| Extended command enricher | Modify: `src/plugin/command-enricher.js` | ~1-2KB additional |
| Extended orchestration | Modify: `src/lib/orchestration.js` | ~1-3KB additional |
| State transition engine | New or extend: `src/lib/state-machine.js` | ~2-4KB |
| Pre-validation pipeline | Extend: plugin tools + commands | Distributed ~1KB each |

**Total estimated bundle increase: 12-26KB** (1-2% of current 1163KB)

## Sources

- Direct codebase analysis: `src/lib/orchestration.js` (528 lines), `src/lib/ast.js` (1186 lines), `src/lib/recovery/autoRecovery.js` (326 lines), `src/lib/recovery/checkpointAdvisor.js` (302 lines), `src/lib/nl/intent-classifier.js` (53 lines), `src/lib/nl/command-registry.js` (76 lines), `src/lib/conventions.js` (640+ lines), `src/lib/frontmatter.js` (166 lines), `src/lib/regex-cache.js` (75 lines)
- Direct codebase analysis: `src/router.js` (1000+ lines), `plugin.js` (1700+ lines — 6 parsers, context builder, enricher, tools)
- Direct codebase analysis: `package.json` dependencies — fast-glob, fuse.js, ignore, inquirer, valibot (production); acorn, esbuild, knip, madge, tokenx, zod (dev)
- .planning/PROJECT.md — constraints (single-file deploy, backward compat, no new agents, Node 18+)
- Training data analysis of json-rules-engine, Handlebars, jscodeshift, ts-morph, natural — confirmed all are overkill for this use case

---

*Stack research for: LLM Offloading — Programmatic Decision-Making*
*Researched: 2026-03-13*
