---
phase: 20-structured-requirements
verified: 2026-02-25T17:29:14Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 20: Structured Requirements Verification Report

**Phase Goal:** Requirements carry testable acceptance criteria that flow through planning into verification, closing the loop between "what we said" and "what we proved"
**Verified:** 2026-02-25T17:29:14Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Truths derived from ROADMAP.md Success Criteria:

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each requirement in REQUIREMENTS.md has 2-5 indented assertion bullets that are specific and testable (template enforced) | ✓ VERIFIED | `templates/assertions.md` (94 lines) defines schema with `- assert:` format, `when`/`then`/`type`/`priority` fields, guidelines for 2-5 assertions per requirement. `assertions validate` enforces 2-5 range. REQUIREMENTS.md template references ASSERTIONS.md in guidelines. |
| 2 | Traceability table includes test-command column; `verify requirements` confirms test commands exist and reports coverage percentage | ✓ VERIFIED | `templates/requirements.md` line 57-63: traceability table template has `Test Command` column. `src/commands/verify.js` line 1011: regex parses 4-column table. Lines 1069-1082: `testCommands` object tracks `total`, `valid`, `invalid`, `coverage_percent`. Known-commands check against 14 base commands. |
| 3 | Phase verifier reads structured assertions from REQUIREMENTS.md and reports per-assertion pass/fail (not just requirement-level) | ✓ VERIFIED | `src/commands/verify.js` lines 1085-1203: `cmdVerifyRequirements` loads ASSERTIONS.md, calls `parseAssertionsMd()`, iterates per-assertion with `type`-based checking (file→disk check, cli→command lookup, behavior/api→needs_human). Output includes `assertions.by_requirement[reqId].assertions[].status` with pass/fail/needs_human. `gap_description` generated for failed must-haves (line 1180). 8 tests verify this behavior. |
| 4 | Plan `must_haves.truths` in YAML frontmatter are auto-populated from mapped requirements' assertions during planning | ✓ VERIFIED | `workflows/plan-phase.md` line 79: Step 7 checks ASSERTIONS.md existence. Line 88-94: Step 8.5 surfaces assertion count via `assertions list --req`. Line 109: Step 9 planner prompt instructs "use must-have assertions as source for must_haves.truths in PLAN.md frontmatter." Line 64: Researcher also assertion-aware. |

**Score:** 4/4 truths verified

### Required Artifacts

**Plan 01 Artifacts:**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `templates/assertions.md` | ASSERTIONS.md template with schema, guidelines, examples | ✓ VERIFIED (94 lines) | Schema defines assert/when/then/type/priority fields. Includes examples for SREQ-01 and ENV-01. Has Assertion → Plan Flow section and Migration guidance. |
| `src/commands/verify.js` | parseAssertionsMd + cmdAssertionsList + cmdAssertionsValidate | ✓ VERIFIED (2023 lines) | `parseAssertionsMd` at line 1945 (57 lines, compact). `cmdAssertionsList` at line 1809. `cmdAssertionsValidate` at line 1853. All exported at line 2020-2022. |
| `src/router.js` | Assertions CLI routing | ✓ VERIFIED | Line 30: imports `cmdAssertionsList, cmdAssertionsValidate`. Line 749-761: `case 'assertions'` with `list` and `validate` subcommands. Line 125: `assertions` in usage string. |

