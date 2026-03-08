---
name: deviation-rules
description: Auto-fix decision framework for handling unexpected issues during execution — classifying bugs, missing functionality, blocking issues, and architectural changes with clear rules for when to fix automatically vs escalate to the user.
type: shared
agents: [executor, github-ci]
sections: [executor, github-ci]
---

## Purpose

During plan execution, agents discover work not in the plan. This skill provides the decision framework for classifying each deviation and determining whether to auto-fix (Rules 1-3) or escalate (Rule 4). All deviations are tracked for SUMMARY.md documentation regardless of classification.

## Placeholders

| Placeholder | Description | Example |
|---|---|---|

## Content

<!-- section: executor -->
### Executor Deviation Rules

**Shared process for Rules 1-3:** Fix inline, add/update tests if applicable, verify fix, continue task, track as `[Rule N - Type] description`. No user permission needed.

---

**RULE 1: Auto-fix bugs**

**Trigger:** Code doesn't work as intended (broken behavior, errors, incorrect output)

**Examples:** Wrong queries, logic errors, type errors, null pointer exceptions, broken validation, security vulnerabilities, race conditions, memory leaks

---

**RULE 2: Auto-add missing critical functionality**

**Trigger:** Code missing essential features for correctness, security, or basic operation

**Examples:** Missing error handling, no input validation, missing null checks, no auth on protected routes, missing authorization, no CSRF/CORS, no rate limiting, missing DB indexes, no error logging

**Critical = required for correct/secure/performant operation.** These aren't "features" — they're correctness requirements.

---

**RULE 3: Auto-fix blocking issues**

**Trigger:** Something prevents completing the current task

**Examples:** Missing dependency, wrong types, broken imports, missing env var, DB connection error, build config error, missing referenced file, circular dependency

---

**RULE 4: Ask about architectural changes**

**Trigger:** Fix requires significant structural modification

**Examples:** New DB table (not column), major schema changes, new service layer, switching libraries/frameworks, changing auth approach, new infrastructure, breaking API changes

**Action:** STOP. Return checkpoint with: what was found, proposed change, why needed, impact, alternatives. User decision required.

---

### Priority and Edge Cases

1. Rule 4 applies -> STOP (architectural decision)
2. Rules 1-3 apply -> Fix automatically
3. Genuinely unsure -> Rule 4 (ask)

**Edge case guidance:**
- Missing validation -> Rule 2 (security/correctness)
- Crashes on null -> Rule 1 (bug)
- Need new table -> Rule 4 (architectural)
- Need new column -> Rule 1 or 2 (depends on context)

**Decision test:** "Does this affect correctness, security, or ability to complete the task?" YES -> Rules 1-3. MAYBE -> Rule 4.

### Scope Boundary

Only auto-fix issues DIRECTLY caused by the current task's changes. Pre-existing warnings, linting errors, or failures in unrelated files are out of scope.

- Log out-of-scope discoveries to `deferred-items.md` in the phase directory
- Do NOT fix them
- Do NOT re-run builds hoping they resolve themselves

### Fix Attempt Limit

Track auto-fix attempts per task. After 3 attempts on a single task:
- STOP fixing — document remaining issues in SUMMARY.md under "Deferred Issues"
- Continue to next task (or return checkpoint if blocked)
- Do NOT restart the build to find more issues

<!-- section: github-ci -->
### CI Agent Deviation Rules

When CI checks fail, classify and handle each failure:

**RULE 1: Auto-fix simple true positives**
**Trigger:** Low-complexity code scanning alert with clear fix
**Examples:** Unused imports, missing input sanitization (simple cases), hardcoded test credentials
**Action:** Fix inline, commit, repush, track as `[Rule 1 - True Positive]`

**RULE 2: Auto-fix build/lint/test failures**
**Trigger:** Non-scanning check failure (build error, lint error, test failure)
**Examples:** TypeScript error, ESLint violation, failing test from code change
**Action:** Read error output, attempt fix, commit, repush, track as `[Rule 2 - Build/Lint/Test]`

**RULE 3: Dismiss false positives (low severity)**
**Trigger:** Note/warning severity alert that's clearly a false positive
**Examples:** Alert in test file, pattern match on variable name, vendored code
**Action:** Dismiss via API with reasoning, track as decision `[Rule 3 - False Positive]`

**RULE 4: Escalate to user**
**Trigger:** Medium+ severity suspected false positive, or complex fix requiring architectural changes
**Examples:** Alert requiring new DB table, alert suggesting library replacement, ambiguous security finding
**Action:** STOP. Return CHECKPOINT REACHED with alert details and recommendations.

**Priority:** Rule 4 (STOP) > Rule 3 (dismiss) > Rules 1-2 (fix) > Unsure -> Rule 4

**Fix attempt limit:** After `MAX_FIX_ITERATIONS` attempts, return checkpoint with remaining issues.

**Scope boundary:** Only fix issues reported by CI checks. Do not proactively fix pre-existing issues in touched files.

### Documentation in SUMMARY.md

For each deviation, document:
- Rule number and category
- Found during which task
- Issue description
- Fix applied
- Files modified
- Verification method
- Committed in which hash

If no deviations: "None — plan executed exactly as written."

## Cross-references

- <skill:checkpoint-protocol /> — Rule 4 escalation triggers a checkpoint
- <skill:commit-protocol /> — Deviation fixes are committed as part of task commits

## Examples

**Documenting an auto-fix in SUMMARY:**
```markdown
### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added password hashing with bcrypt**
- **Found during:** Task 2 (Login endpoint implementation)
- **Issue:** Plan didn't specify password hashing — storing plaintext would be critical security flaw
- **Fix:** Added bcrypt hashing on registration, comparison on login with salt rounds 10
- **Files modified:** src/app/api/auth/login/route.ts, src/lib/auth.ts
- **Verification:** Password hash test passes, plaintext never stored
- **Committed in:** abc123f (Task 2 commit)
```

**CI agent classifying an alert:**
```
Alert #42: js/sql-injection in src/api/users.ts:15
  Severity: high
  Classification: true_positive
  Reasoning: User input concatenated directly into SQL query string
  Action: Rule 1 — auto-fix with parameterized query
```
