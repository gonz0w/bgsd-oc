---
phase: [XX-phase-name]
plan: [NN]
type: tdd
wave: 1
depends_on: []
files_modified:
  - [path/to/source-file]
  - [path/to/test-file]
autonomous: true
requirements:
  - [REQ-ID]
must_haves:
  truths:
    - "[Tests pass with the new feature]"
    - "[No regressions in existing tests]"
  artifacts:
    - path: "[path/to/source-file]"
      provides: "[Feature implementation]"
    - path: "[path/to/test-file]"
      provides: "[Test coverage for feature]"
---

<!-- TDD Plan: One feature per plan. RED → GREEN → REFACTOR cycle. -->
<!-- Produces 2-3 atomic commits: test() → feat() → refactor() (optional) -->

<objective>
[What feature is being built and why TDD improves the result.]

Purpose: [Design benefit of TDD for this feature — e.g., forces clean interface, validates edge cases.]
Output: [Working, tested feature with 2-3 commits.]
</objective>

<execution_context>
@__OPENCODE_CONFIG__/get-shit-done/workflows/execute-plan.md
@__OPENCODE_CONFIG__/get-shit-done/templates/summary.md
@__OPENCODE_CONFIG__/get-shit-done/references/tdd.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@[relevant source files for context]
</context>

<feature>
  <name>[Feature name]</name>
  <files>[source file], [test file]</files>
  <behavior>
[Expected behavior described in testable terms.]

Cases:
  - [input A] → [expected output A]
  - [input B] → [expected output B]
  - [edge case C] → [expected output C]
  - [error case D] → [expected error/handling D]
  </behavior>
  <implementation>
[How to implement once tests are written. Include algorithm approach,
data structures, library choices, and integration points.]
  </implementation>
</feature>

<!-- Execution follows RED → GREEN → REFACTOR automatically. -->
<!-- RED:      Write failing tests from <behavior>. Commit: test({phase}-{plan}): add failing test for [feature] -->
<!-- GREEN:    Implement minimal code from <implementation>. Commit: feat({phase}-{plan}): implement [feature] -->
<!-- REFACTOR: Clean up if needed. Commit: refactor({phase}-{plan}): clean up [feature] -->

<verification>
[Test command that proves the feature works.]
```bash
[npm test / go test ./... / pytest / etc.]
```
</verification>

<success_criteria>
- [ ] Failing test written and committed (RED)
- [ ] Implementation passes test (GREEN)
- [ ] Refactor complete if needed (REFACTOR)
- [ ] All 2-3 commits present in git history
- [ ] No regressions in existing test suite
</success_criteria>

<output>
After completion, create `.planning/phases/[XX-phase-name]/[XX]-[NN]-SUMMARY.md` with:
- RED: What test was written, why it failed
- GREEN: What implementation made it pass
- REFACTOR: What cleanup was done (if any)
- Commits: List of commits produced
</output>