**Plan 02 Artifacts:**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/commands/verify.js` | Enhanced cmdVerifyRequirements with per-assertion checking | ✓ VERIFIED | Lines 1085-1203: full per-assertion verification with file/cli/behavior type dispatch, coverage_percent, must_have_pass/fail, gap_description for failed must-haves. Backward compatible (line 1213: assertions only added when present). |
| `src/commands/features.js` | Enhanced cmdTraceRequirement with assertion chain | ✓ VERIFIED | Line 9: imports `parseAssertionsMd`. Lines 932-996: loads ASSERTIONS.md, cross-references with plan truths (fuzzy 30-char matching), builds chain field. Outputs assertions, assertion_count, must_have_count, chain. |

**Plan 03 Artifacts:**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `workflows/plan-phase.md` | Updated planner spawn with assertion reading | ✓ VERIFIED | 4 ASSERTIONS.md references: researcher (line 64), Step 7 path discovery (line 79), Step 8.5 surfacing (line 92), planner prompt (line 109). 12 net new lines. |
| `templates/requirements.md` | Updated template with assertion reference and test-command column | ✓ VERIFIED | Lines 104-108: Structured Assertions guidelines. Line 124: evolution step 4 for ASSERTIONS.md updates. Lines 57-63: traceability table with Test Command column (template and example). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/commands/verify.js` | `src/lib/helpers.js` | `require('../lib/helpers')` | ✓ WIRED | Line 6: imports safeReadFile, findPhaseInternal, etc. |
| `src/router.js` | `src/commands/verify.js` | `cmdAssertionsList, cmdAssertionsValidate` | ✓ WIRED | Line 30: imports both. Lines 753, 757: called in assertions case. |
| `src/commands/features.js` | `src/commands/verify.js` | `parseAssertionsMd` import | ✓ WIRED | Line 9: `const { parseAssertionsMd } = require('./verify')`. Line 935: called to parse assertions. |
| `src/commands/verify.js` internal | `parseAssertionsMd` | internal call in cmdVerifyRequirements | ✓ WIRED | Line 1088: `parseAssertionsMd(assertionsContent)` called inside cmdVerifyRequirements. |
| `workflows/plan-phase.md` | `templates/assertions.md` | planner reads assertion file | ✓ WIRED | Line 79: sets assertions_path. Line 92: runs `assertions list`. Line 109: planner prompt reads ASSERTIONS.md. |
| `src/lib/constants.js` | `assertions` help entries | COMMAND_HELP | ✓ WIRED | Lines 940-983: help entries for `assertions`, `assertions list`, `assertions validate`. |
| `bin/gsd-tools.cjs` (bundle) | all source files | build output | ✓ WIRED | Built bundle at 518KB contains parseAssertionsMd (line 5178), assertion commands, assertion routing. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SREQ-01 | 20-01 | Requirements template includes structured acceptance criteria | ✓ SATISFIED | `templates/assertions.md` defines schema (94 lines). `parseAssertionsMd()` parses it. `assertions list/validate` provide CLI access. 13 tests. |
| SREQ-02 | 20-03 | New-milestone and new-project workflows generate structured requirements | ✓ SATISFIED | `workflows/plan-phase.md` instructs planner to read ASSERTIONS.md and auto-derive must_haves. `templates/requirements.md` references assertion system for new projects. Step 8.5 surfaces assertions before planning. |
| SREQ-03 | 20-02 | Traceability table maps requirements to test commands | ✓ SATISFIED | Traceability regex (line 1011) parses 4-column table with test-command. Test command validity checked against 14 known commands. Coverage percent reported. Template updated with Test Command column. |
| SREQ-04 | 20-02 | Phase verifier checks structured assertions, not just requirement text | ✓ SATISFIED | cmdVerifyRequirements iterates per-assertion (lines 1085-1203). Type-based verification: file→disk, cli→command list, behavior/api→needs_human. Per-assertion status in output. Failed must-have gap_description for --gaps workflow. 8 tests. |
| SREQ-05 | 20-03 | Plan must_haves derive from structured acceptance criteria | ✓ SATISFIED | Planner prompt (line 109): "use must-have assertions as source for must_haves.truths." Fallback to requirement text when no assertions. Assertion → Plan Flow documented in template (lines 76-84). |

No orphaned requirements — all 5 SREQ requirements mapped to plans and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/commands/verify.js` | 1946 | `return {}` in parseAssertionsMd | ℹ️ Info | Valid guard for null/empty content — not a stub. Returns empty map allowing graceful degradation. |

No blocker or warning-level anti-patterns found. No TODO/FIXME/PLACEHOLDER comments. No empty handlers or console.log-only implementations.

### Human Verification Required

### 1. Planner actually populates must_haves.truths from assertions

**Test:** Run `/gsd-plan-phase` on a phase that has assertions in ASSERTIONS.md.
**Expected:** The generated PLAN.md has must_haves.truths entries that correspond to the must-have assertions from ASSERTIONS.md.
**Why human:** Requires running the full planner agent workflow. Static analysis confirms the prompt instructs assertion reading, but agent behavior can't be verified programmatically.

### 2. Behavioral assertion verification quality

**Test:** Create ASSERTIONS.md with type:behavior assertions and run `verify requirements`.
**Expected:** Behavior assertions correctly return `needs_human` status, file assertions correctly detect disk presence, cli assertions match against command list.
**Why human:** The file-type path extraction regex (`[\w./-]+\.\w{1,10}`) may miss edge cases. Needs real-world testing with diverse assertion texts.

### 3. Gap description → plan workflow integration

**Test:** Run `verify requirements` with failing must-have assertions, then use `--gaps` flag in `/gsd-plan-phase`.
**Expected:** Gap descriptions from failed assertions flow into the gap closure planning workflow.
**Why human:** Requires end-to-end workflow testing across multiple commands.

### Gaps Summary

**No gaps found.** All 4 success criteria are verified against actual codebase evidence:

1. **Template & Parser**: ASSERTIONS.md template (94 lines) defines the assertion schema with all specified fields. parseAssertionsMd (57 lines) parses it correctly. assertions validate enforces 2-5 assertions per requirement.

2. **Traceability & Test Commands**: Traceability table regex captures 4-column format with test-command. verify requirements checks command validity and reports coverage_percent. Template includes Test Command column.

3. **Per-Assertion Verification**: cmdVerifyRequirements provides per-assertion pass/fail/needs_human with type-based dispatch (file→disk check, cli→command lookup). Output includes by_requirement breakdown with individual assertion status and evidence.

4. **Planner Integration**: plan-phase.md workflow wires ASSERTIONS.md reading into researcher, Step 8.5 surfacing, and planner prompt. Planner instructed to derive must_haves.truths from assertions with graceful fallback.

**Test Coverage**: 462 tests pass (26 new tests: 13 for assertions commands, 8 for verify requirements with assertions, 5 for trace-requirement with assertions). Bundle at 518KB within 525KB budget.

---

_Verified: 2026-02-25T17:29:14Z_
_Verifier: AI (gsd-verifier)_
