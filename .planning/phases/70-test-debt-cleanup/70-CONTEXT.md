# Phase 70: Test Debt Cleanup - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all 31 pre-existing test failures across config-migrate, compact, codebase-impact, and codebase ast modules. The test suite (762+ tests) must be fully green with zero failures, serving as a trustworthy regression safety net. Additionally, add an executor rule to enforce test-passing as a hard gate for future changes.

</domain>

<decisions>
## Implementation Decisions

### Fix vs. Remove Strategy
- Default approach: **update existing tests** to match current behavior (not rewrite from scratch)
- Before updating assertions, do a **quick sanity check** (~30 seconds) that the current behavior is actually correct — don't just blindly match
- Dead tests (covering removed features/code paths): **remove entirely** — no commented-out tests, no archives
- Flaky tests: **fix the root cause** (timing, state leaks, etc.) — don't mark as skip or tolerate flakiness
- If fixing a test reveals a real bug in source code: **fix the bug inline** as part of this phase
- Source code changes are **allowed freely** — fix bugs in `src/` when tests reveal them
- Don't refactor test style (e.g., internal-testing to behavioral-testing) — **just make them pass**

### Failure Triage Order
- Work through modules **in listed order**: config-migrate → compact → codebase-impact → codebase ast
- **Module by module**: each module must be fully green before moving to the next
- After each module: **run only that module's tests** to confirm green
- Full suite run **only at the end** after all 4 modules are green
- Plan structure: **one plan with one task per module** + a final full-suite validation task

### Regression Guardrails
- **Hard gate**: tests must pass — zero tolerance for new failures going forward
- Enforcement via **bGSD executor rule**: add a rule to the executor workflow that runs tests after each task and fails the task if tests break
- **No `.skip()` or `.only()` in committed code** — ever. Tests either run or get removed.
- Setting up the executor rule is **in scope for this phase** (not deferred)

### Test Quality Bar
- Every test touched should come out **better than it went in** — strengthen weak assertions (e.g., replace truthiness checks with specific value checks)
- **Improve test descriptions**: fix vague or missing `it()` / `describe()` descriptions to clearly state what's being verified
- **Fill obvious coverage gaps**: if an untested code path is right next to what's being fixed, add coverage for it
- **No coverage target number** — the goal is zero failures, not a test count
- Don't add new tests for unrelated code paths — only what's adjacent to the fixes

</decisions>

<specifics>
## Specific Ideas

- The 31 failures are expected to be a **mix of outdated tests and real bugs** — no strong leaning either way
- Expect to find tests that drifted when features were changed in earlier phases without updating the corresponding tests
- The executor rule should integrate naturally with the existing bGSD executor workflow — likely a verify step that runs the test command

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 70-test-debt-cleanup*
*Context gathered: 2026-03-08*
