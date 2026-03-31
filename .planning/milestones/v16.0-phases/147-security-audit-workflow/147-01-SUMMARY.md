---
phase: 147-security-audit-workflow
plan: 01
subsystem: security
tags: [security, cli, exclusions, owasp]
requires:
  - phase: 146-code-review-workflow
    provides: scan-first CLI architecture, confidence-gated findings, and auditable exclusion patterns
provides:
  - security:scan CLI entrypoint with deterministic JSON and severity-led TTY output
  - shared security finding schema with explicit confidence bands and verification metadata
  - finding-level security exclusions with required reason and expiry handling
affects: [phase-147-security-audit-workflow, security-workflow, review-readiness]
tech-stack:
  added: []
  patterns: [normalized multi-engine security schema, exact finding-level suppression with expiry audit]
key-files:
  created: [src/commands/security.js, src/lib/security/config.js, src/lib/security/schema.js, src/lib/security/scan.js, src/lib/security/exclusions.js, tests/security.test.cjs]
  modified: [src/router.js, src/lib/constants.js, src/lib/command-help.js, bin/bgsd-tools.cjs, plugin.js]
key-decisions:
  - "security:scan emits one normalized finding contract with severity, confidence band, rationale, next step, and verification metadata"
  - "security exclusions match exact rule_id plus normalized path and optional fingerprint, require reason and expires_at, and warn when expired"
patterns-established:
  - "Security engines normalize findings before suppression so workflow stages can consume one stable JSON shape"
  - "Low-confidence findings are suppressed centrally while high and medium findings remain explicit in the contract"
requirements-completed: [SEC-04, SEC-05]
one-liner: "security:scan CLI foundation with shared finding schema, confidence bands, and auditable finding-level exclusions"
duration: 9 min
completed: 2026-03-28
---

# Phase 147 Plan 01: Establish the CLI surface, shared finding contract, and auditable exclusion plumbing for Phase 147 Summary

**security:scan CLI foundation with shared finding schema, confidence bands, and auditable finding-level exclusions**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-28T21:05:31Z
- **Completed:** 2026-03-28T21:15:18Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added a routed `security:scan` CLI surface with help text plus JSON/TTY output wiring.
- Established shared security config and normalized finding schema helpers with explicit `high`/`medium`/`low` confidence bands.
- Implemented exact finding-level exclusion loading with expiry warnings and locked the CLI contract with focused subprocess tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the security command surface and shared config/schema helpers** - `59093f9` (feat)
2. **Task 2: Implement the scan coordinator scaffold and exact security exclusion matching** - `09bf0d6` (feat)
3. **Task 3: Add CLI-contract tests for security schema, confidence bands, and exclusions** - `e41005c` (test)

**Plan metadata:** Recorded in the final documentation commit for this plan.

## Files Created/Modified

- `src/commands/security.js` - `security:scan` command contract and severity-led formatter.
- `src/lib/security/config.js` - security confidence threshold defaults and exclusions path loading.
- `src/lib/security/schema.js` - normalized finding shape, confidence-band logic, and deterministic sorting/formatting helpers.
- `src/lib/security/scan.js` - scan coordinator scaffold, target resolution, normalization, exclusion pass, and confidence-band suppression.
- `src/lib/security/exclusions.js` - exact finding-level exclusion loader with required reason/expiry validation and expired-entry handling.
- `src/router.js` - security namespace routing.
- `src/lib/constants.js` - `security:scan` help text.
- `src/lib/command-help.js` - command catalog wiring for discovery/help surfaces.
- `tests/security.test.cjs` - CLI-contract coverage for schema normalization, confidence bands, exclusions, and pretty/help output.
- `bin/bgsd-tools.cjs` - rebuilt bundled CLI.
- `plugin.js` - rebuilt plugin bundle carrying the new command help surface.

## Decisions Made

- Reused the Phase 146 scan-first pattern so deterministic CLI findings remain the source of truth for later `/bgsd-security` workflow orchestration.
- Modeled confidence as explicit bands layered on top of numeric scores so the phase keeps the 0.8 high-confidence gate while still surfacing labeled medium-confidence findings.
- Required exact finding identity plus expiry-aware exclusions to keep false-positive suppression narrow and auditable.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm test -- tests/security.test.cjs` expands to the full repository test script in this workspace, so focused verification used `npm run test:file -- --test-force-exit tests/security.test.cjs` to validate the new security contract directly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 147 now has a stable `security:scan` contract for OWASP, secrets, and dependency engines to emit into without reinventing output shape or suppression behavior.
- Later plans can add real detector engines and `/bgsd-security` workflow orchestration on top of this foundation while preserving auditability.

## Self-Check: PASSED

- Found `.planning/phases/147-security-audit-workflow/147-01-SUMMARY.md`
- Found `src/commands/security.js`, `src/lib/security/exclusions.js`, and `tests/security.test.cjs`
- Found task commits `59093f9`, `09bf0d6`, and `e41005c`

---
*Phase: 147-security-audit-workflow*
*Completed: 2026-03-28*
