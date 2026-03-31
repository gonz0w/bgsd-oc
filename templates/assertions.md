# Assertions: [Project Name]

**Defined:** [date]
**Source:** REQUIREMENTS.md

<!-- Guidelines:
  - `assert` field required; `when`, `then`, `type`, `priority` optional
  - Use `when`/`then` when they add clarity; skip when assertion is self-evident
  - Target 2-5 assertions per requirement
  - `priority: must-have` (default) triggers gap closure on failure
  - `priority: nice-to-have` is advisory only — failures don't block
  - `type` values: api, cli, file, behavior
  - Assertions back-reference requirement IDs via `## REQ-ID:` heading
  - Gradual migration: add assertions when a phase touches a requirement
-->

## [CATEGORY]-[NN]: [Requirement description]

- assert: "[Testable statement about expected behavior]"
  when: "[Precondition or trigger — optional]"
  then: "[Expected outcome — optional]"
  type: [api|cli|file|behavior]
  priority: must-have

- assert: "[Another testable statement]"
  priority: must-have

## Examples

### SREQ-01: Requirements template includes structured acceptance criteria

- assert: "ASSERTIONS.md template exists with schema definition"
  type: file
  priority: must-have

- assert: "parseAssertionsMd returns structured assertion map keyed by requirement ID"
  when: "Given valid ASSERTIONS.md content"
  then: "Returns object with reqId keys containing description and assertions array"
  type: behavior
  priority: must-have

- assert: "assertions list command outputs all assertions grouped by requirement"
  when: "Running assertions list --raw"
  then: "JSON output includes total_requirements, total_assertions, requirements map"
  type: cli
  priority: must-have

- assert: "assertions validate checks format and reports issues"
  when: "Running assertions validate --raw"
  then: "JSON output includes valid boolean, issues array, stats object"
  type: cli
  priority: must-have

- assert: "Bundle stays within 525KB budget after all Phase 20 additions"
  type: behavior
  priority: must-have

### ENV-01: CLI detects project languages from manifest files

- assert: "env scan detects Node.js from package.json"
  when: "Project root contains package.json"
  then: "env scan output includes nodejs in languages"
  type: cli
  priority: must-have

- assert: "Polyglot projects detect ALL languages"
  when: "Project has both package.json and go.mod"
  then: "Both nodejs and go appear in languages array"
  type: cli
  priority: must-have

- assert: "Detection completes in under 10ms"
  type: behavior
  priority: nice-to-have

## Assertion → Plan Flow

During `/bgsd-plan phase 12`, the planner:
1. Reads ASSERTIONS.md for the phase's requirements
2. Uses must-have assertions as the source for `must_haves.truths` in PLAN.md frontmatter
3. Each plan's truths map back to specific assertions
4. During verification, each truth is checked against the original assertion

This creates full traceability: Requirement → Assertion → Plan Truth → Verification Result

## Migration

Assertions are added gradually — when a phase touches a requirement, assertions for that requirement should be created. There is no need for a big-bang backfill.

`assertions validate` will report coverage: how many requirements have assertions vs. how many don't.

---
*Template: templates/assertions.md*
*Schema version: 1.0*
