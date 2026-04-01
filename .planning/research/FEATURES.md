# Milestone v19.0 Feature Shape

## Scope

Milestone v19.0 should be framed as **execution hardening**, not as a broad new-product milestone. The feature set should group around three user-visible promises and one maintainer-facing policy surface:

1. **Parallel JJ execution is real and trustworthy**
2. **cmux becomes the live runtime coordination and observability surface**
3. **Testing effort matches blast radius instead of habit**
4. **Shared-state finalization stays deterministic and recoverable**

These categories fit the supplied backlog/PRD set and are narrow enough to drive later requirements.

## Recommended Feature Categories

| Category | Audience | Why it belongs in v19.0 |
|---|---|---|
| 1. Trusted JJ Workspace Execution | User-facing first, maintainer-enforced | This is the core promise of the milestone: workspace-parallel execution must move from prompt fiction to runtime truth. |
| 2. Deterministic Reconcile + Shared-State Finalization | Mostly maintainer-facing, user-visible in outcomes | Parallel work is unsafe unless one explicit path owns STATE/ROADMAP/requirements finalization and recovery. |
| 3. cmux Runtime Coordination + Observability | User-facing first, maintainer-supported | v18.0 proved safe attachment and trust-first status; v19.0 should make that surface operationally useful during harder parallel runs. |
| 4. Risk-Based Testing Policy + Verification Routing | Maintainer-facing first, indirectly user-visible | Harder execution/runtime work needs an explicit `skip`/`light`/`full` policy so proof cost matches risk and broad regressions run where they matter. |

---

## 1. Trusted JJ Workspace Execution

### Table stakes
- Runtime-enforced workspace pinning for spawned plan execution, not advisory prompt text
- Clear workspace lifecycle: create, execute, inspect, reconcile, cleanup
- Safe sequential fallback when workspace mode is unavailable or unproven
- Reliable handling for stale workspaces via `jj workspace update-stale` and explicit recovery messaging
- Workspace-root correctness for repo-relative reads, writes, and JJ/build/test commands

### Differentiators
- Parallel same-wave plan execution that still feels predictable to operators
- Workspace-aware failure reporting that distinguishes healthy siblings from failed or stale siblings
- Deterministic reconcile order so completion order does not change final project state

### Anti-features / non-goals
- No removal of the existing sequential path
- No “parallel by default no matter what” behavior
- No concurrent direct mutation of shared `.planning/` state from every workspace
- No milestone expansion into generic multi-user/distributed coordination

---

## 2. Deterministic Reconcile + Shared-State Finalization

### Table stakes
- One explicit single-writer finalize path for shared planning artifacts
- Recomputed shared state from disk truth after reconcile, rather than stale per-plan increments
- Partial-wave completion recording: healthy workspaces can report and reconcile even if one sibling fails
- Recovery path when reconcile succeeds but finalization fails

### Differentiators
- Stable end state regardless of workspace completion order
- Cleaner operator story: inspect preserved failed workspace, keep healthy sibling output, then finalize once
- Better auditability because plan-local outputs and global-state writes are separated by design

