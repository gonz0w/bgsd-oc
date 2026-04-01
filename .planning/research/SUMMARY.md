# Milestone v19.0 Research Summary

## Focus

v19.0 is an **execution hardening** milestone centered on three linked outcomes:

1. **JJ workspace execution becomes runtime-truthful** rather than prompt-advisory.
2. **cmux becomes the coordinated observability surface** for real parallel execution states.
3. **Risk-based testing policy becomes an enforcement contract** for runtime and shared-state work.

This milestone should be roadmapped as one execution-control effort with ordered delivery boundaries, not as disconnected JJ, cmux, and testing slices.

## Stack Additions / Assumptions

- **No new npm dependencies** recommended.
- Keep the milestone on the existing **Node.js + OpenCode plugin + repo test tooling** stack.
- Treat **`jj` CLI** as a hard runtime dependency for workspace execution:
  - `jj workspace add`
  - `jj workspace root`
  - `jj workspace forget`
  - `jj workspace update-stale`
- Treat **cmux CLI** as an optional-but-real observability dependency when running inside supported cmux sessions.
- Keep integration **CLI-first** for both JJ and cmux; do not add SDK/RPC/package layers unless later evidence demands it.
- Keep testing on existing tooling:
  - targeted proof via `node --test` / `npm run test:file -- ...`
  - broad regression via `npm test` when blast radius is high

## Recommended Feature Categories

1. **Trusted JJ Workspace Execution**
   - runtime-enforced workspace pinning
   - correct workspace-root reads/writes/commands
   - safe sequential fallback when workspace guarantees fail

2. **Deterministic Reconcile + Shared-State Finalization**
   - workspaces stay plan-local
   - main checkout is the single writer for `.planning/` truth
   - stable finalize order and partial-wave handling

3. **cmux Runtime Coordination + Observability**
   - debounced, bounded refresh pipeline
   - truthful status/progress/log/attention signals
   - fail-open behavior when cmux is unavailable

4. **Risk-Based Testing Policy + Verification Routing**
   - explicit `skip` / `light` / `full` route selection
   - runtime/shared-state/plugin slices default toward broader proof
   - planner/executor/verifier use the same policy language

## Architecture Shape

### Core boundaries

- **JJ workspaces** are the isolation boundary for plan-local execution.
- **Main checkout / orchestrator** is the single writer for shared planning state.
- **cmux** is a read-mostly projection of trusted runtime state, not a source of truth.
- **Verification route** is a durable field that must travel from planning through execution, proof, finalize eligibility, and verification.

### Ownership model

**Workspace-owned:**
- code edits
- plan-local artifacts
- plan summary/proof outputs
- workspace health/recovery breadcrumbs

**Main-checkout-owned:**
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- aggregate progress, requirement completion, session continuity

### Key rule

**A workspace may claim completion; only finalize may declare shared progress complete.**

## Recommended Build / Roadmap Order

1. **Runtime workspace pinning contract**
   - prove executor cwd, `jj workspace root`, and artifact writes all resolve to the intended workspace
2. **Single-writer shared-state ownership split**
   - stop workspace executors from mutating shared `.planning/` truth directly
3. **Reconcile metadata + deterministic finalize flow**
   - support healthy sibling finalize, partial-wave handling, and stable end state
4. **Stale/divergent workspace recovery rules**
   - treat stale recovery as first-class, inspectable workflow state
5. **cmux event coordinator foundation**
   - one debounced event spine, one snapshot per flush, bounded process spawning
6. **Risk-based testing policy wiring and proof normalization**
   - make `verification_route` enforceable, not just documented
7. **End-to-end invariance/regression proof**
   - prove same final state across finalize order, partial-wave recovery, sequential fallback, and cmux pressure cases

## Main Risks That Should Shape Requirements

### Critical
- **Advisory-only workspace pinning** could make “parallel JJ execution” unsafe or misleading.
- **Multiple writers to shared planning state** could corrupt progress, requirements, or session continuity.
- **Stale workspace recovery** could silently overwrite or misclassify real work if not modeled explicitly.

### High
- **cmux event storms** could turn observability into a reliability regression without debouncing/backpressure.
- **Weak status taxonomy** could show noisy activity while hiding blocked, stale, reconciling, or finalize-failed states.
- **Testing-policy drift** could over-test narrow work and under-test risky runtime/shared-state changes.
- **Bundle/source drift** could create false confidence unless runtime-touching slices verify built artifacts too.

## Requirement and Roadmapping Implications

- Requirements should be grouped by **delivery boundary**, not technical layer.
- The earliest phases should cover:
  1. runtime pinning truth
  2. single-writer finalize safety
  3. stale/partial-wave recovery
- cmux work should follow real lifecycle states, not precede them.
- Testing-policy requirements should explicitly state when `full` proof is mandatory for runtime, reconcile/finalize, plugin, or bundle-impacting changes.
- If scope tightens, cut richer cmux polish before cutting runtime truth or finalize safety.

## Skill Recommendations

Recommended project-local skills for milestone execution:

1. **`danverbraganza/jujutsu-skill`**
   - best fit for JJ workspace behavior, recovery, reconcile/finalize flows, and avoiding Git-first mistakes in colocated repos

2. **`jiahao-shao1/cmux-skill`**
   - best fit for workspace/surface targeting, sidebar state, progress/log/notify flows, and live cmux coordination testing

Optional if live multi-session testing becomes important:

3. **`KyubumShin/cmux-skills`**
   - useful for cross-session observation/control, but not needed as the primary implementation skill

Do **not** add a generic external testing-policy skill; repo-native bGSD testing/TDD policy is already more specific to this milestone.

## Bottom Line

v19.0 should deliver **runtime-enforced JJ workspace execution, single-writer shared-state finalization, coordinated cmux observability, and enforceable risk-based verification routing** with no new package footprint. Downstream requirements and roadmap phases should prioritize safety/control boundaries first, observability second, and richer UX polish last.
