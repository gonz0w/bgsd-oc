# Project Research Summary

**Project:** Question Design Systems for AI Agents
**Domain:** CLI-based AI agent orchestration with question design system integration
**Researched:** 2026-03-19
**Confidence:** HIGH

<!-- section: compact -->
<compact_summary>
<!-- The compact summary is the DEFAULT view for orchestrators and planners.
     Keep it under 30 lines. Synthesizes all 4 research areas.
     Full sections below are loaded on-demand via extract-sections. -->

**Summary:** Research confirms v15.0 should implement a question taxonomy + option generation system in `prompts.js` using structured data (no external libraries). The core gap is option generation quality — current workflows rely on ad-hoc LLM generation without taxonomy guidance. The solution: taxonomy-tagged question templates in `prompts.js`, decision routing via `DECISION_REGISTRY`, and workflow migration from inline question text to template references.

**Recommended stack:** Structured question templates (data, no lib), Question taxonomy enum (data), Option generation rules (data + prompting), prompts.js inquirer wrappers (modify)

**Architecture:** Workflow-driven agent orchestration with taxonomy-tagged question routing via centralized templates in `prompts.js` and pre-computed routing decisions in `DECISION_REGISTRY`.

**Top pitfalls:**
1. Vague open-ended questions — Always add goal+context+options (Phase 1)
2. Option cueing bias — Formatting parity across all options (Phase 1)
3. Poor distractor quality — Wrong answers must be plausible to non-experts (Phase 1)
4. No question taxonomy — Single-select vs multi-select based on decision type (Phase 1)
5. Leading/biased framing — Neutral language; don't embed assumptions (Phase 1)

**Suggested phases:**
1. **Phase 1: Taxonomy & Infrastructure** — Define question taxonomy, option generation rules, prompts.js infrastructure, decision routing functions
2. **Phase 2: Workflow Migration** — Migrate discuss-phase.md, new-milestone.md, plan-phase.md to use taxonomy template references
3. **Phase 3: Remaining Workflows & CLI Tools** — Migrate remaining ~40 workflows, add `questions:audit` and `questions:list` CLI commands

**Confidence:** HIGH | **Gaps:** Option generation at runtime is an open research problem — hybrid Phase 1 (pre-authored) + Phase 2 (structured generation) approach is pragmatic
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

This research confirms that bGSD v15.0 should implement a question design system using **no external libraries** — all patterns as structured data in the existing `bin/bgsd-tools.cjs` architecture. The core problem: current workflows scatter raw question text across 45 markdown files with ad-hoc option generation by LLMs, producing inconsistent question quality and no systematic way to audit or improve.

The recommended approach centers on a **question taxonomy** (clarify, decide, prioritize, discover, confirm, scope) that drives option generation strategy, and a **template centralization** pattern where `prompts.js` becomes the single source for all question templates. Workflows reference templates by ID rather than embedding inline text.

The primary architectural pattern is **Decision-First Question Routing** — use `DECISION_REGISTRY` to pre-compute question type before workflow execution, enriching `bgsd-context` with taxonomy decisions that downstream agents can reference. This follows the existing `resolvePlanExistenceRoute` pattern and extends it to question classification.

Key risks: Option generation at runtime is an open research problem (no libraries exist); the pragmatic solution is hybrid pre-authored options for common workflows + structured generation rules for novel contexts.
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

The stack is entirely **data + prompting** — no external dependencies. All patterns live in `src/lib/prompts.js` and `src/lib/decision-rules.js` following existing DECISION_REGISTRY conventions.

**Core technologies:**
- **Structured question templates** (data, no lib): Pre-authored option sets per discussion context in `prompts.js` — zero dependency, version-controllable
- **Question taxonomy enum** (data, no lib): Classifies question types — BINARY, SINGLE_CHOICE, MULTI_CHOICE, RANKING, FILTERING, EXPLORATION, CLARIFICATION
- **Option generation rules** (data + prompting): Constraints for runtime generation — MIN 3, MAX 5, diversity across certainty/scope/approach/priority dimensions
- **prompts.js inquirer wrappers** (existing, modify): Centralize question templates here instead of scattering raw text across 45 workflows

