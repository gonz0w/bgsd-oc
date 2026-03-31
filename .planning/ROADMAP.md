# Roadmap: bGSD Plugin

## Milestones

- ✅ **v14.1 Tool-Aware Agent Routing** - Phases 138-140 (shipped 2026-03-17)
- ✅ **v15.0 Workflow Questioning & Decision Quality** - Phases 141-143 (shipped 2026-03-20)

## Overview

No active milestone. Ready for next `/bgsd-new-milestone`.

---

## v15.0 Workflow Questioning & Decision Quality (Shipped 2026-03-20)

**Goal:** Establish the question taxonomy and migrate all primary workflows plus most remaining workflows to clear, thoughtful multiple-choice options, with residual inline cases tracked for follow-up.

**Phases:** 3 (141-143), 14 plans, 14 summaries

**Key accomplishments:**
- Question taxonomy enum with 7 types (BINARY, SINGLE_CHOICE, MULTI_CHOICE, RANKING, FILTERING, EXPLORATION, CLARIFICATION)
- questionTemplate(id, type, context) function in prompts.js with graceful runtime fallback
- resolveQuestionType and resolveOptionGeneration decision functions for taxonomy routing
- 6 primary workflows migrated to template references (discuss-phase, new-milestone, plan-phase, transition, verify-work, execute-phase)
- questions:audit/list/validate CLI commands for taxonomy compliance
- 44 workflows audited, 6 additional workflows migrated, 90.5% taxonomy compliance with remaining inline cases tracked for follow-up

<details>
<summary>Phase 141: Taxonomy & Infrastructure</summary>

**Goal:** Question taxonomy infrastructure — enum, template library, option generation rules, decision routing

**Requirements:** TAX-01, TAX-02, TAX-03, TAX-04, TAX-05, TAX-06, TAX-07
**Plans:** 3/3 complete

</details>

<details>
<summary>Phase 142: Primary Workflow Migration</summary>

**Goal:** Migrate 6 primary workflows to use question() template references

**Requirements:** MIGRATE-01, MIGRATE-02, MIGRATE-03, MIGRATE-04, MIGRATE-05, MIGRATE-06
**Plans:** 6/6 complete

</details>

<details>
<summary>Phase 143: Remaining Workflows & CLI Tools</summary>

**Goal:** Audit remaining workflows, migrate the remaining high-value template targets, add questions:audit/list/validate CLI commands, and track residual inline cases for follow-up

**Requirements:** MIGRATE-07, MIGRATE-08, CLI-01, CLI-02, CLI-03
**Plans:** 5/5 complete

</details>

---

## v14.1 Tool-Aware Agent Routing (Shipped 2026-03-17)

<details>
<summary>Phases 138-140</summary>

See `.planning/milestones/v14.1-ROADMAP.md` for details.

</details>

---

*Last updated: 2026-03-20*
