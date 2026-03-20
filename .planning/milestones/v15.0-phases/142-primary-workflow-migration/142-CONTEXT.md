# Phase 142: Primary Workflow Migration - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary
Migrate 6 primary workflows (discuss-phase, new-milestone, plan-phase, transition, verify-work, execute-phase) from inline question text to question() template references, enabling centralized option management and consistent questioning taxonomy.
</domain>

<decisions>
## Implementation Decisions

### Migration Strategy
- **Atomic per workflow** — Migrate complete workflow or none. Simpler testing, clear pass/fail boundary, easier rollback decision.
- **Graceful fallback** — If template missing/malformed, use inline text as fallback. Enables parallel work between template authors and workflow migrators.
- **Template hotfix for rollback** — Bugs in migrated workflow fixed via template update. No workflow file revert needed, faster recovery.

### Context Injection
- **Full conversation history** — Templates receive entire conversation for maximum context. Better option generation justifies token cost.
- **Workflow owns state** — Workflow passes accumulated context to each questionTemplate() call. Workflow knows conversation flow; templates stay reusable.
- **Structured object passing** — Typed fields (phase, task, userHistory) passed to templates. Type safety and explicit dependencies between workflow and template.

### Template Compatibility
- **Semantic compatibility** — Templates declare compatible workflow versions loosely, not strict version matching. Less coordination overhead between template authors and workflow maintainers.
- **Template adapts to old workflows** — New templates detect context and return appropriate options for pre-141 workflows. Backward compatible, no migration blockers.
- **Reject at validation** — questions:validate catches option rule violations (e.g., < 3 options) before deployment. Quality gate prevents problems reaching users.

### Conversation Integrity
- **Behaviorally equivalent** — Same outcomes possible, but flow can differ from original. Future-proofing allows templates to improve question order.
- **Preserve option order** — If original workflow had fixed option order, template must preserve it. Power users rely on muscle memory for option positions.
- **Show all, let user filter** — Templates show all returned options. Users ignore inapplicable rather than system deciding what's relevant.

### Agent's Discretion
- Specific option wording within templates (authors choose phrasing)
- How to implement semantic version declaration format
- Internal template organization structure
</decisions>

<specifics>
## Specific Ideas
- 6 workflows: discuss-phase, new-milestone, plan-phase, transition, verify-work, execute-phase
- questionTemplate(id, context) function signature from Phase 141
- questions:validate command for template validation
- Graceful fallback returns inline text when template missing
</specifics>

<stress_tested>
## Stress-Tested Decisions
All decisions held up under stress testing — revisions noted below:
- Semantic compatibility (defended: less coordination overhead justified)
- Full conversation history (defended: quality of options justifies token cost)
- Graceful fallback with workflow-owned state (defended: validation catches template bugs)
- Show all options, user filters (REVISED from "filter invalid options" — user's grumpy power user argument about cognitive load vs user agency won)
</stress_tested>

<deferred>
## Deferred Ideas
None — discussion stayed within phase scope
</deferred>

---
*Phase: 142-primary-workflow-migration*
*Context gathered: 2026-03-19*
