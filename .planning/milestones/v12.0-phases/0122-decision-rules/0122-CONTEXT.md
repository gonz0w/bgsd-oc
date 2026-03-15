# Phase 122: Decision Rules - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Six new deterministic decision functions that resolve common workflow questions from SQLite-backed state. The rules cover: model selection, verification routing, research gating, phase readiness (merged into existing plan-existence-route), milestone completion, and commit strategy. No subprocess calls, no LLM inference needed.

</domain>

<decisions>
## Implementation Decisions

### SQLite Integration Pattern
- **Hybrid approach:** High-frequency rules (called every command) use pre-fetched state from the enricher. Low-frequency rules (called once per session) can query SQLite directly.
- **DB connection:** Enricher opens the SQLite connection and passes the handle as part of the state object. Rules that need direct queries reuse this shared handle.
- **Fallback:** When SQLite is unavailable (DB not created, corrupted), rules gracefully fall back to file-based parsing (JSON/MD files) like today. Always return a result.
- **State shape:** ALL rules (existing and new) receive the DB handle in state (may be null). Uniform contract.

### Rule Definitions (5 New + 1 Expanded)
- **model-selection** — Resolves model from config + agent role. Returns `{ tier, model }`. Category: `configuration`.
- **verification-routing** — Decides full vs light verification based on phase complexity and change scope. Category: `workflow-routing`.
- **research-gate** — Single compound rule: decides skip/run AND depth level. Returns `{ run: boolean, depth: 'quick'|'deep' }`. Category: `workflow-routing`.
- **plan-existence-route (expanded)** — Merged with phase-readiness. Now checks plans + dependency completion + context quality (CONTEXT.md exists, research done). Preserves old return values ('has-plans', 'needs-planning', 'needs-research') and adds new values ('ready', 'blocked-deps', 'missing-context'). Category: `workflow-routing`.
- **milestone-completion** — Decides if milestone is ready to complete AND what action to take (archive phases, bump version, advance). Category: `state-assessment`.
- **commit-strategy** — Single compound rule: resolves both commit granularity (per-task vs per-plan) and commit message prefix (feat/fix/docs/refactor). Returns `{ granularity, prefix }`. Category: `execution-mode`.

### Model Selection Logic
- **Source:** SQLite `model_profiles` table. Auto-seeded with defaults (quality/balanced/budget tiers with standard models) on first access. Zero config needed.
- **Override priority:** Per-agent override always wins over tier default. Simple and predictable.
- **Validation:** Rule validates against a static known-models list in code, plus user-added custom model IDs via config. Falls back to tier default if configured model is unknown.
- **Output:** Returns `{ tier: string, model: string }` — caller gets both tier context and specific model ID.
- **Skill replacement:** The model-profiles skill file is deprecated. The SQLite-backed rule becomes the single source of truth.

### Backward Compatibility
- **plan-existence-route merge:** Expanded rule preserves all existing return values. New values added alongside, not replacing.
- **Success criteria update:** 5 new rules + 1 expanded rule (not "6 new rules alongside existing").
- **Registration:** New rules self-register via the existing DECISION_REGISTRY pattern. Auto-discovery, no manual registry edits.
- **Categories:** New rules use existing category names (workflow-routing, execution-mode, state-assessment, configuration). No new categories.

</decisions>

<specifics>
## Specific Ideas

- Compound rules (research-gate, commit-strategy) return object values rather than simple strings, keeping the rule count manageable.
- The plan-existence-route expansion is the most delicate change — old callers must keep working without code changes.
- Model profiles auto-seeding means new projects get sensible defaults immediately.
- Static known-models list with user additions handles both standard and private/custom model deployments.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 0122-decision-rules*
*Context gathered: 2026-03-14*
