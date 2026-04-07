# Stack Research — v19.4 Workflow Acceleration II + TDD Reliability

**Domain:** Workflow hot-path optimization (continued) + TDD reliability hardening
**Researched:** 2026-04-06
**Confidence:** HIGH

---

## Recommendation

**Do not add new npm dependencies for this milestone.** v19.4 continues v19.3's acceleration infrastructure and addresses TDD reliability hardening through:

1. **Workflow acceleration continuation** — Pre-computed routing tables, batch I/O operations, and parallel stage execution from v19.3 are extended with:
   - Planner self-check routing decisions stored in the existing `routing_decisions` table
   - Extended `phase:snapshot` to cover TDD eligibility evaluation context
   - Parallel handoff writes with mutex-protected cache coordination

2. **TDD reliability hardening** — Existing `execute:tdd` RED/GREEN/REFACTOR validation is extended through:
   - TDD-aware semantics in `execute:tdd` validator (not just exit-code checks)
   - TDD decision rationale added to plan output (stored in existing `must_haves` metadata)
   - Three-level checker compliance (`required`/`recommended`/informational)
   - E2E fixture tests using existing `node:test` infrastructure

No new packages are needed. The existing `node:sqlite`, `node:child_process`, `node:fs` APIs and the existing npm dependencies (fast-glob, valibot, fuse.js) are sufficient for all v19.4 targets.

---

<!-- section: compact -->

**Core stack (existing — no changes from v19.3):**

| Technology | Purpose | Version |
|------------|---------|---------|
| `node:sqlite` | Hot-path decision cache with TTL storage + TDD rationale storage | Node 22.5+ built-in |
| `node:child_process` | Parallel stage execution via spawn | Node 22.5+ built-in |
| `PlanningCache` | SQLite-backed mtime cache with batch ops | existing (src/lib/planning-cache.js) |
| `DECISION_REGISTRY` | In-process routing decisions (19 functions) | existing (src/lib/decisions.js) |
| `execute:tdd` | RED/GREEN/REFACTOR validation with TDD-aware semantics | existing (src/commands/execute/tdd.js) |
| `phase:snapshot` | Single-call phase metadata with extended TDD context | existing (src/commands/phase.js) |

**Key supporting libs (existing):** fast-glob (3.3.3), valibot (1.2.0), fuse.js (7.1.0), acorn (bundled)

**Avoid:** `lru-cache` (CLI short-lived, Map sufficient), `worker_threads` (CPU-bound parallelism not the bottleneck), new async I/O infrastructure (sync I/O appropriate for CLI tool)

**Install:** `npm install` (no new packages)

<!-- /section -->

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|----------------|
| `node:sqlite` (built-in) | Node 22.5+ | Hot-path routing cache + TDD rationale storage | Extend existing `routing_decisions` table to include TDD eligibility and decision rationale; zero-cost addition |
| `node:child_process` (built-in) | Node 22.5+ | Parallel workflow stage execution | v19.3 parallel stages extend naturally to TDD handoff coordination; no new process management needed |
| `PlanningCache` | existing | SQLite-backed mtime cache | Already handles roadmap/plan/task caching; extend with TDD decision metadata |
| `DECISION_REGISTRY` | existing (19 functions) | Deterministic routing decisions | Add `resolveTddEligibility` decision function (HIGH confidence) to evaluate TDD fitness per plan |
| `execute:tdd` | existing | TDD RED/GREEN/REFACTOR validation | Extend semantics beyond exit-code checks; validate actual behavior state transitions |
| `node:test` (built-in) | Node 22.5+ | E2E fixture tests for TDD flow | Existing test infrastructure; add TDD E2E fixture tests for Phase C deliverable |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fast-glob` | 3.3.3 | File discovery for batch operations | TDD fixture file discovery; phase snapshot artifact scanning |
| `valibot` | 1.2.0 | Schema validation for TDD decision rationale | Validate TDD rationale schema in SQLite; existing pattern from v19.3 routing tables |
| `fuse.js` | 7.1.0 | Fuzzy matching for TDD plan lookup | When TDD decision rationale needs fuzzy plan name matching |
| `acorn` (bundled) | bundled | AST parsing for task complexity | TDD plan complexity scoring; already used in `orchestration.js` |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --test` | Test runner | Existing test suite; add TDD E2E fixture tests |
| `esbuild` | Bundler | Already in use; no changes needed |
| `npm run build` | Production build | Already validates single-file output |
| `workflow:baseline` / `workflow:compare` | Acceleration measurement | v19.3 infrastructure; use before/after any routing/caching changes |

---

## Installation

No new packages. Ensure existing dependencies are current:

```bash
# Core (no changes — existing packages sufficient)
npm install

# Verify current package versions
npm list fast-glob valibot fuse.js ignore inquirer
```

