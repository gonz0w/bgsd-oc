# Phase 203: State Mutation Safety - Research

**Researched:** 2026-04-06
**Domain:** state mutation safety / planning-state persistence
**Confidence:** HIGH

<user_constraints>
- Validate batched state writes before continuing execution.
- Keep sacred data on the canonical single-write path.
- Allow only non-sacred state to batch atomically.
- Fail closed on unsafe writes; do not silently proceed.
- Preserve the existing CLI surface and routing contract.
</user_constraints>

<phase_requirements>
- STATE-01: Wire `verify:state validate` regression coverage into execute-plan after any batched state write.
- STATE-02: Extend `verify:state complete-plan` with batch transaction support for non-sacred state mutations.
- STATE-03: Keep sacred data writes on the canonical single-write path only.
- BUNDLE-01: Run `npm run build` after plan updates and fail closed on bundle parity drift.
- BUNDLE-02: Run `util:validate-commands --raw` after routing changes.
</phase_requirements>

## Summary

The repo already has the two primitives this phase needs: an atomic state/session mutator and a dedicated validation command. `applyStateSessionMutation()` runs under `withProjectLock()`, writes `STATE.md` through `writeFileAtomic()`, persists the SQLite bundle, and rolls back the markdown file on failure. `verify:state validate` already checks plan-count drift, completion drift, stale activity, and stale blocker/todo state.

The remaining work is orchestration, not invention: execute-plan should treat validation as a required post-write gate after batched mutations, while sacred data continues to flow through the existing single-write decision/blocker/session paths. The safest implementation shape is to keep `verify:state complete-plan` as the batching boundary for non-sacred state, then immediately prove the result with `verify:state validate` before any downstream progression.

**Primary recommendation:** reuse the existing lock + atomic-write + validation stack; do not introduce a second mutation pathway.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `node:fs` / `node:fs/promises` | current Node runtime | Atomic file replacement, sync, and readback | Already used by the repo and documented by Node |
| `withProjectLock()` | repo-local | Serializes state mutations | Prevents concurrent writers |
| `writeFileAtomic()` | repo-local | Crash-safe `STATE.md` replacement | Existing atomic rename helper |
| `PlanningCache` | repo-local | Mirrors markdown state into SQLite | Keeps canonical bundle aligned |
| `verify:state validate` | repo CLI | Post-write correctness gate | Existing regression/consistency check |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `node:test` | current Node runtime | Regression coverage | For mutation/validation behavior |
| `jq`-style CLI parsing | repo-local | JSON contract checks | For workflow orchestration tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| Direct markdown patching | Another write layer | More drift risk, no atomic rollback |
| Custom transaction manager | New batching subsystem | Unnecessary; existing mutator already bundles state |
| Silent retry loops | Open-ended recovery | Masks corruption; phase wants fail-closed behavior |

## Architecture Patterns

### Recommended Project Structure
- Keep mutation in `src/lib/state-session-mutator.js`.
- Keep validation in `src/commands/state.js`.
- Keep execution-policy enforcement in `workflows/execute-plan.md`.

### Pattern 1: Locked atomic mutation
- Read canonical state under project lock.
- Clone in-memory state.
- Apply one mutation object.
- Write markdown atomically.
- Persist the SQLite bundle.
- Roll back the markdown file if persistence fails.

### Pattern 2: Post-write proof gate
- Run `verify:state validate` after batched writes.
- Do not continue progression until validation succeeds.
- Treat validation errors as blocking, not advisory.

### Anti-Patterns to Avoid
- Batching sacred writes with non-sacred state.
- Letting execute-plan continue on a suspicious write result.
- Replacing the existing mutator with a parallel bespoke path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Atomic `STATE.md` replacement | Manual temp-file logic in workflow code | `writeFileAtomic()` | Existing helper already handles temp + rename cleanup |
| Serialized mutation | Per-command ad hoc locks | `withProjectLock()` | Central lock keeps write ordering consistent |
| State bundle sync | Direct SQLite writes from workflows | `PlanningCache.storeSessionBundle()` | Keeps markdown and bundle aligned |
| Safety proof | Custom post-write heuristics | `verify:state validate` | Already encodes the canonical drift checks |

## Common Pitfalls

### Pitfall 1: Atomic write is not durability proof
**What goes wrong:** a rename-based write succeeds but downstream state or bundle drift remains.
**Why it happens:** atomic replacement protects the file swap, not the whole workflow contract.
**How to avoid:** require `verify:state validate` after the batched write path.
**Warning signs:** state file looks updated but plan counts, focus text, or progress remain stale.

### Pitfall 2: Sacred data leaks into batching
**What goes wrong:** decisions, lessons, trajectories, or requirements get grouped into the batch path.
**Why it happens:** a generic mutator is easier than maintaining separate paths.
**How to avoid:** keep sacred writes on `appendDecision`, `appendBlocker`, `recordContinuity`, and the existing single-write path.
**Warning signs:** batched completion starts emitting decision/session side effects that should stay isolated.

### Pitfall 3: Validation becomes advisory
**What goes wrong:** execute-plan continues after validation detects drift.
**Why it happens:** treating verification as telemetry instead of a gate.
**How to avoid:** fail closed and stop progression until validation passes.
**Warning signs:** later steps run even when the post-write proof reports errors.

## Code Examples

### Current atomic mutation path
```js
withProjectLock(cwd, () => {
  writeFileAtomic(statePath, nextContent);
  persistModel(cwd, cache, nextModel);
});
```

### Current completion repair gate
```js
node /Users/cam/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs verify:state complete-plan \
  --phase "${PHASE}" --plan "${PLAN}" --duration "${DURATION}"
```

### Current validation command
```js
node /Users/cam/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs verify:state validate
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Fragmented state finalization | Atomic `complete-plan` core mutation | Phase 151/163/166 lineage | Reduced partial-write risk |
| File-only updates | Markdown + SQLite bundle sync | Shared contract work | Keeps session truth aligned |
| Blind continuation after writes | Explicit validation gate | Phase 203 target | Fail-closed safety |

## Open Questions

- Should `verify:state validate` run after every batched write or only after execute-plan completions?
- Should the one retry for transient validation glitches live in the workflow or in the command handler?

## Sources

### Primary (HIGH confidence)
- `src/lib/state-session-mutator.js`
- `src/commands/state.js`
- `src/lib/atomic-write.js`
- `.planning/phases/203-state-mutation-safety/203-CONTEXT.md`
- `workflows/execute-plan.md`

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `tests/state.test.cjs`

### Tertiary (LOW confidence)
- Node.js file system docs: `node:fs` / `node:fs/promises`

## Metadata

**Confidence breakdown:** HIGH on current repo behavior, MEDIUM on exact implementation sequencing, LOW on any future platform-specific durability nuance.
**Research date:** 2026-04-06
**Valid until:** superseded by a code or roadmap change to state mutation flow.
