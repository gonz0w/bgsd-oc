# Stack Research — Question Design Systems for AI Agents

**Domain:** Question design systems for AI agent workflows — question taxonomy, structured option generation, and choice architecture patterns.
**Researched:** 2026-03-19
**Confidence:** MEDIUM-HIGH

<!-- section: compact -->
<stack_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Core approach:** Data-driven question templates + taxonomy classification + option generation rules. No external libraries — implement as structured data in `bin/bgsd-tools.cjs`.

**Pattern sources:**
| Pattern | Source | Relevance |
|---------|--------|-----------|
| PromptTree (branching prompts) | LangChain GitHub #9932 | Decision-tree questioning architecture |
| Bloom's Taxonomy (cognitive levels) | Educational psychology | Question type classification for MCQ generation |
| REQUESTA framework | arXiv:2602.03704 | Multi-agent MCQ generation with cognitive targeting |
| Socratic questioning loops | bGSD discuss-phase.md (existing) | Why-follow-up, concrete options |
| Choice architecture | UX/HCI literature | Single vs multi-select decision design |

**No libraries exist** in this space. Everything is prompting discipline + data structure.

**Key insight:** Option generation is the gap. Current workflows hand-craft options. Better: pre-authored option sets per discussion context OR structured generation rules (min options, diversity constraint, option-type taxonomy).

**Avoid:** LangChain/LangGraph (wrong abstraction — control flow, not question design), Vector RAG for option retrieval (overkill), Prompt optimization frameworks (DSPy etc — not applicable to CLI data-driven approach)
</stack_compact>
<!-- /section -->

<!-- section: recommended_stack -->
## Recommended Stack

### Core Technologies

**No external dependencies.** All patterns implemented as structured data and prompting rules within the existing `bin/bgsd-tools.cjs` single-file architecture.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Structured question templates | (data, no lib) | Pre-authored option sets per discussion context | Zero dependency, version-controllable, matches existing decision function pattern |
| Question taxonomy enum | (data, no lib) | Classify question types: binary, multi-choice, ranking, open | Enables consistent handling and tooling |
| Option generation rules | (data + prompting) | Constraints for runtime option generation: min/max/diversity | Structured generation without external library |
| Selection mode guide | (data, no lib) | Single-select vs multi-select decision rules | Improves user experience with clear expectations |

### Supporting Patterns

| Pattern | Source | Purpose |
|---------|--------|---------|
| PromptTree decision branching | LangChain #9932 (not shipped — reference only) | Architecture for hierarchical question flows |
| Bloom's Taxonomy (revised) | Educational psychology (Anderson & Krathwohl, 2001) | Cognitive level classification for question stems |
| Socratic questioning | bGSD discuss-phase.md (existing) | Why-follow-up, concrete option framing |
| Gray area identification | bGSD discuss-phase.md (existing) | Domain-specific question generation |
| Stress-test challenging | bGSD discuss-phase.md (existing) | Option quality validation |

### Implementation Location

All question design data lives in `src/lib/decisions.js` (or new `src/lib/questionDesign.js`) following the existing DECISION_REGISTRY pattern — structured data, no new dependencies.

## Taxonomy Classification

```javascript
// Question types for agent workflows
const QuestionType = {
  // Single-select (pick one)
  BINARY: 'binary',           // yes/no, proceed/cancel
  SINGLE_CHOICE: 'single',    // pick A/B/C/D

  // Multi-select (pick N)
  MULTI_CHOICE: 'multi',      // pick N from list
  RANKING: 'ranking',         // order matters
  FILTERING: 'filtering',    // include/exclude per item

  // Open (free response)
  EXPLORATION: 'exploration', // discuss, tell me more
  CLARIFICATION: 'clarify',   // what do you mean by X
};
```

## Option Generation Rules

