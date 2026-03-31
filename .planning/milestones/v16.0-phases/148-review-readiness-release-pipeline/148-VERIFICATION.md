---
phase: 148-review-readiness-release-pipeline
verified: 2026-03-28T23:33:46Z
status: human_needed
score: 5/5
requirements_verified:
  - READY-01
  - READY-02
  - REL-01
  - REL-02
  - REL-03
  - REL-04
must_haves:
  truths:
    - "`review:readiness` returns deterministic advisory readiness JSON/TTY output covering tests, lint, review findings, security findings, TODOs in diff, and changelog status."
    - "Readiness output is advisory-only and does not block workflows."
    - "`release:bump` derives a semver recommendation from tag-bounded commit history and supports manual override."
    - "`release:changelog` drafts grouped release notes from plan summaries plus conventional commits without mutating repo state."
    - "`/bgsd-release` exists as a single dry-run-first workflow with one confirmation gate, resumable state, and github-ci handoff guidance."
  artifacts:
    - path: src/lib/review/readiness.js
    - path: src/commands/review.js
    - path: src/commands/release.js
    - path: src/lib/release/bump.js
    - path: src/lib/release/changelog.js
    - path: src/lib/release/mutate.js
    - path: src/lib/release/pr.js
    - path: src/lib/release/state.js
    - path: src/commands/init.js
    - path: commands/bgsd-release.md
    - path: workflows/release.md
    - path: tests/review-readiness.test.cjs
    - path: tests/release.test.cjs
    - path: tests/release-workflow.test.cjs
  key_links:
    - from: src/router.js
      to: src/commands/review.js
      via: review namespace routing
    - from: src/commands/review.js
      to: src/lib/review/readiness.js
      via: readiness command delegation
    - from: src/commands/release.js
      to: src/lib/release/bump.js
      via: release:bump routing
    - from: src/commands/release.js
      to: src/lib/release/changelog.js
      via: release:changelog routing
    - from: src/commands/release.js
      to: src/lib/release/mutate.js
      via: release:tag routing
    - from: src/commands/release.js
      to: src/lib/release/pr.js
      via: release:pr routing
    - from: src/lib/release/pr.js
      to: workflows/github-ci.md
      via: github-ci handoff metadata
    - from: commands/bgsd-release.md
      to: workflows/release.md
      via: slash wrapper launch
    - from: workflows/release.md
      to: src/commands/init.js
      via: init:release bootstrap
---

# Phase 148 Verification

## Goal Achievement

| Observable truth | Status | Evidence |
|---|---|---|
| `review:readiness` returns deterministic advisory readiness data for all required checks | ✓ VERIFIED | `src/lib/review/readiness.js` builds six ordered checks; `tests/review-readiness.test.cjs` passed (5/5); live `node bin/bgsd-tools.cjs review:readiness` returned JSON with `tests`, `lint`, `review`, `security`, `todo_diff`, `changelog`. |
| Readiness stays advisory-only with board-first TTY output | ✓ VERIFIED | `advisory: true` and formatter label in `src/lib/review/readiness.js`; pretty-output contract covered by passing readiness tests. |
| `release:bump` performs semver analysis with manual override | ✓ VERIFIED | `src/lib/release/bump.js` + `src/lib/release/history.js`; `tests/release.test.cjs` passed (13/13), including major/minor/patch, ambiguity fallback, and override precedence. |
| `release:changelog` drafts grouped notes from summaries + commits without mutation | ✓ VERIFIED | `src/lib/release/changelog.js`; `tests/release.test.cjs` passed changelog grouping/baseline/dry-run cases; live `release:changelog --pretty` produced grouped notes and did not mutate files. |
| `/bgsd-release` exists as one dry-run-first release workflow with one confirmation gate and resume/github-ci guidance | ✓ VERIFIED | `commands/bgsd-release.md`, `workflows/release.md`, `buildReleaseInitResult()` in `src/commands/init.js`; `tests/release-workflow.test.cjs` passed (6/6). |

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Notes |
|---|---|---|---|---|
| `src/lib/review/readiness.js` | ✓ | ✓ | ✓ | Real check runner + formatter, not a stub. |
| `src/commands/review.js` | ✓ | ✓ | ✓ | Delegates to readiness helper. |
| `src/commands/release.js` | ✓ | ✓ | ✓ | Routes bump/changelog/tag/pr implementations. |
| `src/lib/release/bump.js` | ✓ | ✓ | ✓ | Uses release history + override logic. |
| `src/lib/release/changelog.js` | ✓ | ✓ | ✓ | Builds grouped draft markdown + file preview. |
| `src/lib/release/mutate.js` | ✓ | ✓ | ✓ | Syncs version files, changelog, tag, release state. |
| `src/lib/release/pr.js` | ✓ | ✓ | ✓ | Preflights gh, pushes refs, creates PR, returns github-ci metadata. |
| `src/lib/release/state.js` | ✓ | ✓ | ✓ | Persists `.planning/release-state.json`. |
| `src/commands/init.js` | ✓ | ✓ | ✓ | Exposes `buildReleaseInitResult` / `cmdInitRelease`. |
| `commands/bgsd-release.md` | ✓ | ✓ | ✓ | Thin wrapper to `workflows/release.md`. |
| `workflows/release.md` | ✓ | ✓ | ✓ | Documents analysis → preview → single confirm → mutation → resume flow. |
| Targeted tests (`tests/review-readiness.test.cjs`, `tests/release.test.cjs`, `tests/release-workflow.test.cjs`) | ✓ | ✓ | ✓ | All passed locally. |

