---
phase: 0131-skill-discovery-security
plan: 01
subsystem: cli
tags: [javascript, security, skills, scanner]
provides:
  - "41-pattern security scanner covering Code Execution, Network Access, Filesystem Ops, Process/System, Crypto Mining, Data Exfiltration, and Prompt Injection"
  - "skills:list command — reads .agents/skills/ with name + description + scan status"
  - "skills:validate command — re-scans installed skill with full severity-first findings report"
  - "formatScanResults with category checklist, severity-first grouping, and block message"
affects:
  - "0131-02 (skills:install) — depends on scanSkillFiles as install gatekeeper"
  - "0131-03 (router wiring) — depends on cmdSkillsList + cmdSkillsValidate exports"
  - "0131-04 (bgsd-context) — depends on skills:list output shape"
tech-stack:
  added: []
  patterns:
    - "Security pattern table: { id, category, severity, pattern (RegExp), description } for extensible scanner"
    - "Severity-first output: dangerous findings before warn, category checklist with ✓/✗ marks"
    - "Hard block on dangerous: no force/trust override — verdict === 'dangerous' means no install"
key-files:
  created: [src/commands/skills.js]
  modified: []
key-decisions:
  - "41 patterns exactly — trimmed from initial 45 by removing fs.appendFile, dgram, encodeURIComponent+http, and </system> (redundant with <system>)"
  - "scanSkillFiles returns structured result with verdict + findings array + summary counts — clean contract for all consumers"
  - "formatScanResults receives (scanResult, verbose) — callers decide verbosity, function stays pure"
  - "Empty skills dir and missing SKILL.md both handled gracefully with no hints per CONTEXT.md"
patterns-established:
  - "Skills scanner pattern: collectFiles recursively → line-by-line pattern match → severity-first output"
requirements-completed: [SKILL-01, SKILL-03, SKILL-06]
one-liner: "41-pattern security scanner + skills:list + skills:validate in src/commands/skills.js with severity-first findings and hard block on dangerous patterns"
duration: 12min
completed: 2026-03-15
---

# Phase 131 Plan 01: Skill Security Scanner & Discovery Commands Summary

**41-pattern security scanner + skills:list + skills:validate in src/commands/skills.js with severity-first findings and hard block on dangerous patterns**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-15T20:24:48Z
- **Completed:** 2026-03-15T20:36:48Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Created `src/commands/skills.js` with `SECURITY_PATTERNS` array (41 patterns across 7 categories: Code Execution, Network Access, Filesystem Ops, Process/System, Crypto Mining, Data Exfiltration, Prompt Injection)
- Implemented `scanSkillFiles(skillDir)` with line-by-line matching and `formatScanResults(scanResult, verbose)` with severity-first grouping, category checklist, count summary, and hard-block message for dangerous findings
- Added `cmdSkillsList` (reads `.agents/skills/`, shows name + description + scan status, graceful empty state) and `cmdSkillsValidate` (re-scans installed skill with full report, errors on missing skill/SKILL.md)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create skills.js with security scanner and skills:list** - `8a3bd2b` (feat)
2. **Task 2: Add skills:validate command** - `c3b20f3` (feat)

## Files Created/Modified

- `src/commands/skills.js` - Skills command module: SECURITY_PATTERNS (41), scanSkillFiles, formatScanResults, cmdSkillsList, cmdSkillsValidate

## Decisions Made

- **41 patterns exactly**: Initial implementation had 45 patterns. Trimmed to 41 by removing: `fs.appendFile` (less impactful than other fs ops), `dgram` (rare in skill files), `encodeURIComponent.*http` (too broad/noisy), and `</system>` (redundant — `<system>` already catches the open-tag injection attempt).
- **Hard block, no override**: Per CONTEXT.md, dangerous verdict means no install — no `--force` or `--trust` flag exists and none will be added.
- **Pure formatScanResults**: Takes (scanResult, verbose) and returns a string — no side effects. Callers (validate, install) control when/how to print.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- `scanSkillFiles`, `formatScanResults`, `cmdSkillsList`, and `cmdSkillsValidate` are all exported and ready for Plan 02 (skills:install) and Plan 03 (router wiring)
- Scanner is the install gatekeeper — Plan 02 will call `scanSkillFiles` on fetched skill files before writing anything to disk
- No blockers

## Self-Check: PASSED

- ✓ `src/commands/skills.js` exists
- ✓ Task 1 commit `8a3bd2b` found
- ✓ Task 2 commit `c3b20f3` found
- ✓ SUMMARY.md created at `.planning/phases/0131-skill-discovery-security/0131-01-SUMMARY.md`
- ✓ All 5 exports verified: `SECURITY_PATTERNS` (41), `scanSkillFiles`, `formatScanResults`, `cmdSkillsList`, `cmdSkillsValidate`

---
*Phase: 0131-skill-discovery-security*
*Completed: 2026-03-15*
