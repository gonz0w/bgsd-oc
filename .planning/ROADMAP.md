# Roadmap: bGSD Plugin

## Milestones

- ✅ **v14.1 Tool-Aware Agent Routing** - Phases 138-140 (shipped 2026-03-17)
- ✅ **v15.0 Workflow Questioning & Decision Quality** - Phases 141-143 (shipped 2026-03-20)

## Overview

v15.0 implements a question design system for workflow discussions — replacing bare open-ended questions with taxonomy-driven multiple-choice options. Phase 141 establishes the taxonomy infrastructure (enum, template library, option generation rules, decision routing). Phase 142 migrates the 6 highest-traffic workflows to use template references. Phase 143 audits and migrates the remaining ~40 workflows and adds CLI audit tools.

## Phases

- [x] **Phase 141: Taxonomy & Infrastructure** - Define question taxonomy, option generation rules, prompts.js template library, and decision routing functions (completed 2026-03-20)
- [x] **Phase 142: Primary Workflow Migration** - Migrate discuss-phase, new-milestone, plan-phase, transition, verify-work, execute-phase to template references (completed 2026-03-20)
- [x] **Phase 143: Remaining Workflows & CLI Tools** - Audit remaining workflows, migrate all to templates, add questions:audit/list/validate CLI commands (completed 2026-03-20)

## Phase Details

### Phase 141: Taxonomy & Infrastructure
**Goal**: Question taxonomy infrastructure — enum, template library, option generation rules, decision routing
**Depends on**: Nothing (first phase)
**Requirements**: TAX-01, TAX-02, TAX-03, TAX-04, TAX-05, TAX-06, TAX-07
**Success Criteria** (what must be TRUE):
  1. TAXONOMY enum in prompts.js defines 7 question types: BINARY, SINGLE_CHOICE, MULTI_CHOICE, RANKING, FILTERING, EXPLORATION, CLARIFICATION
  2. questionTemplate(id, type, context) function centralizes all question templates — workflows reference by ID instead of inline text
  3. Option generation rules enforce: MIN 3 options, MAX 5 options, diversity across certainty/scope/approach/priority dimensions, formatting parity (same length/grammar/detail), plausible distractors, and escape hatch ("Something else")
  4. resolveQuestionType(workflow, step) and resolveOptionGeneration(questionType, context) are in DECISION_REGISTRY with contract tests
  5. Questions explicitly state "Pick one" or "Select all that apply" based on question type (mutual exclusivity signaling)
  6. Option templates include outcome trade-off hints where applicable (consequence-framed)
**Plans**: 3/3 plans complete

### Phase 142: Primary Workflow Migration
**Goal**: Migrate 6 primary workflows to use question() template references instead of inline question text
**Depends on**: Phase 141
**Requirements**: MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, MIGRATE-05, MIGRATE-06
**Success Criteria** (what must be TRUE):
  1. discuss-phase.md uses question() template references for all questions — zero inline question text remains
  2. new-milestone.md (steps 2, 3, 8, 9) uses question() template references — conversation flow preserved
  3. plan-phase.md uses question() template references — planning context injection intact
  4. transition.md uses question() template references — phase transition workflow unchanged
  5. verify-work.md uses question() template references — verification flow preserved
  6. execute-phase.md (checkpoint human-verify step) uses question() template references
**Plans**: 6/6 plans complete

### Phase 143: Remaining Workflows & CLI Tools
**Goal**: Audit remaining ~40 workflows, migrate all to templates, add questions:audit/list/validate CLI commands
**Depends on**: Phase 142
**Requirements**: MIGRATE-07, MIGRATE-08, CLI-01, CLI-02, CLI-03
**Success Criteria** (what must be TRUE):
  1. questions:audit command scans workflows, identifies inline question text vs template references, reports taxonomy compliance percentage
  2. questions:list command lists all question templates in prompts.js with taxonomy type and usage count per workflow
  3. questions:validate command validates all question templates have 3-5 options, formatting parity, and escape hatches
  4. Remaining ~40 workflows audited with inventory of inline question text documented
  5. All remaining workflows migrated to question() template references — zero bare open-ended questions remain
**Plans**: 5/5 plans complete

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 141. Taxonomy & Infrastructure | 3/3 | Complete    | 2026-03-20 |
| 142. Primary Workflow Migration | 6/6 | Complete    | 2026-03-20 |
| 143. Remaining Workflows & CLI Tools | 5/5 | Complete    | 2026-03-20 |

---

*Last updated: 2026-03-20*