Existing packages and their verified current versions:
- `fast-glob@^3.3.3` — stable, no update needed
- `valibot@^1.2.0` — stable, adequate for schema validation needs
- `fuse.js@^7.1.0` — stable, adequate for fuzzy search needs
- `ignore@^7.0.5` — stable
- `inquirer@^8.2.6` — stable
- `acorn@^8.16.0` — bundled, dev dependency
- `esbuild@^0.27.3` — dev dependency, stable

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| `node:sqlite` (built-in) | `better-sqlite3` | If native performance is critical; adds C++ dependency and breaks single-file deploy |
| `node:child_process` (built-in) | `execa` / `spawn-wrap` | If process management complexity grows beyond `spawn()`; adds dependency |
| Existing `PlanningCache` | Separate TDD cache store | Not warranted — TDD metadata is small; sharing `routing_decisions` table is sufficient |
| `node:test` (built-in) | `ava` / `jest` | If parallel fixture execution needed; adds dependency, existing `node:test` is adequate |
| Map-based LRU | `lru-cache` npm | If CLI lifetime grows beyond short-lived; current Map is sufficient |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|------------|
| `lru-cache` npm package | CLI processes are short-lived (<5s); Map eviction is not a concern; adds bundle size | Plain `Map` or extend `PlanningCache` with TTL tables |
| `worker_threads` | CPU-bound parallelism not the bottleneck; routing decisions are I/O-bound, not compute-bound | Pre-computed routing tables in SQLite |
| New async I/O infrastructure | "Async I/O rewrite — Synchronous I/O is appropriate for CLI tool" is explicitly out of scope | Batch sync operations with `Promise.all` over `spawn` |
| Separate cache service | Over-engineering for CLI tool; SQLite at `.planning/.cache.db` is sufficient | Extend existing `PlanningCache` |
| New npm packages for TDD | TDD reliability hardening is logic/templating work, not capability work | Use existing `execute:tdd`, `DECISION_REGISTRY`, and `node:test` infrastructure |

---

## Stack Patterns by Variant

**If extending workflow acceleration (from v19.3):**
- Pre-compute `resolveTddEligibility` results and store in `routing_decisions` table with TTL
- Add TDD eligibility columns to existing `routing_decisions` schema: `(plan_path, tdd_eligible, tdd_rationale, decided_at)`
- Extend `phase:snapshot` output to include TDD decision context for downstream consumption
- Parallel handoff writes use `withProjectLock` coordination via existing `phase-handoff.js` pattern

**If hardening TDD reliability:**
- Add `resolveTddEligibility` to `DECISION_REGISTRY` with HIGH confidence — planner always evaluates TDD fitness
- Store TDD decision rationale in existing `must_haves` metadata field (already structured for arbitrary key/value)
- Extend `execute:tdd` validator to check actual RED/GREEN/REFACTOR behavior state, not just shell exit codes
- Three-level checker compliance via existing `verify:quality` infrastructure with new `required`/`recommended`/informational tiers
- TDD E2E fixture tests use existing `node:test` with fixture plans in `.planning/milestones/*/fixtures/`

**If adding TDD rationale to plan output:**
- TDD decision rationale stored as structured metadata in plan frontmatter
- Rendered in `summary:generate` output via existing template markers
- Consumed by `execute:tdd` for audit trail continuity

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `node:sqlite` (built-in) | Node 22.5+ only | Graceful Map fallback on older Node (existing pattern) |
| `valibot@1.2.0` | Node 12+ | Current version is adequate; schema performance not a bottleneck |
| `fast-glob@3.3.3` | Node 12+ | Already matches Node 22.5+ requirement |
| `PlanningCache` (SQLite) | WAL mode enabled | Concurrent reads safe; single-writer coordination via WAL |
| `node:test` (built-in) | Node 18+ | E2E fixture tests require Node 18+; matches project minimum |

---

## Integration Points

### TDD Reliability Hardening

| Integration | Approach |
|-------------|----------|
| Planner → TDD eligibility | Add `resolveTddEligibility` to `DECISION_REGISTRY`; planner calls during plan generation |
| Plan → TDD rationale | Store in existing `must_haves.tdd_rationale` field; render in summary output |
| Checker → TDD compliance | Extend `verify:quality` with three-tier TDD compliance levels |
| `execute:tdd` → behavior validation | Extend RED/GREEN/REFACTOR checks beyond exit codes; validate actual test behavior |
| TDD audit trail | Extend existing `-TDD-AUDIT.json` schema; preserve through handoff refreshes |

### Workflow Acceleration Continuation

| Integration | Approach |
|-------------|----------|
| Planner self-check | Store self-check verdict in `routing_decisions`; conditional checker spawn based on confidence |
| Parallel stages (v19.3) | Extend mutex-protected cache writes to TDD handoff coordination |
| `phase:snapshot` | Extend to include TDD eligibility context from `resolveTddEligibility` |

---

## Sources

- **Context7** — `node:sqlite` built-in docs, `node:child_process` built-in docs, `node:test` built-in docs
- **Official docs** — JJ workspace docs (parallel execution context)
- **Local project** — `src/lib/planning-cache.js`, `src/lib/orchestration.js`, `src/lib/decisions.js`, `src/lib/phase-handoff.js`, `src/commands/execute/tdd.js`
- **v19.3 STACK.md** — `.planning/research/STACK.md` (no new dependencies recommended)
- **TDD-RELIABILITY-PRD** — `.planning/research/completed/TDD-RELIABILITY-PRD.md` (Phase A/B/C requirements)
- **WORKFLOW-ACCELERATION-PRD** — `.planning/research/completed/WORKFLOW-ACCELERATION-PRD.md` (continuation scope)

---

*Stack research for: v19.4 Workflow Acceleration II + TDD Reliability*
*Researched: 2026-04-06*
