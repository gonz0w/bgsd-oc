# Phase 148: Review Readiness & Release Pipeline - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

## Phase Boundary
This phase delivers an advisory pre-ship readiness check plus a single release workflow that can propose a version bump, generate changelog content, create a tag, and open a PR. It clarifies how readiness should be presented, how release decisions should be previewed and confirmed, and how failures should recover, without expanding into broader release management capabilities.

## Implementation Decisions

### Readiness Output
- Default the human-readable readiness view to a terse, glanceable board first.
- Reasoning: the initial preference was a balanced summary, but the stress test exposed the risk of explanation-heavy output becoming noisy. The revised direction keeps the dashboard useful at a glance instead of turning it into a mini report.

### Check Handling
- Missing or unconfigured checks should always show as explicit `skip` with a reason; only checks that actually run and fail should count as `fail`.
- Reasoning: the earlier mixed-rule idea felt too easy to mistrust because users would need to internalize hidden policy. A universal skip rule for unavailable checks keeps the output honest, predictable, and clearly advisory-only.

### Version Bump Rules
- Use conventional commits as the primary source for automatic semver bumping. If history is unusually messy or ambiguous, fall back conservatively to a patch suggestion with manual override support.
- Reasoning: the user expects agent-generated conventional commits to keep history clean most of the time, so ambiguous history is an exception path rather than the norm. The conservative fallback is a safety net, not the default operating mode.

### Changelog Style
- Generate a hybrid changelog that is readable for users while still grouped and structured enough for maintainers.
- Reasoning: the user wants release notes to serve both audiences instead of becoming either purely operator shorthand or polished marketing copy.

### Release Confirmations
- Run the workflow in dry-run by default and use a single explicit confirmation gate before any git mutations.
- The dry-run preview should show the release essentials: proposed version bump, changelog summary, tag name, and target PR details.
- Reasoning: one gate preserves speed, but the preview must still give enough release-specific context for the confirmation to be meaningful.

### Failure Recovery
- On partial failure, prefer safe cleanup only, then provide a clear resume path from the next safe step.
- Reasoning: the user wants resilience without magical rollback behavior. Limiting rollback to obviously safe cleanup avoids silently rewriting meaningful content changes while still making recovery smoother.

### Agent's Discretion
- Exact structure and styling details for the terse readiness board, as long as it remains glanceable and advisory-first.
- Exact definition of what qualifies as an unusually messy semver history before the conservative fallback is used.
- Exact user-vs-maintainer balance within the hybrid changelog, as long as the output stays grouped and readable.
- Exact resume UX and checkpoint mechanics after safe cleanup.

## Specific Ideas
- The user explicitly expects agent-generated conventional commits to keep release history clean in normal operation.
- The single confirmation preview should stay focused on release essentials rather than a full operational checklist.

## Stress-Tested Decisions
- Original decision: default to a balanced summary with reason lines for failing or skipped checks.
  Stress-test revision: switch to a terse, glanceable board-first default.
  Follow-on clarification: reasons should be secondary detail, not always expanded inline.
- Original decision: use a mixed fail-vs-skip policy for missing checks, with the exact boundary left to agent discretion.
  Stress-test revision: missing or unconfigured checks always become explicit `skip` entries with reasons.
  Follow-on clarification: only executed failing checks count as `fail`.
- Conservative semver fallback held under stress, but with clarified framing: it is an exception-path safety net because agent-generated conventional commits should normally keep history clean.
- Single confirmation gate held under stress, with added clarification that the dry-run preview only needs release essentials: bump, changelog summary, tag, and PR details.
- Original decision: rollback then resume after partial failures.
  Stress-test revision: restrict rollback to safe cleanup only, then provide resume guidance.
  Follow-on clarification: avoid automatically rewriting meaningful content edits like version or changelog changes unless cleanup is obviously safe.

## Deferred Ideas
None - discussion stayed within phase scope.

---
*Phase: 148-review-readiness-release-pipeline*
*Context gathered: 2026-03-28*