### Expected Features

**Must have (table stakes):**
- Single-select vs multi-select distinction — different question types require different option semantics
- 3-5 options enforcement — agent prompts updated to always generate 3-5 thoughtful options first
- Parallel structure rule — options must match in grammar, length, specificity
- Plausible distractor generation — wrong answers must be believable to someone with partial knowledge
- Escalation option — every question set includes "Something else / None of the above" escape hatch
- Mutual exclusivity signal — "Pick one" vs "Select all that apply" explicit in question phrasing

**Should have (competitive differentiators):**
- Workflow-specific option taxonomies — milestone vs phase vs plan discussions have distinct decision types
- Consequence-framed options — each choice shows its outcome trade-off
- Option difficulty calibration — options vary in commitment/risk level

**Defer (v2+):**
- Option generation with user history — personalized options based on past decisions
- Dynamic option count — adaptive number based on decision complexity
- Option quality scoring — automated evaluation of distractor plausibility

### Architecture Approach

The architecture adds a **Question Taxonomy Layer** between workflow execution and the CLI prompts. Workflows (`workflows/*.md`) replace inline question text with `question(id, type, context)` references. `prompts.js` becomes the template library with `routeQuestionType()` and `questionTemplate()` functions. `DECISION_REGISTRY` gains `resolveQuestionType` and `resolveOptionGeneration` decision functions for pre-computed routing.

**Major components:**
1. `workflows/*.md` — Step sequences with `question()` calls referencing taxonomy IDs (MODIFY — replace inline text)
2. `src/lib/prompts.js` — Question template library with taxonomy routing and option generation (MODIFY — add taxonomy + generation)
3. `src/lib/decision-rules.js` — Pure decision functions including question-type routing rules (MODIFY — add routing rules)
4. `src/lib/context.js` — Agent manifests with question context fields (MODIFY — add question context)
5. `src/commands/questions.js` — CLI commands for taxonomy audit and template listing (NEW)

### Critical Pitfalls

1. **Vague open-ended questions** — Always add goal+context+options. Apply the QuestionCraft formula: goal clarity + relevant context + cognitive level + specificity + actionability.

2. **Option cueing bias** — Correct answer gets longest/detailed option. Apply formatting parity: all options same length, same grammatical structure, same level of detail.

3. **Poor distractor quality** — Wrong options are obviously wrong. Distractors must be plausible to someone with partial knowledge; use common misconceptions, not random errors.

4. **No question taxonomy** — Single-select vs multi-select used interchangeably. Define and enforce taxonomy: single-select (mutually exclusive), multi-select (any combination valid), ranked (order matters).

5. **Leading/biased framing** — Neutral language must be verified. Apply "opposite day" test: if you flipped the question, would the same answer still be best?
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Taxonomy & Infrastructure
**Rationale:** Cannot build option sets or migrate workflows without the taxonomy definition and infrastructure first. Wave 1 has no dependencies — it establishes the foundation.
**Delivers:** Question taxonomy enum in `prompts.js`, `routeQuestionType()` and `questionTemplate()` functions, `resolveQuestionType` and `resolveOptionGeneration` in `DECISION_REGISTRY`, option generation rules with diversity constraints
**Addresses:** Feature: question type classification, mutual exclusivity signaling; Pitfalls: vague questions, no taxonomy, leading framing
**Avoids:** Anti-pattern: bare open-ended questions, inline question text in workflows
**Research flag:** Standard pattern — no deeper research needed during planning

### Phase 2: Workflow Migration — Primary Workflows
**Rationale:** Primary user-facing workflows (discuss-phase, new-milestone, plan-phase) need taxonomied questions first. These are highest-traffic and most impactful for quality improvement.
**Delivers:** Migrated `discuss-phase.md` (5-6 questions → template references), migrated `new-milestone.md` (4-5 questions → template references), migrated `plan-phase.md` and `transition.md`
**Uses:** Structured question templates from Phase 1, option generation rules
**Implements:** Question template library in `prompts.js`
**Research flag:** Medium risk — may reveal edge cases in taxonomy; have backup research task

