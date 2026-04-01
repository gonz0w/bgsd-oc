# Milestone v19.0 Pitfalls — JJ Workspace Hardening, cmux Coordination, Risk-Based Testing

## Scope

This milestone is high-risk because it touches three shared-control surfaces at once:

1. **Execution truth** — which checkout/workspace a plan actually runs in
2. **Shared project truth** — who is allowed to mutate `.planning/` state and when
3. **Operational truth** — what the plugin tells users through `cmux`, and how testing policy decides whether that behavior is proven

The roadmap should treat these as **ordered control problems**, not as one blended “parallel execution UX” phase.

## Evidence Snapshot

- **JJ official docs**: `jj workspace add`, `jj workspace root`, `jj workspace forget`, and `jj workspace update-stale` are the core workspace and recovery primitives; stale workspaces are expected after cross-workspace rewrites or interrupted updates.  
  Source: https://docs.jj-vcs.dev/latest/working-copy/
- **JJ config docs**: `[snapshot] auto-update-stale = true` exists, but automatic stale updates are a convenience, not a substitute for explicit recovery/finalization logic.  
  Source: https://docs.jj-vcs.dev/latest/config/
- **cmux official docs**: sidebar status, progress, log, notifications, workspace targeting, socket access modes, and `sidebar-state` are real supported APIs.  
  Sources: https://www.cmux.dev/docs/api , https://www.cmux.dev/docs/notifications
- **Repo-local backlog/design docs**: current risk is not hypothetical; workspace pinning is still described as advisory in workflow text, shared-state writes are unsafe under parallel execution, and `tool.execute.after` can generate unbounded cmux refresh churn.
- **Lessons snapshot**: 61 captured lessons skew heavily toward **tooling/workflow** failures; repeated themes are **testing drift** (`test`: 26), **verification/helper fragility** (`verify`: 25), and **state mutation/readback issues** (`state`: 12). That makes single-writer state and policy-enforced verification first-class roadmap concerns, not cleanup.

## Severity Order

### CRITICAL 1 — Runtime workspace pinning is still softer than the milestone language

**What goes wrong**  
The roadmap could promise “parallel JJ workspaces” while subagents still resolve reads/writes/CLI commands from the parent checkout or an advisory-only spawn contract.

**Why it happens in this codebase**  
The backlog explicitly says current `Task()` spawn behavior does not reliably enforce workspace-specific `workdir`, while repo history shows prior JJ support focused on guidance and fallback commits rather than a runtime-pinned parallel contract.

**Consequences**
- A plan appears isolated but mutates the wrong checkout
- summary/proof artifacts are created in the wrong place
- reconciliation bugs get misdiagnosed as JJ issues when they are actually spawn-root issues
- roadmap phases downstream assume safety that does not exist

**Prevention**
- Make **workspace root proof** a hard prerequisite before any parallel execution phase: spawned executor must prove `pwd`, `jj workspace root`, and repo-relative artifact writes all resolve to the intended workspace
- Define one canonical spawn contract for workspace-pinned execution; do not leave “prompt says workspace X” as acceptable evidence
- Fail closed: if workspace creation succeeds but pinned spawn proof fails, abort to sequential mode before task work starts
- Add an explicit negative test proving a workspace-targeted plan cannot accidentally write to the parent checkout

**Detection**
- integration test that compares actual executor cwd vs expected `jj workspace root --name <workspace>`
- smoke proof that plan-local summary/artifact writes land only in the workspace root until reconcile

**Roadmap placement**  
Put this in the **first implementation phase**. Do not start shared-state parallelism, cmux observability, or testing-policy rollout on top of advisory pinning.

---

### CRITICAL 2 — Shared planning state will corrupt if multiple executors stay writers

