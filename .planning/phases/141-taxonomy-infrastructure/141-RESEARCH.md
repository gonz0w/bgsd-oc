# Phase 141: Taxonomy & Infrastructure - Research

**Researched:** 2026-03-19
**Domain:** Question taxonomy, option generation, decision routing
**Confidence:** HIGH

## Summary

Phase 141 establishes the infrastructure for a question taxonomy system that will replace bare open-ended questions in bGSD workflows with taxonomy-driven multiple-choice options. The work involves: (1) defining a TAXONOMY enum with 7 question types in `prompts.js` (or a new `questions.js` module), (2) building a `questionTemplate(id, type, context)` function that centralizes option sets, (3) implementing option generation rules (MIN 3/MAX 5, diversity constraints, formatting parity, escape hatch), and (4) adding `resolveQuestionType` and `resolveOptionGeneration` decision functions to the DECISION_REGISTRY following the existing pure-function pattern.

The system uses a hybrid approach: pre-authored options for common questions, structured runtime generation for novel/edge cases. Templates provide OPTIONS ONLY — question text stays in workflows. The decision functions run at execution time to ensure fresh data. The architecture is entirely data + prompting with zero external dependencies.

**Primary recommendation:** Implement TAXONOMY enum first, then questionTemplate() function, then option generation rules, then DECISION_REGISTRY integration — in that order of dependency.

## User Constraints

From 141-CONTEXT.md (stress-tested decisions — highest confidence):

1. **7-type taxonomy** (BINARY, SINGLE_CHOICE, MULTI_CHOICE, RANKING, FILTERING, EXPLORATION, CLARIFICATION) — consolidate later if unused after 1-2 milestones
2. **Separate questions.js module** — clean separation from prompts.js which handles CLI prompts; templates contain OPTIONS ONLY
3. **Parameterized tone** — templates accept tone parameter (formal/casual)
4. **Hybrid option generation** — pre-authored for common questions, structured runtime with diversity constraints for edge cases
5. **Pre-authored sets designed from scratch** — not extracted from existing workflows
6. **Replace `<question>` tags** with questionTemplate() calls; graceful fallback if template missing
7. **Decision functions run at execution time** — not pre-computed at enrichment
8. **Function call (questionTemplate(id, context)) over CLI** — direct call is faster than subprocess

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >= 22.5 | Runtime | Project constraint |
| prompts.js | existing | CLI prompt functions (inquirer v8) | Already in codebase |
| decision-rules.js | existing | DECISION_REGISTRY pattern | Already in codebase |

### Architecture
| Component | Purpose | Pattern |
|-----------|---------|----------|
| TAXONOMY enum | 7 question types | Const object in questions.js |
| questionTemplate(id, type, context) | Template lookup + tone | Returns { question, options[] } |
| resolveQuestionType(workflow, step) | Pre-compute question type | DECISION_REGISTRY pure function |
| resolveOptionGeneration(questionType, context) | Pre-compute generation approach | DECISION_REGISTRY pure function |

### No New Dependencies
All work is pure JavaScript data structures. No external libraries needed.

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
  prompts.js          # EXISTING: CLI interactive prompts (inquirer v8)
  questions.js       # NEW: questionTemplate(), TAXONOMY enum, option sets
  decision-rules.js  # MODIFY: add resolveQuestionType, resolveOptionGeneration