### Phase 3: Workflow Migration — Remaining + CLI Tools
**Rationale:** Remaining ~40 workflows can be migrated once template library is proven. CLI tools (`questions:audit`, `questions:list`) enable systematic taxonomy compliance auditing.
**Delivers:** ~40 remaining workflows migrated, `questions:audit` CLI command, `questions:list` CLI command, agent manifest question context fields
**Uses:** Template library + decision routing from Phases 1-2
**Research flag:** Standard pattern — parallelizable, lower risk than Phase 2

### Phase Ordering Rationale

- **Dependency order:** Phase 1 infrastructure must exist before workflow migration can begin
- **Impact order:** Primary workflows (Phase 2) before secondary (Phase 3) — highest value first
- **Parallelization:** Within Phase 2, discuss-phase, new-milestone, plan-phase can migrate in parallel (different files)
- **Pitfall avoidance:** Phase 1 enforces taxonomy before any question is asked in migrated workflows
- **Anti-pattern prevention:** Phase 1 establishes template centralization before 45 workflows are touched

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Workflow Migration):** May reveal edge cases in question taxonomy when applied to real workflows; have fallback: extend taxonomy with additional types rather than forcing fit

Phases with standard patterns (skip research-phase):
- **Phase 1 (Taxonomy & Infrastructure):** Data-driven approach with clear precedent in DECISION_REGISTRY
- **Phase 3 (Remaining Workflows + CLI):** Mechanical migration once library exists; CLI patterns well-established
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified in codebase — DECISION_REGISTRY pattern confirmed, prompts.js location confirmed, no external libraries needed per PROJECT.md constraint |
| Features | HIGH | Community consensus across education (Bloom's), MCQ research, UX literature; multiple sources agree on table stakes |
| Architecture | HIGH | All components verified in existing codebase; decision routing pattern has clear precedent; integration points mapped |
| Pitfalls | HIGH | Sourced from QuestionCraft (60+ years research), AI4VET4AI, medical education MCQ studies, UX conversation design |

**Overall confidence:** HIGH

### Gaps to Address

**Option generation at runtime:** No library or framework exists for AI-driven option generation. All existing approaches use pre-authored options or LLM-with-constraints. This is an open research problem.

- **Gap:** Runtime option generation without pre-authored sets
- **Handling:** Hybrid approach — Phase 1 curates pre-authored option sets for existing workflows; Phase 2 adds `generateFrom` functions with diversity constraints; Phase 3 (future) explores structured prompting for fully dynamic generation

**Inline question text duplication:** 45 workflows × 5 questions = 225 inline texts to migrate. Token impact is actually positive (template references shorter than inline text), but migration effort is non-trivial.

- **Gap:** Manual migration effort for remaining workflows
- **Handling:** CLI audit tool (`questions:audit`) to track progress; parallelizable across Phase 3
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- `src/lib/prompts.js` — Existing inquirer wrappers (verified in codebase)
- `src/lib/decision-rules.js` — DECISION_REGISTRY with 19 decision functions (verified in codebase)
- `src/lib/context.js` — AGENT_MANIFESTS (verified in codebase)
- `workflows/discuss-phase.md`, `workflows/new-milestone.md` — Existing workflow patterns (verified in filesystem)
- LangChain GitHub Issue #9932 — PromptTree branching prompt pattern (reference, not code)
- arXiv:2602.03704 — REQUESTA multi-agent MCQ generation framework

### Secondary (MEDIUM confidence)
- University of Michigan Center for Academic Innovation: MCQ prompting guidelines (2025)
- QuestionCraft "Ultimate Guide to Asking Better Questions in the AI Age" (2025)
- AI4VET4AI: AI Chatbots are Terrible at Creating MCQs — distractor quality, Bloom's taxonomy
- Azure AI Agent Design Patterns — Orchestration patterns
- arXiv:2412.00970 — Multi-Agent LLM Approach to AI Literacy MCQs

### Tertiary (LOW confidence — validate during implementation)
- Kapture.ai, Zendesk, NN/g Nielsen Norman Group — Conversation design principles (general, not CLI-specific)
- Chaos and Order "Chatbot Conversation Design Guide" (2026) — Needs validation against CLI context

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
