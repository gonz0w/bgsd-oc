# Roadmap: bGSD Plugin

## Milestones

- ✅ **v18.0 Adaptive Models & Ambient cmux UX** - Phases 168-172 (shipped 2026-03-31)
- 🚧 **v18.1 Greenfield Cleanup & CLI Simplification** - Phases 173-180 (active)

## Overview

v18.1 reduces cleanup drag before adding anything new. The milestone starts with a code-review-grade audit that classifies dead code, duplication, simplification opportunities, concurrency risks, error-handling gaps, and maintainability hotspots by safe removal order, then removes greenfield-incompatible migration and normalization paths while keeping canonical `.planning/` artifacts valid. With compatibility-only product drag reduced, the milestone simplifies command routing around clearer canonical definitions, aligned help and discovery surfaces, and smaller command subdomains, and closes by hardening touched paths so supported planning and settings workflows still behave the same with stronger regression proof and less ambient complexity.

## Phases

- [x] **Phase 173: Simplification Audit & Safe Sequencing** (completed 2026-03-31) - Classify cleanup targets and safe order of operations before deleting or flattening anything.
- [x] **Phase 174: Greenfield Compatibility Surface Cleanup** (completed 2026-04-01) - Remove migration-only and superseded normalization paths while keeping canonical artifacts valid; verification gaps remain.
- [x] **Phase 175: Canonical Command Surface Alignment** - Move routing, aliases, help, and discovery toward one clearer command definition and supported guidance surface, including the remaining Phase 174 command-integrity blocker. (completed 2026-04-01)
- [x] **Phase 176: Command Hotspot Simplification & Hardening** (completed 2026-04-01) - Break up the highest-friction CLI hotspots and prove supported workflows still hold after cleanup.
- [x] **Phase 177: Runtime Guidance Integrity Cleanup** (completed 2026-04-01) - Repair runtime/plugin roadmap follow-up guidance so surfaced canonical commands are runnable and validator-clean.
- [x] **Phase 178: Phase 176 Hardening Truth Reconciliation** (completed 2026-04-01) - Bring the shipped hardening state, regression proof, and verification artifacts back into alignment with current source.
- [x] **Phase 179: Shipped Guidance Surface Integrity** (completed 2026-04-01) - Repair shipped runtime and plugin next-step guidance so surfaced canonical commands are runnable, operand-complete, and validator-clean.
- [x] **Phase 180: Command Validator Drift Resolution** (completed 2026-04-01) - Reconcile surfaced command validation with docs, workflows, agents, and built runtime guidance so milestone-close command integrity is trustworthy again.

## Phase Details

### Phase 173: Simplification Audit & Safe Sequencing
**Goal**: Maintainers can review one milestone audit that shows exactly what can be deleted, simplified, or deferred, and in what safe order, before behavior-preserving cleanup begins
**Depends on**: Phase 172
**Requirements**: AUDIT-01, AUDIT-02
**Success Criteria** (what must be TRUE):
  1. Maintainers can review one audit artifact that identifies dead code, duplication, simplification opportunities, concurrency risks, error-handling gaps, and maintainability hotspots with file-level references.
  2. Maintainers can tell which candidates are safe low-blast-radius deletions versus higher-risk refactors because the audit classifies them by risk and rationale.
  3. Maintainers can follow a safe order of operations that lands low-risk cleanup before risky router or command-module changes.
**Plans**: 2/2 plans complete

### Phase 174: Greenfield Compatibility Surface Cleanup
**Goal**: Maintainers can remove compatibility-only product drag so the repo reflects one current greenfield support model without breaking canonical planning artifacts
**Depends on**: Phase 173
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03
**Success Criteria** (what must be TRUE):
  1. Maintainers can remove migration-only commands and helpers for obsolete installs, storage transitions, or local-state upgrades without leaving routed dead surfaces behind.
  2. Current canonical `.planning/` files still parse and validate without legacy normalization paths for superseded planning or config shapes.
  3. Users see docs, templates, and help text that consistently teach the supported JJ/workspace-first model instead of stale worktree-era or compatibility-era guidance.
**Plans**: 8/8 plans complete

### Phase 175: Canonical Command Surface Alignment
**Goal**: Maintainers can change the supported command surface from one clearer canonical definition instead of keeping routing, aliases, help, and discovery in parallel drift-prone paths
**Depends on**: Phase 174
**Requirements**: CLI-01, CLI-02, SAFE-03, CLEAN-03
**Gap Closure:** Closes `GAP-174-RV-03` by making shipped command-integrity validation accept the canonical planning workflow guidance in `workflows/plan-phase.md` and `workflows/discuss-phase.md`.
**Success Criteria** (what must be TRUE):
  1. Maintainers can update a supported command route, alias, or help/discovery entry from one canonical definition instead of editing parallel registries by hand.
  2. Maintainers can change touched router parsing behavior without wading through repeated hand-written flag scans and unrelated startup logic in the same edit path.
  3. Users see help and workflow guidance that teach the real supported command surface first, with stale aliases or contradictory guidance removed.
**Plans**: 4/4 plans complete

### Phase 176: Command Hotspot Simplification & Hardening
**Goal**: Maintainers can work in smaller CLI subdomains with less hidden state while supported planning and settings workflows keep behaving the same after cleanup
**Depends on**: Phase 175
**Requirements**: CLI-03, SAFE-01, SAFE-02
**Success Criteria** (what must be TRUE):
  1. Maintainers can change touched command families inside smaller, easier-to-reason-about subdomain files instead of multi-thousand-line bucket modules and ambient output globals.
  2. Maintainers can show that touched cleanup paths no longer rely on silent error swallowing, unnecessary async or control-flow indirection, or unguarded shared mutable state.
  3. Users can run supported planning and settings workflows after cleanup with regression proof showing canonical command routes still work.