For **runtime option generation** (when pre-authored sets don't exist):

```
1. MIN_OPTIONS = 3, MAX_OPTIONS = 5
2. Option types across dimensions:
   - Certainty: confident answer vs nuanced/tBD
   - Scope: minimal vs comprehensive vs middle-ground
   - Approach: different strategies or philosophies
   - Priority: speed vs quality vs safety
3. Reject: "you decide", "either works", options that don't differentiate
4. Always include a concrete action label, never "Option A/B/C"
```

## Sources

- LangChain GitHub Issue #9932 — PromptTree pattern (branching prompts, not shipped)
- arXiv:2602.03704 — REQUESTA multi-agent MCQ generation framework
- arXiv:2412.00970 — Multi-Agent LLM Approach to AI Literacy MCQs
- onlineteaching.umich.edu — University of Michigan MCQ prompt design guidelines
- arunbaby.com — Agent prompt engineering: 5-component mega-prompt structure
- bGSD discuss-phase.md, new-milestone.md, settings.md — existing question patterns
<!-- /section -->

<!-- section: alternatives -->
## Alternatives Considered

### PromptTree (LangChain #9932)

| Aspect | PromptTree | Recommended Approach |
|--------|------------|---------------------|
| Abstraction | Class hierarchy (Python-oriented) | Data-driven templates (matches bGSD CJS) |
| Branch switching | Tool-calling LLM selects children | Workflow controls flow; question types classify prompts |
| State management | Per-branch state tracking | Existing SQLite + memory.js dual-store |
| Decision | Closed as "not planned" | Extract pattern, not code |

**Verdict:** Pattern is instructive but implementation is Python/LangChain-specific. Extract branching concept as data, not class hierarchy.

### DSPy / Automated Prompt Optimization

| Aspect | DSPy | Recommended Approach |
|--------|------|----------------------|
| Purpose | Automated prompt weight tuning | Question design system |
| Input | Signature + training data | Pre-authored option sets + generation rules |
| Output | Optimized prompt text | Structured taxonomy + runtime generation |

**Verdict:** Wrong abstraction. DSPy optimizes prompt wording. This project needs option set curation + taxonomy classification. No external library fits.

### LangGraph Branching

| Aspect | LangGraph edges | Recommended Approach |
|--------|----------------|----------------------|
| Purpose | Control flow routing | Question presentation |
| Trigger | LLM output → conditional edge | User selection → workflow continuation |
| Granularity | Graph node transitions | Per-question option sets |

**Verdict:** LangGraph branching is about agent orchestration, not question design. The conditional transition pattern is relevant conceptually but LangGraph itself is not.

### RAG / Vector Retrieval for Options

| Aspect | Vector RAG | Recommended Approach |
|--------|-----------|----------------------|
| Purpose | Semantic retrieval of similar options | Option generation for new questions |
| Overkill | Requires embedding service, vector DB | Pre-authored option sets are faster, deterministic |
| Maintenance | Embedding drift risk | Version-controlled templates are stable |

**Verdict:** Explicitly out of scope per PROJECT.md constraints. Pre-authored option sets are sufficient.

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| LangChain / LangGraph | Wrong abstraction (orchestration vs question design); 100+ deps | Data-driven templates |
| DSPy / prompt optimizers | Optimizes wording, not option sets | Structured option generation rules |
| Vector RAG | Overkill; requires external services | Pre-authored option sets in decisions.js |
| Generic "Option A/B/C" labels | Fails the concrete-options requirement | Action-oriented labels: "Research first" / "Skip research" |
| Open-ended without option guidance | The exact problem v15.0 solves | Taxonomy + generation rules |
<!-- /section -->

<!-- section: patterns -->
## Stack Patterns by Variant

**If the question is a binary decision (proceed/cancel, yes/no):**
- Use `BINARY` question type
- Present exactly 2 options with clear consequence description
- Example from bGSD: "Update it" / "View it" / "Skip" in discuss-phase check_existing

**If the question is multi-select from curated options (3-5 choices):**
- Use `MULTI_CHOICE` with `maxSelect: N` constraint
- Pre-author option sets per discussion context in `decisions.js`
- Example from bGSD: "Which areas do you want to discuss?" with gray-area-specific options

**If the question needs runtime option generation (no pre-authored set exists):**
- Apply option generation rules: MIN 3, MAX 5, diversity across certainty/scope/approach/priority dimensions
- Reject non-differentiating options
- Use concrete action labels, never "Option A/B/C"

**If the question is exploratory / Socratic (no predefined options):**
- Use `EXPLORATION` type — questions without preset options
- Apply Socratic follow-up pattern: "Why?" after each answer
- Never ask two questions in one

**If the question requires ordering/prioritization:**
- Use `RANKING` type — order matters
- Present as ordered list selection, not pairwise comparison
- Example: "Which order for these 4 areas?" (not "Is A > B?" × 6)

## Implementation Pattern

```javascript
// src/lib/questionDesign.js — question template structure
const QUESTION_TEMPLATES = {
  'discuss-phase:gray-areas': {
    type: 'MULTI_CHOICE',
    multiSelect: true,
    minOptions: 3,
    maxOptions: 4,
    headerMaxLen: 12,
    options: [], // populated per phase by analyze_phase
    generateFrom: 'gray_area_identification', // function to produce options
  },
  'discuss-phase:stress-test-revision': {
    type: 'BINARY',
    options: ['No changes — proceed', 'Revisit a decision'],
    concreteLabels: true,
  },
  'new-milestone:research-decision': {
    type: 'BINARY',
    options: ['Research first (Recommended)', 'Skip research'],
    concreteLabels: true,
  },
  'settings:model-profile': {
    type: 'SINGLE_CHOICE',
    options: ['fast', 'balanced', 'quality'], // populated from MODEL_PROFILES
  },
};
```
<!-- /section -->

<!-- section: compatibility -->
## Version Compatibility

All patterns are pure data + prompting — no version compatibility concerns.

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Node.js 22.5+ | Required | Already in use for node:sqlite |
| Existing DECISION_REGISTRY | Compatible | Follows same structured data pattern |

## Gap: Option Generation

The most significant gap identified: **there is no library or framework for AI-driven option generation**. All existing approaches use:

1. **Pre-authored options** — human-written option sets (used by bGSD, most production systems)
2. **LLM-with-constraints** — asking the LLM to generate options subject to structural rules (Bloom's MCQ generation research, this project)

Option generation at runtime is an open research problem. The pragmatic solution for bGSD v15.0 is a hybrid:

- **Phase 1:** Curate option sets for all existing discussion workflows (data-driven, no generation)
- **Phase 2:** Add `generateFrom` functions that produce options from phase context with diversity constraints
- **Phase 3 (future):** Structured prompting for LLM-driven option generation with validation rules

---
*Stack research for: Question design systems in AI agent workflows*
*Researched: 2026-03-19*
