# Phase 77: Validation Engine Modernization - Research

**Researched:** 2026-03-09
**Domain:** Plugin tool argument validation performance and compatibility-preserving migration
**Confidence:** HIGH

## User Constraints

- Preserve behavior and output contracts for all plugin tools (`VALD-02`).
- Keep rollback safety via an explicit fallback path (`VALD-03`).
- Maintain project guardrails: backward compatibility for `.planning/` artifacts, single-file deploy flow, and Node 18+ runtime compatibility.
- Scope is dependency-driven acceleration only; avoid broader architecture rewrites in this phase.

## Phase Requirements

- `VALD-01`: Lower schema-validation overhead by replacing Zod hot-path usage with a lighter validator engine.
- `VALD-02`: Keep identical behavior and output contracts after migration.
- `VALD-03`: Provide fallback to legacy validation path for compatibility issues.

## Current Baseline (What Exists)

- Zod is currently imported in all five plugin tools:
  - `src/plugin/tools/bgsd-status.js`
  - `src/plugin/tools/bgsd-plan.js`
  - `src/plugin/tools/bgsd-context.js`
  - `src/plugin/tools/bgsd-validate.js`
  - `src/plugin/tools/bgsd-progress.js`
- Actual schema usage is small and concentrated in tool `args` definitions (`z.coerce.number`, `z.enum`, optional string/number patterns), so migration blast radius is narrow.
- Plugin tests already enforce tool shape and JSON response contracts (`tests/plugin.test.cjs`), including no-project behavior and key output fields.
- Existing project direction already recommends `valibot` for this phase (`.planning/research/SUMMARY.md`).

## Standard Stack Recommendation

### Core

| Library | Version | Purpose | Why Standard for Phase 77 |
|---------|---------|---------|----------------------------|
| `valibot` | `1.2.0` | Runtime schema validation for plugin tool args | Lower validator weight and modular API suitable for small arg schemas |

### Keep for fallback

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | current bundled version | Legacy validator path | Fallback mode and parity/shadow comparison while stabilizing migration |

## Implementation Options

### Option A (recommended): Dual-engine adapter with feature flag

- Introduce a validation adapter layer used by plugin tools, not direct library calls from each tool file.
- Default path uses `valibot`; fallback path uses existing Zod schema behavior.
- Gate with env/config flag (for example `BGSD_DEP_VALIBOT=1` and `BGSD_DEP_VALIBOT_FALLBACK=1` semantics).
- Add optional shadow-compare mode in debug runs to detect mismatches before default-on.

**Why this is best:** Meets all three requirements with lowest rollout risk and fastest rollback.

### Option B: Direct in-file migration of all tool schemas

- Replace each `z` usage with `valibot` directly in tool files.
- Keep one global switch to choose implementation branch.

**Tradeoff:** Faster initial coding, but weaker long-term maintainability and harder parity instrumentation.

### Option C: Keep Zod, switch to `zod/mini`

- Smaller step, lower migration effort, parse/safeParse API compatibility remains close.

**Tradeoff:** May not deliver enough overhead reduction for `VALD-01`, and does not align with milestone dependency choice already researched.

## Recommended Plan Shape (Planning Guidance)

1. Build validator adapter seam plus flags (no behavior change by default).
2. Port one low-risk tool first (`bgsd_plan` or `bgsd_context`) and verify parity.
3. Port remaining tools, keeping fallback path live.
4. Enable `valibot` default after parity passes in plugin tests and smoke checks.

This supports small, reversible tasks and aligns with typical 2-3 task planning waves.

## Key Technical Risks and Mitigations

1. Coercion semantics drift (`z.coerce.number()` vs Valibot pipeline transforms)
   - Mitigation: Explicit Valibot pipelines (`string` -> `decimal` -> `transform(Number)`) and parity tests for edge inputs.
2. Error payload/message drift exposed to callers
   - Mitigation: Preserve tool-level returned JSON contract; avoid exposing library-native error objects directly.
3. Silent contract regressions in tool definitions
   - Mitigation: Extend `tests/plugin.test.cjs` with targeted arg validation contract cases per tool.
4. Rollback not fast enough during incidents
   - Mitigation: Keep legacy Zod path in-process behind flag; no data migration required.

## Don't Hand-Roll

| Problem | Don’t Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema parsing DSL | Custom validator parser | `valibot` schemas/actions | Avoid correctness and maintenance burden |
| Runtime flag framework | New custom toggles system | Existing env/config guard pattern used in repo | Keeps rollout consistent with other dependency migrations |
| Manual JSON contract checking | Ad-hoc scripts only | Existing plugin test suite + added parity tests | Reuses established safety net |

## Verification Implications (Critical for Planning)

- Required verification levels:
  - Existence: adapter + flags + migrated tool schemas present.
  - Substantive: valibot path actually executes in plugin tool registration and runtime calls.
  - Wired: flag switching reaches both primary and fallback paths.
  - Functional: outputs remain contract-identical for successful and common invalid-input cases.
- Minimum test gates for this phase:
  - `npm test` (full suite as milestone baseline)
  - Focused run on `tests/plugin.test.cjs` during development loop
  - Build validation (`npm run build`) to confirm single-file deploy artifact remains valid.
- Add/adjust tests for:
  - `bgsd_plan.args.phase` coercion parity
  - `bgsd_context.args.task` coercion parity
  - `bgsd_progress.args.action` enum parity
  - Missing/invalid arg handling paths returning stable JSON envelopes

## Sources

### Primary (HIGH confidence)

- Repository context and constraints:
  - `.planning/STATE.md`
  - `.planning/REQUIREMENTS.md`
  - `.planning/PROJECT.md`
  - `.planning/research/SUMMARY.md`
  - `src/plugin/tools/*.js`
  - `tests/plugin.test.cjs`

### Secondary (MEDIUM confidence)

- Valibot docs via Context7 (`/fabian-hiller/valibot`): `safeParse`, enum schemas, strict object schemas, migration guidance from Zod.
- Zod docs via Context7 (`/colinhacks/zod/v4.0.1`): `safeParse`, coercion semantics, Zod Mini compatibility notes.

## Open Questions for Planner

- Should default-on switch for `valibot` happen inside Phase 77, or remain opt-in until Phase 81 safety/parity closure?
- Is `zod` retained temporarily for one milestone (recommended), or removed in same phase after parity passes?

## Metadata

- Confidence breakdown: HIGH on codebase-specific scope and migration shape; MEDIUM on exact runtime gain magnitude until benchmarked in this repo.
- Valid until: Next major plugin-tool API refactor or validator-library version jump.