**What goes wrong**  
Two healthy workspaces can reconcile code cleanly but still race on `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, bookmarks, or session continuity.

**Why it happens in this codebase**  
The JJ backlog calls out repo-level planning artifacts as unsafe for concurrent mutation. Lessons also show repeated `verify:state complete-plan` fragility, stale field repair, dedupe failures, and requirements-marking mismatches.

**Consequences**
- false progress or skipped requirements
- duplicated/contradictory recent-trend or decision entries
- stale current phase/plan headers after otherwise successful execution
- operators lose trust in `.planning/` as canonical truth

**Prevention**
- Adopt a strict **single-writer finalize model**: workspace executors may emit plan-local artifacts only; one trusted root reconciles and computes shared state exactly once
- Recompute shared progress from disk after reconcile instead of incrementally patching counters from each workspace
- Treat `verify:state complete-plan` and requirement-marking helpers as **unsafe until readback passes**; finalization must re-read written artifacts and repair or fail loudly
- Separate “plan completed in workspace” from “project state finalized in main checkout” in workflow semantics and operator-facing UX

**Detection**
- order-independence test: reconcile the same completed workspaces in different orders and assert identical final `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md`
- partial-wave test: one failed workspace plus one healthy workspace still yields stable single-writer final state
- post-finalize readback guard for current phase, current plan, completed counters, and requirement checkboxes

**Roadmap placement**  
This should be the **second phase immediately after runtime pinning**. Any roadmap that places cmux/status work before single-writer state is optimizing the dashboard before fixing the ledger.

---

### CRITICAL 3 — Stale workspace recovery can silently destroy operator trust

**What goes wrong**  
Cross-workspace rewrites, interrupted updates, or abandoned operations leave a workspace stale; the executor may continue from an invalid assumption, or “auto-update stale” may mask a state transition the roadmap needed to model explicitly.

**Why it happens in this codebase**  
JJ docs say stale workspaces are normal after edits from another workspace and that `jj workspace update-stale` may create recovery commits when needed. The backlog also explicitly calls out stale/divergent/failed workspace preservation as a milestone acceptance area.

**Consequences**
- healthy work gets overwritten during recovery
- stale workspaces disappear before inspection
- reconcile/finalize order becomes nondeterministic
- users cannot tell whether a recovered workspace is trustworthy, needs replay, or should be quarantined

**Prevention**
- Model stale recovery as an explicit state machine: `healthy -> stale -> recovered | quarantined | abandoned`
- Preserve failed/stale workspace metadata for inspection instead of auto-cleaning on first error
- Use `jj workspace update-stale` only behind a wrapper that records pre/post status, resulting commit IDs, and whether a recovery commit was created
- Prefer explicit recovery workflow over relying only on `[snapshot] auto-update-stale = true`; auto-update may reduce friction, but roadmap semantics still need deterministic recovery handling
- Require reconcile eligibility checks after any stale recovery event before shared-state finalization proceeds

**Detection**
- tests for stale workspace caused by cross-workspace rewrite
- tests for interrupted update / lost-op style recovery
- surfaced recovery metadata in summary/log output so operators can inspect, not guess

**Roadmap placement**  
Place immediately after, or inside the tail of, the single-writer/reconcile phase. Do **not** defer stale recovery to a polish phase; it is part of the core safety model.

---

### HIGH 4 — cmux event storms will turn observability into a reliability regression

**What goes wrong**  
Parallel execution can make `tool.execute.after` emit dozens of back-to-back refreshes, causing repeated parser invalidation, repeated state reads, and 100+ cmux process spawns.

**Why it happens in this codebase**  
The EDD documents zero debounce on `tool.execute.after`, duplicate sidebar/attention refresh paths, and no process limiter. Existing lessons also show stale parser cache problems on hook-driven rereads.

**Consequences**
- CPU spikes and host instability
- sidebar feedback loops and noisy logs
- stale status despite more refresh activity
- perception that parallel mode is slower/less trustworthy than sequential mode

**Prevention**
- Ship the **single-entry coordinator** before richer cmux UX semantics: one debounce window, one invalidate/read pass, one bounded refresh pipeline
- Coalesce sidebar + attention refresh into one project-state snapshot
- Cap concurrent cmux calls and drop or merge redundant triggers instead of faithfully replaying every event
- Classify events by priority: human-attention signals may bypass some debounce; routine tool churn must not
- Invalidate caches intentionally before rereads, then prove the rebuilt runtime uses the same policy

**Detection**
- burst/load test using rapid tool events with asserted upper bound on cmux process count
- metrics for queued triggers, dropped triggers, refresh latency, and max concurrent cmux operations
- regression test proving sidebar state stays correct under coalesced events

**Roadmap placement**  
This belongs **before any ambitious cmux-first UX phase** and ideally before exposing parallel execution as a normal user path. Observability must not become the new bottleneck.

---

### HIGH 5 — cmux noise will drown real attention signals if status semantics ship before policy

**What goes wrong**  
The sidebar may show lots of status/log/progress churn but still fail to tell the user the only thing that matters: is this workspace working, blocked, stale, waiting for input, or recovered?

**Why it happens in this codebase**  
The PRD already flags weak distinction between `waiting_input` and generic inactivity. This milestone also adds new execution states (workspace-pinned, reconcile-pending, stale, recovered, finalize-failed) that the current status model does not yet encode.

**Consequences**
- “busy” looking sidebar with low signal
- stale/recovery states misreported as idle or working
- user attention goes to noisy workspaces instead of blocked ones

**Prevention**
- Freeze a small status taxonomy before implementation: at minimum `working`, `waiting_input`, `blocked`, `stale_workspace`, `reconciling`, `finalize_failed`, `idle`, `complete`
- Attach each status to one authoritative source, not mixed heuristics
- Restrict log emission to milestone-relevant lifecycle events; do not log every tool call
- Make “needs human action” and “recovery occurred” visually stronger than normal progress updates

**Detection**
- live session review in real cmux workspaces, not only unit tests
- noise-budget assertions: max status changes/log writes for a normal successful plan

**Roadmap placement**  
Do this **after** event coordination and after single-writer workflow states are defined, otherwise the UX vocabulary will drift from the actual runtime.

---

### HIGH 6 — Testing policy drift will cause the milestone to either over-test the wrong thing or under-test the risky thing

**What goes wrong**  
Plans may keep using legacy “run the broad suite” habits for narrow slices, while truly dangerous shared-runtime changes ship with only local green checks.

**Why it happens in this codebase**  
The PRD and policy both say repo guidance currently drifts between older heavy-suite expectations and newer risk-based targeted proof. Lessons repeatedly show hanging broad plugin tests, helper crashes, stale bundled-runtime proofs, and the need to compare source behavior with shipped bundles.

**Consequences**
- slow milestone execution with low extra signal
- missed regressions in bundled runtime, plugin hooks, or global execution semantics
- planners choose `light` or `full` inconsistently for similar risks
- verifier output conflates missing behavior proof with missing regression proof

**Prevention**
- Codify route selection inside the milestone itself: workspace pinning, reconcile/finalize, shared parser/state mutation, and plugin event coordination default to **`full`** unless a narrower blast-radius proof is explicitly justified
- Require paired evidence for runtime-adjacent slices: **focused touched-surface proof + shipped-runtime proof**
- Treat hanging broad gates as one-shot baseline evidence attempts, then switch to targeted proofs plus built-runtime smoke checks
- Add explicit plan rationale when `full` is selected and explicit explanation when a docs/policy slice stays `skip` or `light`

**Detection**
- planner/verifier contract checks for route selection + rationale
- audit for repeated expensive commands with no new signal
- shipped-bundle smoke checks for workspace/reconcile/plugin verification helpers

**Roadmap placement**  
Start policy alignment **early in the milestone**, not at the end. It should shape how the hardening phases are verified.

---

### MODERATE 7 — Partial-wave success may be mishandled as all-or-nothing

**What goes wrong**  
One failed or stale workspace blocks healthy siblings from being reconciled or reported, or the opposite: healthy sibling success hides the fact that another workspace needs manual recovery.

**Prevention**
- represent wave outcomes per workspace: `completed`, `failed`, `stale`, `recovered`, `quarantined`
- finalize only healthy reconciled work, but preserve explicit unresolved-wave status
- keep sequential fallback available per remaining plan rather than aborting the whole wave

**Roadmap placement**  
Handle in the same phase as reconcile/finalize, not as future UX cleanup.

---

### MODERATE 8 — Generated runtime / source drift will create false confidence during milestone verification

**What goes wrong**  
Source tests pass while `bin/bgsd-tools.cjs` or `plugin.js` remains stale or broken, especially for plugin/cmux paths.

**Why it happens in this codebase**  
Multiple lessons call out stale bundle proofs, post-build verifier/helper failures, and the need for direct bundle smoke checks.

**Prevention**
- For bundle-adjacent phases, require `npm run build` plus a small shipped-runtime smoke command before closure
- Add post-build smoke checks for the helpers most likely to support this milestone (`verify:state`, artifact/key-link verification if used, plugin import/runtime smoke)

**Roadmap placement**  
Bake into verification criteria for each runtime-touching phase, not as a final release-only check.

## Phase Placement Guidance

Recommended roadmap order:

1. **Runtime workspace pinning contract**  
   Hard gate: prove workspace-root enforcement and safe sequential fallback.
2. **Single-writer shared-state ownership + deterministic finalize surface**  
   Hard gate: no workspace executor writes shared planning truth directly.
3. **Stale/divergent workspace recovery + partial-wave reconcile rules**  
   Hard gate: healthy siblings can finish while stale/failed workspaces remain inspectable.
4. **cmux event coordinator / load-shedding foundation**  
   Hard gate: parallel execution does not create refresh storms or stale cache feedback loops.
5. **cmux status semantics and observability polish**  
   Only after runtime states above are real and authoritative.
6. **Risk-based testing policy alignment and enforcement hooks**  
   Start policy codification early, but complete planner/verifier/docs integration after the risky runtime contracts are known.

## Planner Warnings

- Do **not** combine workspace pinning, single-writer finalize, and cmux UX polish in one plan; failures will be impossible to localize.
- Do **not** let cmux status or progress be the acceptance proxy for correctness; the source of truth is reconcile/finalize state.
- Do **not** trust helper-only verification for this milestone. Use helper commands when they work, but require readback/smoke proof from live artifacts and shipped runtime.
- Do **not** treat stale-workspace automation as fully solved by JJ config; operator-visible recovery semantics still belong in the roadmap.

## Confidence

- **HIGH**: workspace staleness/recovery risk, workspace/root pinning risk, cmux API capability, event-storm failure mode, testing-policy drift risk
- **MEDIUM**: exact best status taxonomy for new runtime states, how much `auto-update-stale` should be enabled by default in this repo, final split between policy codification phase vs runtime-phase-local enforcement