### Anti-features / non-goals
- No optimistic-concurrency layer as the primary model if single-writer finalization is enough
- No independent executor ownership of `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, bookmarks, or session continuity during parallel waves
- No hidden background state patching that bypasses the canonical finalize surface

---

## 3. cmux Runtime Coordination + Observability

### Table stakes
- Debounced, coordinated cmux refresh path so parallel execution does not create event storms or CPU runaway
- Workspace-scoped sidebar status, progress, and logs backed by trusted signals only
- Clear attention/blocker surfacing for runs waiting on user input or needing recovery
- Quiet fail-open behavior when cmux is unavailable, unreachable, or untrusted

### Differentiators
- Operators can watch multi-workspace execution in one place instead of polling raw logs
- Runtime coordination surface reflects parallel plan health, reconcile stage, and blocked-vs-running distinction
- Observability is useful for maintainers too: easier diagnosis of stale workspace, suppressed attach, or reconciliation pressure

### Anti-features / non-goals
- No new OpenCode core UI work
- No per-subagent pane model unless agent identity is truly reliable
- No noisy “always updating” sidebar churn just to look busy
- No custom orchestration UI beyond what cmux already supports (`set-status`, `set-progress`, `log`, `notify`, `sidebar-state`)

---

## 4. Risk-Based Testing Policy + Verification Routing

### Table stakes
- Canonical verification route choice for implementation work: `skip`, `light`, or `full`
- Explicit rule that targeted proof is default and broad regression is risk-triggered
- Broad regression required for cross-cutting runtime, shared-state, routing, or generated-artifact changes in this milestone
- Workflow/docs/template alignment so planner, executor, and verifier use the same testing language

### Differentiators
- Lower verification cost for docs/prompt/wrapper alignment work inside the milestone
- Higher confidence for runtime-hardening slices because broad gates are justified and centralized instead of repeated mechanically
- Better maintainer decision quality when a plan starts narrow but execution discovers broader coupling

### Anti-features / non-goals
- No blanket “run the full suite after every edit” rule
- No weakening of TDD where `type: tdd` is selected
- No pretending runtime/observability changes are low-risk docs work
- No milestone-wide requirement that every slice use the same verification route

---

## Cross-Category Dependencies

| Depends On | Needed Before | Why |
|---|---|---|
| Trusted JJ Workspace Execution | Deterministic Reconcile + Shared-State Finalization | Reconcile/finalize rules depend on real isolated workspace execution roots. |
| Trusted JJ Workspace Execution | cmux Runtime Coordination + Observability | cmux runtime coordination is most valuable once parallel workspaces are real. |
| Deterministic Reconcile + Shared-State Finalization | cmux Runtime Coordination + Observability | cmux should surface truthful lifecycle stages such as running, reconciling, finalized, blocked. |
| All runtime-hardening categories | Risk-Based Testing Policy + Verification Routing | The testing policy must classify runtime, plugin, and shared-state work as broad-risk where appropriate. |

## Sequencing Constraints

1. **Establish runtime workspace pinning first.** Without that, the milestone is still built on advisory behavior.
2. **Define single-writer shared-state ownership second.** Parallel execution without this remains unsafe.
3. **Add reconcile/finalize lifecycle third.** Once isolated execution and ownership exist, the system can merge healthy workspace output predictably.
4. **Harden cmux coordination/observability on top of the real lifecycle.** The UI surface should describe true runtime stages, not guessed ones.
5. **Align risk-based testing policy across planning/execution/verification as the enforcement layer.** This should land early enough to shape plans, but its strictest value appears once the runtime slices exist.

## MVP Recommendation For v19.0

Treat these as the minimum milestone-defining outcomes:

- **Category 1 + 2 are mandatory**: real workspace pinning plus single-writer reconcile/finalize
- **Category 3 is mandatory at the coordination level**: debounced cmux runtime visibility for parallel execution health, not a broad UX expansion
- **Category 4 is mandatory at the policy-alignment level**: explicit verification routing for runtime-hardening work

If scope gets tight, cut richer cmux polish before cutting runtime truth or finalize safety.

## Confidence

- **HIGH**: JJ workspace capabilities and stale-workspace recovery shape (`jj workspace add`, `root`, `forget`, `update-stale`) are documented in official Jujutsu docs.
- **HIGH**: cmux sidebar/status/progress/log/notify primitives and targeting/env contracts are documented in official cmux API docs.
- **HIGH**: risk-based testing policy shape is strongly supported by the provided PRD/policy artifacts.
- **MEDIUM-HIGH**: category boundaries and sequencing are opinionated synthesis from the supplied backlog, current project state, and lesson patterns.

## Sources

- `.planning/research/JJ-WORKSPACE-PARALLEL-EXECUTION-BACKLOG.md`
- `.planning/research/CMUX-EVENT-COORDINATOR-EDD.md`
- `.planning/research/CMUX-FIRST-UX-PRD.md`
- `.planning/resources/RISK-BASED-TESTING-PRD.md`
- `.planning/resources/RISK-BASED-TESTING-POLICY.md`
- Jujutsu docs: https://docs.jj-vcs.dev/latest/working-copy/ and https://docs.jj-vcs.dev/latest/cli-reference/
- cmux docs: https://www.cmux.dev/docs/api