**Plans**: 4/4 plans complete

### Phase 177: Runtime Guidance Integrity Cleanup
**Goal**: Users receive runnable canonical roadmap follow-up commands from runtime and plugin guidance surfaces instead of incomplete suggestions that fail validation
**Depends on**: Phase 176
**Requirements**: SAFE-03
**Gap Closure:** Closes the milestone audit runtime guidance gap where `plugin.js` surfaces incomplete `/bgsd-plan roadmap ...` suggestions.
**Success Criteria** (what must be TRUE):
  1. Runtime and plugin follow-up guidance only surfaces canonical roadmap commands with the required operands or clearly marks them as reference syntax.
  2. Command-integrity validation no longer reports the runtime/plugin roadmap guidance gap.
  3. Users can follow roadmap next-step guidance from shipped runtime surfaces without hitting invalid-command or missing-argument failures.
**Plans**: 1/1 plans complete

### Phase 178: Phase 176 Hardening Truth Reconciliation
**Goal**: Maintainers can trust that the shipped cleanup state, regression proof, and verification artifacts for the Phase 176 hotspot work match the live repo state
**Depends on**: Phase 177
**Requirements**: CLI-03, SAFE-01, SAFE-02
**Gap Closure:** Closes the milestone audit gaps caused by missing `176-VERIFICATION.md`, unresolved ambient-global state, and mismatched Phase 176 summary claims.
**Success Criteria** (what must be TRUE):
  1. Touched command-hotspot cleanup claims are made true in current source or corrected so planning artifacts no longer overstate shipped behavior.
   2. Supported planning and settings workflows have current regression proof aligned to the real cleanup state.
   3. Phase 176 has a verification artifact that matches current source, tests, and milestone-close evidence.
**Plans**: 2/2 plans complete

### Phase 179: Shipped Guidance Surface Integrity
**Goal**: Users can run shipped runtime and plugin next-step guidance exactly as surfaced because built guidance strings are canonical, operand-complete, and validator-clean
**Depends on**: Phase 178
**Requirements**: SAFE-03
**Gap Closure:** Closes the milestone audit runtime guidance gap where plugin idle-validation and shipped next-step surfaces still emit malformed or non-runnable canonical commands.
**Success Criteria** (what must be TRUE):
  1. Built runtime and plugin next-step guidance only surface canonical planning commands in runnable form instead of prefixed or malformed command snippets.
  2. Rebuilding the shipped `plugin.js` no longer reintroduces the runtime guidance failures reported by `util:validate-commands --raw`.
  3. Users can follow runtime next-step guidance from shipped plugin surfaces without hitting malformed-command or missing-operand failures.
**Plans**: 1/1 plans complete

### Phase 180: Command Validator Drift Resolution
**Goal**: Maintainers can trust milestone-close command-integrity proof because surfaced guidance across docs, workflows, agents, and built runtime agrees with the validator's supported-command contract
**Depends on**: Phase 179
**Requirements**: CLEAN-03
**Gap Closure:** Closes the reopened milestone audit guidance-integrity gap by resolving remaining validator false positives, classification drift, and surfaced-command mismatches outside the shipped runtime fix.
**Success Criteria** (what must be TRUE):
  1. Repo-wide surfaced command validation is green for the supported docs, workflows, agent prompts, and built runtime guidance included in milestone-close proof.
  2. Validator parsing and classification no longer misreport known quoted-example, redirect, or internal-bootstrap cases that are intentionally supported or explicitly out of scope.
  3. Users and maintainers can treat `util:validate-commands --raw` as trustworthy end-to-end milestone-close evidence for the supported surfaced command family.
**Plans**: 2/2 plans complete

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 173. Simplification Audit & Safe Sequencing | 2/2 | Complete    | 2026-03-31 |
| 174. Greenfield Compatibility Surface Cleanup | 8/8 | Complete   | 2026-04-01 |
| 175. Canonical Command Surface Alignment | 4/4 | Complete    | 2026-04-01 |
| 176. Command Hotspot Simplification & Hardening | 4/4 | Complete    | 2026-04-01 |
| 177. Runtime Guidance Integrity Cleanup | 1/1 | Complete    | 2026-04-01 |
| 178. Phase 176 Hardening Truth Reconciliation | 2/2 | Complete    | 2026-04-01 |
| 179. Shipped Guidance Surface Integrity | 1/1 | Complete    | 2026-04-01 |
| 180. Command Validator Drift Resolution | 2/2 | Complete   | 2026-04-01 |

## Backlog

- **JJ Workspace Parallel Execution** - Future milestone candidate to make workspace-parallel execution real and safe by adding runtime-enforced workspace pinning, moving shared planning artifacts to a single-writer reconcile/finalize path, and proving deterministic shared-state outcomes after parallel plan execution.
  - Backlog: `.planning/research/JJ-WORKSPACE-PARALLEL-EXECUTION-BACKLOG.md`

- **Risk-Based Testing Strategy** - Future milestone candidate to formalize when this repo should use targeted proof versus broad regression gates, align TDD and verification guidance, and reduce redundant testing cost without lowering confidence.
  - PRD: `.planning/resources/RISK-BASED-TESTING-PRD.md`
  - Policy: `.planning/resources/RISK-BASED-TESTING-POLICY.md`

---

*Last updated: 2026-04-01*
