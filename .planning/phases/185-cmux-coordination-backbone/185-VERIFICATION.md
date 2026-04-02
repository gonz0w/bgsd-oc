---
phase: 185-cmux-coordination-backbone
verified_at: 2026-04-02T04:36:18Z
status: passed
score: "16/16 checks verified"
must_haves:
  truths:
    - "Bursty runtime triggers collapse into one coordinated refresh cycle instead of spawning separate sidebar and attention refresh work"
    - "One coordinated cycle invalidates parser caches once, reads one fresh project snapshot, and fans that snapshot out to both cmux sinks"
    - "Overlapping refresh requests never run concurrent cycles; they request one bounded rerun with merged trigger detail"
    - "All plugin hook sources enqueue the same refresh backbone instead of calling sidebar and attention refresh paths separately"
    - "Plugin startup still performs one immediate refresh, while later bursts coalesce through the shared backbone"
    - "When cmux is unavailable, unreachable, or untrusted, refresh work stays quiet under bounded suppression and can wake early on planning-file changes"
  artifacts:
    - src/plugin/cmux-refresh-backbone.js
    - tests/plugin-cmux-refresh-backbone.test.cjs
    - src/plugin/index.js
    - tests/plugin.test.cjs
  key_links:
    - "src/plugin/cmux-refresh-backbone.js -> parser invalidation + project state rebuild"
    - "src/plugin/cmux-refresh-backbone.js -> sidebar/attention sink fan-out"
    - "tests/plugin-cmux-refresh-backbone.test.cjs -> createCmuxRefreshBackbone single-flight regressions"
    - "src/plugin/index.js -> createCmuxRefreshBackbone enqueue/refreshNow wiring"
    - "src/plugin/index.js -> cmux-targeting bounded retry + suppression wake logic"
    - "tests/plugin.test.cjs -> plugin coordinated refresh integration regressions"
gaps: []
---

# Phase 185 Verification

## Intent Alignment

**Verdict:** aligned

The explicit phase intent landed: `src/plugin/index.js` routes startup, watcher, idle, command, tool, and external planning changes through one shared backbone; `src/plugin/cmux-refresh-backbone.js` debounces, single-flights, and bounds reruns; and suppressed `cmux` sessions stay quiet with early wake on planning-file changes. No Phase 186 lifecycle vocabulary or UI redesign was pulled into this slice.

## Goal Achievement

| Observable truth | Status | Evidence |
|---|---|---|
| Bursty runtime triggers collapse into one coordinated refresh cycle instead of separate sidebar/attention work | ✓ VERIFIED | `tests/plugin-cmux-refresh-backbone.test.cjs` proves debounced burst coalescing; `tests/plugin.test.cjs` proves later command/tool/idle bursts collapse into one shared cycle; targeted tests passed. |
| One coordinated cycle invalidates parser caches once, reads one fresh project snapshot, and fans that snapshot to both sinks | ✓ VERIFIED | `src/plugin/cmux-refresh-backbone.js:101-117` calls `invalidateAll(projectDir)`, `getProjectState(projectDir)`, then `syncCmuxSidebar(...)` and `syncCmuxAttention(...)` with the same `payload` object. |
| Overlapping refresh requests never run concurrent cycles and request one bounded rerun with merged trigger detail | ✓ VERIFIED | `src/plugin/cmux-refresh-backbone.js:88-152` tracks `inFlight`, `rerunRequested`, and `pendingTrigger`; focused backbone test proves exactly one rerun while work is in flight. |
| All plugin hook sources enqueue the same refresh backbone instead of calling sidebar and attention refresh paths separately | ✓ VERIFIED | `src/plugin/index.js:327-340,352-355,414-434` routes startup, `file.watcher.updated`, `command.executed`, `session.idle`, `tool.execute.after`, and external planning changes through `enqueueCmuxRefresh()` → backbone `enqueue/refreshNow`. |
| Plugin startup still performs one immediate refresh while later bursts coalesce through the shared backbone | ✓ VERIFIED | `src/plugin/index.js:354` does immediate startup refresh; `tests/plugin.test.cjs:933-976` proves one immediate startup cycle and later debounced burst coalescing. |
| When `cmux` is unavailable, unreachable, or untrusted, refresh work stays quiet under bounded suppression and can wake early on planning-file changes | ✓ VERIFIED | `getCachedCmuxAdapter()` in `src/plugin/index.js:45-112` enforces retry cooldown; `enqueueCmuxRefresh()` / `handleExternalCmuxPlanningChange()` at `src/plugin/index.js:327-350` clear cached suppression on planning-file changes; integration test `tests/plugin.test.cjs:978-1031` proves quiet suppression plus early wake. |

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Evidence |
|---|---|---|---|---|
| `src/plugin/cmux-refresh-backbone.js` | ✓ | ✓ | ✓ | Real implementation with trigger merge, debounce, single-flight, rerun, shared payload fan-out, and dispose path; imported and instantiated from `src/plugin/index.js:14,309-321`. |
| `tests/plugin-cmux-refresh-backbone.test.cjs` | ✓ | ✓ | ✓ | Two deterministic tests exercise coalescing, shared payload reuse, merged trigger fidelity, and bounded reruns against the backbone module. |
| `src/plugin/index.js` | ✓ | ✓ | ✓ | Plugin-level wiring includes adapter retry cache, suppression wake logic, backbone instantiation, startup refresh, and all runtime hook enqueue paths. |
| `tests/plugin.test.cjs` | ✓ | ✓ | ✓ | Dedicated `Plugin cmux coordinated refresh` suite verifies startup shared cycle, later burst coalescing, quiet suppression, and planning-change wake-up via `BgsdPlugin`. |

