---
phase: 186-cmux-truthful-lifecycle-signals
verified: 2026-04-01
status: passed
score: 6/6
intent_alignment: aligned
requirements_coverage: 2/2
must_haves:
  truths:
    - User can see one truthful workspace lifecycle state for running, blocked, waiting, stale, reconciling, finalize-failed, idle, and complete without different cmux surfaces inventing their own meanings.
    - Compact workspace-scoped overview text includes a plain-English status plus a lightweight progress or log hint so operators can understand activity without pane-hopping.
    - Intervention-required states stop showing misleading advancing progress, while quiet states keep plain-English labels and trustworthy progress treatment.
    - User receives one truthful cmux attention signal only when a workspace needs human input, stale-workspace recovery, or finalize intervention.
    - Required-intervention states stand out from normal progress in status, logs, and notifications so operators can tell where to act without polling raw panes.
    - Sidebar, logs, and notifications reuse the same lifecycle snapshot, so state text, hint text, and attention decisions do not contradict each other.
  artifacts:
    - src/plugin/cmux-lifecycle-signal.js
    - src/plugin/cmux-sidebar-snapshot.js
    - tests/plugin-cmux-lifecycle-signal.test.cjs
    - src/plugin/cmux-attention-sync.js
    - src/plugin/cmux-attention-policy.js
    - tests/plugin-cmux-attention-sync.test.cjs
  key_links:
    - src/plugin/cmux-sidebar-snapshot.js -> src/plugin/cmux-lifecycle-signal.js
    - src/plugin/cmux-lifecycle-signal.js -> src/lib/jj-workspace.js
    - tests/plugin-cmux-lifecycle-signal.test.cjs -> src/plugin/cmux-lifecycle-signal.js
    - src/plugin/cmux-attention-sync.js -> src/plugin/cmux-lifecycle-signal.js
    - src/plugin/cmux-sidebar-sync.js -> src/plugin/cmux-lifecycle-signal.js
    - src/plugin/cmux-attention-policy.js -> tests/plugin-cmux-attention-policy.test.cjs
---

# Phase 186 Verification

## Intent Alignment

**Verdict:** aligned

The core expected user change landed. Phase 186 now derives one shared lifecycle meaning, projects it into sidebar status/context/activity/progress, and uses that same meaning for attention logs and notifications, so users can distinguish normal work from intervention-required work without inferring state from raw panes.

Evidence:
- `src/plugin/cmux-lifecycle-signal.js:214-285` derives one ordered lifecycle state plus label, hint, severity, and progress behavior.
- `src/plugin/cmux-sidebar-snapshot.js:35-47` projects sidebar output from that shared signal.
- `src/plugin/cmux-attention-sync.js:135-185` builds attention events from the same snapshot and only escalates intervention states.

## Goal Achievement

| Observable truth | Status | Evidence |
|---|---|---|
| One truthful lifecycle state exists for running, blocked, waiting, stale, reconciling, finalize-failed, idle, and complete | ✓ VERIFIED | `deriveStateName()` encodes the ordered precedence in `src/plugin/cmux-lifecycle-signal.js:214-226`; focused tests cover all roadmap states in `tests/plugin-cmux-lifecycle-signal.test.cjs:53-123`. |
| Sidebar shows compact plain-English status plus inline hint | ✓ VERIFIED | Snapshot returns `status`, `context`, `activity`, and `progress` from the shared lifecycle object in `src/plugin/cmux-sidebar-snapshot.js:35-47`; waiting/progress behavior is asserted in `tests/plugin-cmux-sidebar-snapshot.test.cjs:59-72`. |
| Intervention states suppress misleading progress while quiet states stay non-alarming | ✓ VERIFIED | `deriveProgress()` hides progress for `finalize-failed`, `waiting`, `stale`, and `blocked`, but keeps exact/activity modes for quiet states in `src/plugin/cmux-lifecycle-signal.js:249-270`; tested in `tests/plugin-cmux-lifecycle-signal.test.cjs:67-70,94-95,107-122` and `tests/plugin-cmux-sidebar-snapshot.test.cjs:124-158`. |
| Attention fires only for human-input, stale, and finalize-intervention cases | ✓ VERIFIED | `INTERVENTION_STATES` in `src/plugin/cmux-attention-sync.js:4-5` and `NOTIFY_KINDS` in `src/plugin/cmux-attention-policy.js:1-2` restrict notify behavior to `waiting`, `stale`, and `finalize-failed`; validated in `tests/plugin-cmux-attention-sync.test.cjs:105-141` and `tests/plugin-cmux-attention-policy.test.cjs:53-60`. |
| Required-intervention states stand out from normal progress in status, logs, and notifications | ✓ VERIFIED | Intervention states are `needs-human` and hide progress in `src/plugin/cmux-lifecycle-signal.js:244-253`; attention emits notify payloads only for those kinds in `src/plugin/cmux-attention-policy.js:21-29,47-64`. |
| Sidebar, logs, and notifications reuse the same lifecycle meaning | ✓ VERIFIED | Attention starts from `deriveCmuxSidebarSnapshot()` in `src/plugin/cmux-attention-sync.js:88-109`, so hint/context/state are reused rather than recomputed separately; tests assert shared-hint reuse and resolved-state recovery logging in `tests/plugin-cmux-attention-sync.test.cjs:84-103,143-167`. |

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Evidence |
|---|---|---|---|---|
| `src/plugin/cmux-lifecycle-signal.js` | ✓ | ✓ | ✓ | 288-line implementation with precedence, hinting, severity, and progress logic; consumed by sidebar snapshot and present in built `plugin.js` (`plugin.js:12048`). |
| `src/plugin/cmux-sidebar-snapshot.js` | ✓ | ✓ | ✓ | Imports and reuses `deriveWorkspaceLifecycleSignal`; projects `status/context/activity/progress/lifecycle` in `:1-47`. |
| `tests/plugin-cmux-lifecycle-signal.test.cjs` | ✓ | ✓ | ✓ | Exercises lifecycle precedence and progress suppression across roadmap states in `:52-124`. |
| `src/plugin/cmux-attention-sync.js` | ✓ | ✓ | ✓ | 254-line transition-aware attention sync with semantic dedupe, resolved-state logging, and notify/log routing. |
| `src/plugin/cmux-attention-policy.js` | ✓ | ✓ | ✓ | Encodes log-only vs notify kinds and cooldown handling in `:1-94`. |
| `tests/plugin-cmux-attention-sync.test.cjs` | ✓ | ✓ | ✓ | Verifies shared-signal attention semantics, intervention-only notifications, and recovery logging in `:83-168`. |