```

### Pattern 1: TAXONOMY Enum
```javascript
const TAXONOMY = {
  BINARY: 'BINARY',           // yes/no, true/false
  SINGLE_CHOICE: 'SINGLE_CHOICE',   // pick one from 3-5
  MULTI_CHOICE: 'MULTI_CHOICE',     // pick all that apply
  RANKING: 'RANKING',         // order items
  FILTERING: 'FILTERING',     // narrow by criteria
  EXPLORATION: 'EXPLORATION', // discovery mode
  CLARIFICATION: 'CLARIFICATION',   // clarify ambiguous
};
```

### Pattern 2: questionTemplate Function
```javascript
function questionTemplate(id, type, context = {}) {
  // id: unique template identifier (e.g., 'discuss-phase-area-select')
  // type: TAXONOMY enum value
  // context: { tone: 'formal' | 'casual', ... }
  // Returns: { question: string, options: string[], escapeHatch: boolean }
  // Falls back to inline text if template missing (graceful fallback)
}
```

### Pattern 3: Option Generation Rules
```javascript
const OPTION_RULES = {
  MIN_OPTIONS: 3,
  MAX_OPTIONS: 5,
  DIVERSITY_DIMENSIONS: ['certainty', 'scope', 'approach', 'priority'],
  FORMATTING_PARITY: true,      // same length/grammar/detail
  ESCAPE_HATCH: 'Something else',
  ESCAPE_HATCH_POSITION: 'last',
};
```

### Pattern 4: DECISION_REGISTRY Entry
```javascript
{
  id: 'resolveQuestionType',
  name: 'Question Type Resolution',
  category: 'question-routing',  // NEW category
  description: 'Determines question taxonomy type for a workflow step',
  inputs: ['workflow_id', 'step_id'],
  outputs: ['TAXONOMY enum value'],
  confidence_range: ['HIGH'],
  resolve: resolveQuestionType,
},
{
  id: 'resolveOptionGeneration',
  name: 'Option Generation Strategy',
  category: 'question-routing',
  description: 'Determines pre-authored vs runtime generation',
  inputs: ['questionType', 'context'],
  outputs: ['pre-authored' | 'runtime'],
  confidence_range: ['HIGH'],
  resolve: resolveOptionGeneration,
}
```

### Anti-Patterns to Avoid
1. **Don't extract options from existing workflows** — design fresh; quality over convenience
2. **Don't put question text in templates** — templates provide OPTIONS ONLY; question text stays in workflow
3. **Don't pre-compute decisions at enrichment** — run at execution time for fresh data
4. **Don't hardcode option count** — use MIN/MAX constants; 3-5 range is the rule

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Option diversity algorithm | Custom diversity scoring | Diversity constraints across dimensions | Standard approach, deterministic |
| Tone parameter handling | Separate templates per tone | Single template + tone parameter | DRY, easier to maintain |
| Template missing fallback | Error/crash | Return inline text | Graceful degradation, backward compatible |

## Common Pitfalls

### Pitfall 1: Option Set Quality Degradation
**What goes wrong:** Pre-authored options become stale or don't cover edge cases.
**Why it happens:** Options designed in isolation without usage data.
**How to avoid:** Hybrid approach + periodic review via questions:audit CLI (Phase 143).
**Warning signs:** Users frequently picking "Something else", option selection skew.

### Pitfall 2: Taxonomy Over-Engineering
**What goes wrong:** 7 types prove too granular; maintenance burden exceeds benefit.
**Why it happens:**Designing for all possible cases upfront.
**How to avoid:** Start with 7, collect usage data, consolidate in Phase 143+ if needed.
**Warning signs:** Multiple types never used in first 1-2 milestones.

### Pitfall 3: Workflow Coupling to Template IDs
**What goes wrong:** Workflows hardcode template IDs; refactoring breaks everything.
**Why it happens:** No abstraction layer between workflow and template lookup.
**How to avoid:** questionTemplate() provides abstraction; workflows use IDs only, not structure.

## Code Examples

### Existing prompts.js Pattern (for reference):
```javascript
// src/lib/prompts.js lines 53-70
function inputPrompt(name, message, options = {}) {
  if (isDefaultsMode()) {
    const defaults = getDefaultsMap();
    const defaultValue = defaults[name] !== undefined ? defaults[name] : (options.default || '');
    return Promise.resolve({ [name]: defaultValue });
  }
  // ... inquirer prompt
}
```

### Existing DECISION_REGISTRY Pattern (decision-rules.js lines 475-485):
```javascript
const DECISION_REGISTRY = [
  {
    id: 'context-gate',
    name: 'Context Gate Check',
    category: 'state-assessment',
    description: 'Checks if bgsd-context is present',
    inputs: ['context_present'],
    outputs: ['boolean'],
    confidence_range: ['HIGH'],
    resolve: resolveContextGate,
  },
  // ...
];
```

### Workflow question() Pattern (discuss-phase.md lines 94-99):
```markdown
Use question (multiSelect: true):
- header: "Discuss"
- question: "Which areas do you want to discuss for [phase name]?"
- options: 3-4 phase-specific gray areas, each with 1-2 concrete questions
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bare open-ended questions | Taxonomy + curated options | Phase 141 | Better decision quality |
| Inline option text in workflows | questionTemplate() references | Phase 141 | Centralized maintenance |
| LLM-generated options | Hybrid (pre-authored + runtime) | Phase 141 | Coverage + quality |
| Runtime question type inference | Pre-computed via DECISION_REGISTRY | Phase 141 | Consistent routing |

## Open Questions

1. **Where exactly to store templates?** questions.js vs prompts.js — CONTEXT says questions.js for clean separation, but prompts.js is the logical place for template library functions. Recommendation: questions.js for data (TAXONOMY, option sets), prompts.js for functions (questionTemplate).

2. **How to handle existing `<question>` tags in workflows?** Phase 141 builds infrastructure only; migration happens in Phase 142. Graceful fallback ensures backward compatibility during transition.

3. **TAXONOMY category naming convention?** DECISION_REGISTRY uses kebab-case (e.g., 'question-routing'). New category should follow: 'question-routing'.

## Sources

### Primary (HIGH confidence)
- `/Users/cam/DEV/bgsd-oc/.planning/phases/141-taxonomy-infrastructure/141-CONTEXT.md` — Stress-tested implementation decisions
- `/Users/cam/DEV/bgsd-oc/src/lib/decision-rules.js` — DECISION_REGISTRY pattern (lines 475+)
- `/Users/cam/DEV/bgsd-oc/src/lib/prompts.js` — Existing prompt functions
- `/Users/cam/DEV/bgsd-oc/.planning/REQUIREMENTS.md` — TAX-01 through TAX-07 requirements

### Secondary (MEDIUM confidence)
- `/Users/cam/DEV/bgsd-oc/.planning/ROADMAP.md` — Phase 141 success criteria
- `/Users/cam/DEV/bgsd-oc/workflows/discuss-phase.md` — Current question() usage patterns

### Tertiary (LOW confidence)
- General prompting best practices (not bGSD-specific)

## Metadata

**Confidence breakdown:** HIGH — stress-tested decisions provide strong guidance; DECISION_REGISTRY pattern well-established; requirements clear.
**Research date:** 2026-03-19
**Valid until:** Phase 141 completion (2026-03-19)
