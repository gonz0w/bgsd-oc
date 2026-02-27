# Phase 31: Quality Gates & Format Testing - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all broken tests (243 failures from Phase 30's --raw removal) and add test coverage for the new formatting utilities in `src/lib/format.js`. This is a quality gate — the test suite must be green before downstream phases build command renderers on the formatting foundation.

**Root cause of failures:** The test harness spawns commands with `--raw` flag, which was removed in Phase 30. The new TTY auto-detection means piped/spawned commands auto-produce JSON — no flag needed. Fix is updating the test runner's invocation pattern, not 243 individual test fixes.

</domain>

<decisions>
## Implementation Decisions

### Test failure fix approach
- Fix the root cause: update the test harness invocation to match Phase 30's spec (TTY auto-detection replaces --raw)
- Piped/spawned commands already auto-produce JSON — remove `--raw` from test invocations
- This is a single harness fix, not 243 individual test fixes
- All 243 tests should pass after the harness fix (if not, investigate individually)

### Format utility test depth
- Cover the use cases described in the Phase 30 spec — not exhaustive edge case hunting
- Test the documented behaviors: formatTable rendering, color auto-disable, progressBar output, banner/box rendering, SYMBOLS constants, truncation, relativeTime
- Match tests to what the formatting utilities are actually used for

### Test organization
- Agent's discretion on file structure — separate file or same file, whatever is most functional
- Tests must NOT be included in the package — pre-release only
- Testing is a development activity, not shipped artifact

### Agent's Discretion
- Test file structure (separate `format.test.cjs` vs extending existing test file)
- Exact assertion style (string matching, regex, structural checks)
- Whether to use snapshot-style output comparison or behavioral assertions

</decisions>

<specifics>
## Specific Ideas

- The 243 failures are almost certainly all the same root cause — verify this assumption early, then fix the harness
- If any tests fail for a different reason after the harness fix, those are the actual "v5.0 broken tests" to investigate individually

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-quality-gates-format-testing*
*Context gathered: 2026-02-26*
