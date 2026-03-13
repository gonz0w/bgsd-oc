# Phase 114: Test Suite Stabilization - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all test failures so the entire test suite passes with zero failures. The suite must provide reliable signal for all subsequent changes. Current state: 473 passing, 1373 failing — the bulk caused by a Bun runtime banner polluting stdout.

</domain>

<decisions>
## Implementation Decisions

### Bun Banner Fix Strategy
- Suppress the `[bGSD] Running with Bun vX.X` banner at source — remove stdout output entirely
- Keep silent Bun detection internally for compatibility purposes, but never print it
- No dedicated regression test needed — existing tests that parse JSON output serve as regression guards
- Fix the banner first, re-run tests, then re-assess remaining failures before planning further fixes

### Test vs Code Alignment
- CLI output is the source of truth — when test expectations are stale, update the tests to match current CLI behavior
- Update assertions silently — no comments needed in test code (git diff is the record)
- Delete tests for features/commands that no longer exist (orphaned tests)
- For missing module imports: agent judges per case — fix the import path if the module moved, delete the test if the module was intentionally removed

### Failure Triage Approach
- After banner fix, group remaining failures by root cause and fix one cause at a time
- If a test failure reveals a genuine CLI bug, fix the bug in this phase — don't defer
- Target absolute zero failures — every single test must pass, no exceptions
- Deleting tests for dead/removed features is acceptable to reach zero

### Test Coverage Stance
- Fix + light improvements: fix all failures, and add tests if you spot obvious gaps while in a file
- Consolidate test helpers only if it directly helps fix multiple test files
- Final test count doesn't matter — zero failures is the goal, not a specific number
- All tests held to the same standard — plugin tests and CLI tests alike
- Add tests for obvious untested edge cases in files you're already touching
- Fix egregiously slow tests (>5s) if the fix is easy, otherwise leave speed for later

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 0114-test-suite-stabilization*
*Context gathered: 2026-03-13*
