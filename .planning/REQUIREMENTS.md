# Requirements

**Milestone:** v15.0 Workflow Questioning & Decision Quality
**Generated:** 2026-03-19

## Traceability

Traceability matrix at bottom.

---

## Category: TAXONOMY (Taxonomy & Infrastructure)

### Requirements

- [ ] **TAX-01:** Question taxonomy enum — Define TAXONOMY enum in `prompts.js` with types: BINARY, SINGLE_CHOICE, MULTI_CHOICE, RANKING, FILTERING, EXPLORATION, CLARIFICATION

- [ ] **TAX-02:** prompts.js template library — Centralize question templates in `prompts.js` with `questionTemplate(id, type, context)` function; workflows reference by ID instead of inline text

- [ ] **TAX-03:** Option generation rules — Implement option generation constraints: MIN 3 options, MAX 5 options, diversity across certainty/scope/approach/priority dimensions, formatting parity (same length/grammar/detail for all options), plausible distractors (believable to partial knowledge), escape hatch ("Something else" option)

- [ ] **TAX-04:** resolveQuestionType decision function — Add `resolveQuestionType(workflow, step)` to DECISION_REGISTRY following existing pure-function pattern; pre-computes question type before workflow execution

- [ ] **TAX-05:** resolveOptionGeneration decision function — Add `resolveOptionGeneration(questionType, context)` to DECISION_REGISTRY; determines whether to use pre-authored options or structured generation

- [ ] **TAX-06:** Mutual exclusivity signaling — Questions must explicitly state "Pick one" or "Select all that apply" based on question type

- [ ] **TAX-07:** Consequence-framed options — Option templates include outcome trade-off hints where applicable

---

## Category: MIGRATE (Workflow Migration)

### Requirements

- [ ] **MIGRATE-01:** discuss-phase.md migration — Replace inline question text with `question()` template references; maintain existing conversation flow

- [ ] **MIGRATE-02:** new-milestone.md migration — Replace inline question text in steps 2 (Gather Goals), 3 (Determine Version), 8 (Research), 9 (Define Requirements) with template references

- [ ] **MIGRATE-03:** plan-phase.md migration — Replace inline question text with template references; preserve planning context injection

- [ ] **MIGRATE-04:** transition.md migration — Replace inline question text with template references

- [ ] **MIGRATE-05:** verify-work.md migration — Replace inline question text with template references

- [ ] **MIGRATE-06:** execute-phase.md migration — Replace inline question text (checkpoint human-verify) with template references

- [ ] **MIGRATE-07:** Remaining workflows audit — Audit remaining ~40 workflows; create inventory of inline question text needing migration

- [ ] **MIGRATE-08:** Remaining workflows migration — Migrate all remaining workflows to template references per inventory

---

## Category: CLI (CLI Tools)

### Requirements

- [ ] **CLI-01:** questions:audit command — `questions:audit` CLI command that scans workflows for inline question text vs template references; reports taxonomy compliance percentage

- [ ] **CLI-02:** questions:list command — `questions:list` CLI command that lists all question templates in prompts.js with taxonomy type and usage count

- [ ] **CLI-03:** questions:validate command — `questions:validate` CLI command that validates all question templates have 3-5 options, formatting parity, escape hatches

---

## Out of Scope

- Option generation with user history (personalized options based on past decisions)
- Dynamic option count (adaptive number based on decision complexity)
- Option quality scoring (automated evaluation of distractor plausibility)
- Pre-authored option sets for every possible question (too many; use structured generation)

---

## Future Requirements

- **FUT-01:** Option generation with user history — Personalized options based on decision history
- **FUT-02:** Dynamic option count — Adaptive number based on decision complexity
- **FUT-03:** Option quality scoring — Automated distractor plausibility evaluation
- **FUT-04:** Option analytics dashboard — Track which questions lead to better outcomes

---

## Traceability Matrix

| REQ-ID | Type | Phase | Intent Outcome | Priority |
|---------|------|-------|----------------|----------|
| TAX-01 | must | 141 | DO-105 | HIGH |
| TAX-02 | must | 141 | DO-105 | HIGH |
| TAX-03 | must | 141 | DO-105, DO-106 | HIGH |
| TAX-04 | must | 141 | DO-105 | HIGH |
| TAX-05 | must | 141 | DO-106 | HIGH |
| TAX-06 | must | 141 | DO-106 | MEDIUM |
| TAX-07 | should | 141 | DO-106 | MEDIUM |
| MIGRATE-01 | must | 142 | DO-107 | HIGH |
| MIGRATE-02 | must | 142 | DO-107 | HIGH |
| MIGRATE-03 | must | 142 | DO-107 | HIGH |
| MIGRATE-04 | must | 142 | DO-107 | MEDIUM |
| MIGRATE-05 | must | 142 | DO-107 | MEDIUM |
| MIGRATE-06 | must | 142 | DO-107 | MEDIUM |
| MIGRATE-07 | must | 143 | DO-107 | HIGH |
| MIGRATE-08 | must | 143 | DO-107 | HIGH |
| CLI-01 | must | 143 | DO-108 | HIGH |
| CLI-02 | must | 143 | DO-108 | MEDIUM |
| CLI-03 | must | 143 | DO-108 | MEDIUM |

---

*Requirements confirmed: 2026-03-19*
