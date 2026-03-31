# Phase 146: Code Review Workflow - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary
This phase delivers a single-command code review workflow for code changes: a scan step that produces structured findings, silent fixes for safe mechanical issues, batched user questions for judgment calls, and project-local false-positive suppression. It does not add new review capabilities beyond that workflow boundary.
</domain>

<decisions>
## Implementation Decisions

### Scan Scope
- Default review target is the staged diff so the workflow matches the change set the user actually intends to ship.
- If nothing is staged, the workflow should prompt for a review target instead of failing or guessing, because preserving momentum matters more than forcing a restart.
- The fallback prompt should prioritize commit-range review rather than file-path review because that maps better to the upcoming Jujutsu workspace and operation-log model.
- If untracked files are present, the workflow should ask whether to include them so important brand-new work is not missed.
- Stress-tested revision: even with staged diff as the default, the workflow should warn when nearby unstaged or untracked changes suggest the review scope may be incomplete.

### Auto-Fix Rules
- Initial preference was to auto-fix any finding that clears the confidence gate, with the confidence threshold acting as the safety boundary.
- Stress-tested revision: silent fixes should be limited to clearly mechanical changes; if there is real debate about whether a fix is mechanical, it becomes ASK instead of AUTO-FIX.
- Failed silent fixes should downgrade to ASK rather than aborting the workflow, so one messy patch does not discard the rest of the review.
- After silent fixes apply, the user should see only a concise summary; detailed diffs can be inspected separately if needed.

### Question Batching
- ASK findings should be grouped by theme rather than by file or in one giant batch, because that creates a cleaner user experience around decision types instead of implementation details.
- Each themed batch should include both the decision being requested and the supporting evidence, so users can override recommendations intelligently without extra context switching.
- Even inside a theme, users should answer each finding separately because similar findings can still require different judgment calls.
- Unanswered ASK findings should remain unresolved instead of blocking the workflow, which preserves momentum while honestly signaling open review questions.

### Review Output
- The end result should feel like a structured report rather than a narrative review so expectations stay consistent and systematic.
- The main report should be organized by severity buckets, not just AUTO-FIX / ASK / INFO classes, so the user's attention goes to the most important issues first.
- Confidence scores stay internal; surfacing them would create false precision in the user-facing review.
- A clean review should end quietly rather than with a loud success banner, to avoid overstating certainty.

### Exclusion Policy
- Any user may add exclusions because suppressing false positives should stay low-friction within normal workflow use.
- Exclusions should target rule-plus-path combinations rather than exact fingerprints or path-only ignores, because that stays stable as code shifts without becoming too broad.
- Each exclusion must include a reason, but not author or expiry metadata, to keep the file simple while still capturing enough intent.
- Matched exclusions stay hidden from live review output so suppressed noise does not distract from active review results.

### Agent's Discretion
- Exact wording and presentation of prompts, warnings, and report sections can follow existing bGSD conventions as long as the decisions above stay intact.
- The planner can choose the concrete schema details for review JSON and exclusion file shape, provided they preserve staged-first review, mechanical-only silent fixes, themed ASK batching, severity-led output, and rule-plus-path exclusions with reasons.
</decisions>

<specifics>
## Specific Ideas
- Review defaults should assume a Git-centric workflow today, but should not lock out a later shift to Jujutsu workspaces and operation-log-driven review targets.
- Commit-range review is the preferred fallback concept when staged changes are absent.
- Quiet success is important: avoid big "all clear" language that implies more certainty than the review engine can justify.
</specifics>

<stress_tested>
## Stress-Tested Decisions
- Silent auto-fixes were narrowed during stress testing: behavioral or debatable fixes should not apply silently; ambiguity routes to ASK.
- Staged-diff review survived as the default, but the workflow should warn when adjacent unstaged or untracked changes may make the review incomplete.
- Exclusions remained intentionally low-friction and hidden in the live report; the exclusions file itself is treated as the audit surface.
</stress_tested>

<deferred>
## Deferred Ideas
None - discussion stayed within phase scope.
</deferred>

---
*Phase: 146-code-review-workflow*
*Context gathered: 2026-03-28*
