# Phase 37: Foundation & Safety Net - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a safety net of contract tests, enhanced git commands, and pre-commit checks that catches regressions before feature work touches output. All existing 574+ tests continue passing with zero regressions. Restore, search, and other new capabilities are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Contract test snapshots
- Hybrid approach: field-level contracts for most outputs (required keys + types), full output snapshots for critical outputs
- Critical outputs deserving full snapshots: `init phase-op` and `state read` — the two most consumed JSON outputs that agents depend heavily on
- All other command outputs get field-level contracts — tests that specific fields exist with expected types, allowing new fields to be added freely while catching removals/renames
- Snapshot fixture files co-located with tests (e.g., `test/__snapshots__/`)

### Git command output shape
- Structured log output includes core fields + file stats: hash, author, date, message, plus files changed / insertions / deletions per commit (no full diff content)
- Blame command focused on "who changed this line" — mapping lines to commits/authors for understanding file history

### Pre-commit check strictness
- Checks run within gsd-tools.cjs commit commands, not as git hooks — only applies to bGSD operations, not raw git
- Bypass available via `--force` flag for emergency situations
- Don't verify file existence — trust the caller, let git handle file errors; checks focus on repo state only (dirty tree, active rebase, detached HEAD, shallow clone)

### Failure messaging & DX
- Contract test failures show diff-style output: expected vs actual with a visual diff so you immediately see what changed
- Pre-commit block messages are terse + fix command: one line stating what's wrong and how to fix (e.g., "Dirty tree detected. Stash or commit changes first.")
- Distinct exit codes for different failure types: contract failures vs pre-commit blocks vs general errors, so scripts can branch on them
- Multiple pre-commit failures report all at once — run all checks, show every failure together so developer can fix everything in one pass

### Agent's Discretion
- Snapshot update mechanism (manual command vs inline flag)
- Git command output format convention (JSON vs human-readable defaults)
- Git command path scoping defaults (whole repo vs .planning/)
- Pre-commit severity tiers (which checks hard-block vs warn)
- Compression algorithm and temp file handling for git operations

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

*Phase: 37-foundation-safety-net*
*Context gathered: 2026-02-27*