## Key Link Verification

| Key link | Status | Evidence |
|---|---|---|
| Backbone → parser invalidation + project snapshot rebuild | WIRED | `src/plugin/cmux-refresh-backbone.js:101-103` invokes injected `invalidateAll` then `getProjectState`; `src/plugin/index.js:309-313` wires those dependencies from real parser/project-state modules. |
| Backbone → sidebar and attention sinks share one payload | WIRED | `src/plugin/cmux-refresh-backbone.js:108-117` builds one `payload` and passes it to both sinks; focused test asserts both sinks receive the same object. |
| Focused backbone tests → backbone module contracts | WIRED | `tests/plugin-cmux-refresh-backbone.test.cjs:73-154` loads `createCmuxRefreshBackbone` and exercises `enqueue` and `refreshNow`. |
| Plugin → shared refresh backbone | WIRED | `src/plugin/index.js:309-340` instantiates `createCmuxRefreshBackbone` and routes all refresh requests through `refreshNow` or `enqueue`. |
| Plugin → cmux targeting bounded retry / suppression wake | WIRED | `src/plugin/index.js:45-119,327-350` uses cached adapter state, cooldown gating, `suppressionReason`, and `clearCachedCmuxAdapter`; planning-file changes invalidate suppression cache before retry. |
| Integration tests → plugin coordinated refresh behavior | WIRED | `tests/plugin.test.cjs:933-1031` drives `command.executed`, `tool.execute.after`, `session.idle`, and `file.watcher.updated` through `BgsdPlugin` and verifies shared-cycle/suppression outcomes. |

## Requirement Coverage

| Requirement | In PLAN frontmatter | In REQUIREMENTS.md | Coverage | Evidence |
|---|---|---|---|---|
| CMUX-01 | ✓ | ✓ | Covered | Backbone and plugin integration tests passed; source routes hook bursts through one debounced, bounded shared pipeline. |
| CMUX-04 | ✓ | ✓ | Covered | Suppressed/untrusted `cmux` returns noop adapters, stays quiet during cooldown, and wakes early only on planning-file changes; integration test passed. |

No orphaned requirement IDs were found in Phase 185 plan frontmatter: the aggregated plan requirements are exactly `CMUX-01` and `CMUX-04`, and both map to Phase 185 in `REQUIREMENTS.md`.

## Anti-Patterns Found

| Severity | Finding | Status | Evidence |
|---|---|---|---|
| ℹ️ Info | Stub-marker scan on touched files | Clear | `rg -n "TODO|FIXME|PLACEHOLDER|not implemented|coming soon" src/plugin/cmux-refresh-backbone.js src/plugin/index.js tests/plugin-cmux-refresh-backbone.test.cjs tests/plugin.test.cjs` returned no matches. |
| ℹ️ Info | Separate direct hook fan-out to sidebar/attention | Not found | Phase code now centralizes refresh entry through `enqueueCmuxRefresh()` and backbone methods instead of per-hook direct refresh calls. |

## Human Verification Required

None for phase-goal acceptance. This slice is runtime coordination and quiet fail-open behavior, and the relevant contracts are covered by deterministic focused tests plus rebuilt runtime validation. A human could still optionally inspect live `cmux` feel/timing, but that is not required to conclude the phase goal landed.

## Verification Evidence

- `node --test tests/plugin-cmux-refresh-backbone.test.cjs` ✅
- `node --test --test-force-exit --test-name-pattern "Plugin cmux coordinated refresh" tests/plugin.test.cjs` ✅
- `npm run build` ✅ (rebuilt `plugin.js`; smoke/artifact validation passed)
- Built runtime surface check: `plugin.js` contains `createCmuxRefreshBackbone`, hook enqueue wiring, and coordinated refresh event paths after rebuild.

## Gaps Summary

No goal-blocking gaps found. Phase 185 achieved its goal: `cmux` refresh work is now funneled through a debounced, bounded, single-flight backbone that produces one fresh runtime snapshot per cycle and stays quiet when `cmux` is unavailable or untrusted.

## Notes

- The installed `bgsd-tools.cjs verify:verify artifacts|key-links` helpers crashed with `ReferenceError: createPlanMetadataContext is not defined`, so artifact and key-link checks were completed manually against the codebase and test evidence instead of helper JSON.
