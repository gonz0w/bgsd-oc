---
phase: 147-security-audit-workflow
plan: 03
subsystem: security
tags: [security, secrets, osv, dependencies, owasp]
requires:
  - phase: 147-security-audit-workflow
    provides: shared OWASP scan contract and exclusion pipeline from plan 02
provides:
  - repo-wide secret scanning with redaction and finding fingerprints
  - advisory-backed dependency findings with evidence-quality confidence
  - unified multi-engine severity-led security reporting
affects: [bgsd-security, readiness, security scan output]
tech-stack:
  added: [OSV query integration via Node fetch subprocess]
  patterns: [finding-specific secret suppression, evidence-quality dependency confidence, multi-engine security report]
key-files:
  created: [src/lib/security/engines/secrets.js, src/lib/security/engines/dependencies.js]
  modified: [src/lib/security/config.js, src/lib/security/scan.js, src/lib/security/schema.js, src/commands/security.js, tests/security.test.cjs, bin/bgsd-tools.cjs]
key-decisions:
  - "Secrets use hashed finding fingerprints plus redacted evidence so suppressions stay narrow and auditable."
  - "Dependency findings prefer resolved lockfile evidence, downgrade manifest-only ranges, and accept fixture-backed advisory data for deterministic tests."
  - "TTY security output stays severity-led while retaining engine/category context and next-step guidance."
patterns-established:
  - "Security engines emit one normalized finding schema before exclusions and confidence routing."
  - "Dependency confidence follows evidence quality: resolved > pinned > range-only."
requirements-completed: [SEC-02, SEC-03, SEC-04]
one-liner: "Secrets scanning, advisory-backed dependency checks, and one severity-led security report with explicit confidence labels"
duration: 14 min
completed: 2026-03-28
---

# Phase 147 Plan 03: Security Audit Workflow Summary

**Secrets scanning, advisory-backed dependency checks, and one severity-led security report with explicit confidence labels**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-28T21:29:14Z
- **Completed:** 2026-03-28T21:43:48Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Added repo-wide secrets detection with provider-specific patterns, redacted evidence, and finding fingerprints for precise suppressions.
- Added dependency advisory scanning for package manifests with confidence shaped by lockfile, exact-pin, or range-only evidence quality.
- Unified OWASP, secrets, and dependency findings into one severity-led report with explicit confidence, rationale, and next-step guidance.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the secrets engine with redaction, allowlisting, and finding fingerprints** - `d45dd70` (feat)
2. **Task 2: Add the dependency engine with advisory lookups and evidence-quality confidence** - `ac229fd` (feat)
3. **Task 3: Integrate multi-engine confidence routing and severity-led action-first output** - `13b934f` (feat)

## Files Created/Modified
- `src/lib/security/engines/secrets.js` - Repo-wide secrets detector with redaction, confidence, and stable fingerprints.
- `src/lib/security/engines/dependencies.js` - Manifest and advisory matching engine with evidence-quality scoring.
- `src/lib/security/config.js` - Security config support for advisory backend and fixture overrides.
- `src/lib/security/scan.js` - Multi-engine orchestration across OWASP, secrets, and dependencies.
- `src/lib/security/schema.js` - Severity-led formatter with explicit engine/category context.
- `src/commands/security.js` - CLI output summary for combined findings.
- `tests/security.test.cjs` - Coverage for secrets, dependencies, and multi-engine report shaping.
- `bin/bgsd-tools.cjs` - Rebuilt bundled CLI artifact.

## Decisions Made
- Used SHA-256-based secret fingerprints derived from rule, path, line, and matched value so explicit exclusions remain finding-specific after file churn.
- Kept dependency evidence grading explicit: lockfile-backed matches surface as highest-confidence, exact manifest pins stay lower, and range-only matches remain warning-level with follow-up guidance.
- Supported fixture-backed advisory responses in config so dependency scanning remains deterministic in tests while still using OSV batch queries as the live backend path.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npm test -- tests/security.test.cjs` still runs the wider `tests/*.test.cjs` suite in this repo, so verification used targeted `node --test tests/security.test.cjs` during task execution and the explicit npm command at plan end for plan-contract parity.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `security:scan` now emits OWASP, secret, and dependency findings through one reusable contract for `/bgsd-security`.
- Phase 147 plan 04 can focus on workflow orchestration and verifier UX rather than CLI detection gaps.

## Self-Check

PASSED
- Verified summary and new engine files exist on disk.
- Verified task commits `d45dd70`, `ac229fd`, and `13b934f` exist in git history.

---
*Phase: 147-security-audit-workflow*
*Completed: 2026-03-28*