## Key Link Verification

| Key link | Status | Evidence |
|---|---|---|
| `cmux-sidebar-snapshot.js` -> `cmux-lifecycle-signal.js` | WIRED | Import plus multiple calls to `deriveWorkspaceLifecycleSignal` in `src/plugin/cmux-sidebar-snapshot.js:1-47`. |
| `cmux-lifecycle-signal.js` -> `jj-workspace.js` recovery taxonomy | WIRED | Lifecycle classifier reads `blocking_reason` and `recovery_summary` fields in `src/plugin/cmux-lifecycle-signal.js:85-98`; those fields are emitted by workspace recovery metadata in `src/lib/jj-workspace.js:375-405`. |
| `tests/plugin-cmux-lifecycle-signal.test.cjs` -> `cmux-lifecycle-signal.js` | WIRED | Test imports module source and asserts ordered state outcomes across all required lifecycle names in `tests/plugin-cmux-lifecycle-signal.test.cjs:53-123`. |
| `cmux-attention-sync.js` -> shared lifecycle signal | WIRED | Attention sync derives from `deriveCmuxSidebarSnapshot()` in `src/plugin/cmux-attention-sync.js:88-109`, which itself is driven by the shared lifecycle signal. |
| `cmux-sidebar-sync.js` -> shared lifecycle snapshot fields | WIRED | Sidebar sync consumes snapshot `status`, `context`, `activity`, and `progress` in `src/plugin/cmux-sidebar-sync.js:21-47`, so visible cmux keys use the shared lifecycle projection. |
| `cmux-attention-policy.js` -> `tests/plugin-cmux-attention-policy.test.cjs` | WIRED | Tests cover notify/log-only kinds, semantic dedupe keys, and cooldown behavior in `tests/plugin-cmux-attention-policy.test.cjs:42-92`. |

## Requirement Coverage

| Requirement | Plan frontmatter | REQUIREMENTS.md | Coverage | Evidence |
|---|---|---|---|---|
| CMUX-02 | Present in `186-01-PLAN.md` and `186-02-PLAN.md` | `.planning/REQUIREMENTS.md:24,67` | Complete | Shared lifecycle classification plus sidebar/log reuse verified in source and tests. |
| CMUX-03 | Present in `186-02-PLAN.md` | `.planning/REQUIREMENTS.md:25,68` | Complete | Intervention-only notify policy and attention sync verified in source and tests. |

## Anti-Patterns Found

| Severity | Finding | Status | Evidence |
|---|---|---|---|
| ℹ️ Info | No TODO/FIXME/placeholder stub patterns found in touched `src/plugin/cmux-*.js` files | Clear | Content search found no stub markers in the phase implementation files. |
| ℹ️ Info | Verifier helper commands crashed, so artifact/key-link checks were performed manually | Non-blocking tooling issue | `verify:verify artifacts` and `verify:verify key-links` currently crash with `ReferenceError: createPlanMetadataContext is not defined`; phase code still verified directly. |

## Human Verification Required

None blocking for goal achievement.

Optional live smoke only:
- Open a real `cmux` workspace and visually confirm that `needs-human` states are sufficiently prominent in actual sidebar styling/desktop notification presentation.

## Verification Notes

- Focused proof passed: `node --test tests/plugin-cmux-lifecycle-signal.test.cjs tests/plugin-cmux-sidebar-snapshot.test.cjs tests/plugin-cmux-attention-sync.test.cjs tests/plugin-cmux-attention-policy.test.cjs` → **16/16 passing**.
- Rebuild proof passed: `npm run build` rebuilt `plugin.js`; bundle grep confirms lifecycle signal code is present in runtime output (`plugin.js:11974-12083`).

## Gaps Summary

No blocking gaps found. Phase 186 achieved its goal: cmux now exposes a shared, truthful execution/recovery lifecycle across sidebar state, progress treatment, logs, and attention signals, so users no longer need to guess which workspace is progressing normally versus waiting on intervention.