## Key Link Verification

| From | To | Status | Evidence |
|---|---|---|---|
| `src/router.js` | `src/commands/review.js` | WIRED | Review namespace routes to `cmdReviewReadiness`. |
| `src/commands/review.js` | `src/lib/review/readiness.js` | WIRED | Imports `buildReadinessReport` / `formatReadiness` and calls them. |
| `src/commands/release.js` | `src/lib/release/bump.js` | WIRED | `release:bump` delegates to `buildReleaseBump()`. |
| `src/commands/release.js` | `src/lib/release/changelog.js` | WIRED | `release:changelog` delegates to `buildReleaseChangelog()`. |
| `src/commands/release.js` | `src/lib/release/mutate.js` | WIRED | `release:tag` delegates to `executeReleaseTag()`. |
| `src/commands/release.js` | `src/lib/release/pr.js` | WIRED | `release:pr` delegates to `executeReleasePr()`. |
| `src/lib/release/pr.js` | `workflows/github-ci.md` | WIRED | PR output includes `/bgsd-github-ci` handoff metadata and next-safe command. |
| `commands/bgsd-release.md` | `workflows/release.md` | WIRED | Wrapper execution_context targets workflow file directly. |
| `workflows/release.md` | `src/commands/init.js` | WIRED | Workflow requires `init:release`; bootstrap implementation exists and returns release metadata. |

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| READY-01 | ✓ | Live `review:readiness` JSON includes all six required checks; readiness tests passed. |
| READY-02 | ✓ | `advisory: true`, TTY formatter, JSON output, and passing pretty-output tests. |
| REL-01 | ✓ | `release:bump` + `release:tag`; passing tests for bump inference, override, and version-file sync. |
| REL-02 | ✓ | `release:changelog` builds grouped notes from summaries + commits; passing changelog tests. |
| REL-03 | ✓ | `release:tag`/`release:pr` implemented with tag creation, gh preflight, PR creation, resume state, and github-ci handoff; passing tests. |
| REL-04 | ✓ | `commands/bgsd-release.md`, `workflows/release.md`, and `init:release` bootstrap; workflow contract tests passed. |

## Anti-Patterns Found

| Severity | Finding | Evidence |
|---|---|---|
| ⚠️ Warning | Help/catalog text for `release:tag` and `release:pr` still says “Scaffold...” although implementations are live. | `src/lib/constants.js:543-552`, `src/lib/command-help.js:162-163` |
| ℹ️ Info | Live repo release baseline is advisory but odd: latest tag `v8.2` is non-semver, `package.json` is `1.0.0`, and `VERSION` is `1.20.5`, so default bump preview resolves to `1.0.1` unless manually overridden. | Live `release:bump` output + repo version files |
| ℹ️ Info | Broad-suite failures remain outside this phase. | Confirmed in `tests/cli-tools-integration.test.cjs`, `tests/trajectory.test.cjs`, and `tests/worktree.test.cjs`; release/readiness-specific suites passed. |

## Human Verification Required

1. Run `/bgsd-release` inside the host editor to confirm the real slash-command UX, single confirmation gate, and resume messaging feel correct end-to-end.
2. Run a real `release:pr` flow against an authenticated GitHub repo/remote to confirm external-service behavior beyond the fixture-backed fake `gh` tests.

## Gaps Summary

Automated verification found the phase goal substantially implemented: readiness reporting, semver/changelog analysis, resumable tag/PR automation, and the single-command release workflow all exist and are covered by passing targeted tests. Remaining uncertainty is limited to human/external verification of the host-editor slash workflow and real GitHub integration, so the phase status is `human_needed` rather than `gaps_found`.
