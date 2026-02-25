# Phase 20: Structured Requirements - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Requirements carry testable acceptance criteria that flow through planning into verification, closing the loop between "what we said" and "what we proved." This phase adds structured assertions to the requirements pipeline — from definition through planning into verification. It does not change how requirements themselves are written or scoped.

</domain>

<decisions>
## Implementation Decisions

### Acceptance Criteria Format
- Machine-parseable structured assertions, not plain-language checkboxes or Gherkin (per existing v4.0 decision)
- Flexible schema: `assert` field required, `when`/`then`/`type` optional — use full structure when it adds clarity, skip when obvious
- Target 3-5 assertions per requirement — enough to specify behavior without over-prescribing
- Assertions live in a separate ASSERTIONS.md file, not inline in REQUIREMENTS.md — requirements stay clean, assertions back-reference requirement IDs

### Traceability Mechanism
- Full chain visibility: requirement → assertion → plan task → verification result
- Dual access: status chain in trace command output (`REQ-03 → ASSERT-03a ✓, ASSERT-03b ✗ → Plan 02 Task 1 → VERIFICATION: partial`), plus inline in verification output
- Fully automatic linking — planner reads assertions, tags tasks with requirement IDs, verifier matches results back. User never touches trace links.
- Coverage gaps warned during planning with recommended action, not a hard block

### Verification Integration
- Assertions checked during `verify-work` (full sweep) and after plan execution (subset that plan claimed to cover) — catches gaps early
- Hybrid verification mechanism: static pattern matching on disk for artifact/file checks (automated), agent evaluation for behavioral assertions (flexible)
- Failed assertions flag with gap closure — automatically generate gap descriptions that feed into `--gaps` planning workflow
- Two priority levels: must-have (failures trigger gap closure) and nice-to-have (failures are advisory only in report)

### Authoring Experience
- Agent derives assertions automatically during plan-phase from requirements + context — no new workflow step
- User only involved when agent can't determine what "done" looks like (collaborative fallback)
- Must-have assertions get a review gate — user approves before plans finalize
- Nice-to-have assertions get summary only ("N assertions generated for M requirements") — informational, doesn't block
- Gradual migration for existing requirements — add assertions when a phase touches an old requirement, no big-bang backfill

### Agent's Discretion
- Exact assertion schema syntax and field names
- How agent determines must-have vs nice-to-have classification
- Internal storage format of trace links
- How static pattern checks are expressed (regex, glob, file existence)
- Migration detection logic (when does a phase "touch" an old requirement)

</decisions>

<specifics>
## Specific Ideas

- Status chain format for tracing: `REQ-03 → ASSERT-03a ✓, ASSERT-03b ✗ → Plan 02 Task 1 → VERIFICATION: partial`
- Flexible assertion schema example:
  ```
  - assert: "Creating a project returns the project object"
    when: "POST /api/projects with valid {name, description}"
    then: "status=201, body contains {id, name, created_at}"
    type: api
  ```
- Ties into existing gap closure workflow (`--gaps` flag) for failed must-have assertions
- Enhances existing `trace-requirement` command in gsd-tools rather than creating a new command

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-structured-requirements*
*Context gathered: 2026-02-25*
