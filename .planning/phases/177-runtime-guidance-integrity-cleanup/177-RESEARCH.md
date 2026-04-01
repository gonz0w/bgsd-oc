# Phase 177: Runtime Guidance Integrity Cleanup - Research

**Researched:** 2026-04-01
**Domain:** Plugin runtime guidance, command-integrity validation, generated bundle parity
**Confidence:** HIGH

## User Constraints

- Phase purpose is fixed by the effective intent and roadmap contract: close the narrow SAFE-03 runtime guidance gap where shipped runtime/plugin roadmap follow-up guidance is canonical in name but not runnable because required operands are missing.
- Keep scope inside the promised milestone boundary from `ROADMAP.md`, `REQUIREMENTS.md`, and the linked PRDs. Do not absorb unrelated validator debt from docs, agents, or other workflows into this phase.
- Treat `plugin.js` as a generated shipped artifact, not the source of truth. Runtime-sensitive source edits must be made in `src/plugin/*` and then rebuilt so the shipped bundle stays aligned.
- No project-local `.agents/skills` directory exists.
- `.planning/ASSERTIONS.md` does not exist, so there are no recorded SAFE-03 assertions to inherit.

## Phase Requirements

- **SAFE-03:** Users see help and workflow guidance that match the real supported command surface after cleanup, with stale aliases or contradictory guidance removed.

## Summary

Phase 177 is a narrow runtime-surface cleanup, not a general command-integrity sweep. The concrete gap is in `src/plugin/advisory-guardrails.js`, where `PLANNING_COMMANDS.ROADMAP.md` still advertises bare `/bgsd-plan roadmap add|remove|insert` routes without their required operands. That source is bundled into shipped `plugin.js`, and the milestone audit cites the built runtime artifact directly (`plugin.js:10443`) as the evidence for the open SAFE-03 failure.

The repo already established the canonical roadmap command shapes in Phase 175 workflow and guidance tests: roadmap add needs a description, roadmap remove needs a phase number, and roadmap insert needs both a position and a description. The validator confirms the runtime gap today: `node bin/bgsd-tools.cjs util:validate-commands --raw` reports three `missing-argument` issues on `plugin.js` for those bare roadmap commands. This means the plan should update the source mapping to operand-complete canonical syntax or clearly marked reference syntax, rebuild `plugin.js`, and add focused regression coverage that locks source, bundle, and validator behavior together.

The main planning risk is over-scoping. The same validator run reports many unrelated agent, docs, and workflow issues, plus a separate runtime false positive around `Next: /bgsd-plan phase ...`. The roadmap and milestone audit only trace Phase 177 to the incomplete roadmap suggestions, so the plan should explicitly avoid turning this into a broad validator cleanup unless a touched test or validator path makes that unavoidable.

**Primary recommendation:** Plan Phase 177 as 2-3 small slices: canonicalize the runtime roadmap command map in `src/plugin/advisory-guardrails.js`, rebuild `plugin.js`, then add targeted runtime and validator regressions proving the shipped roadmap guidance is runnable or clearly reference-only.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | node18 target | Runtime and test execution | Repo build and bundled outputs target Node 18 in `build.cjs`. |
| esbuild | repo-installed | Build `bin/bgsd-tools.cjs` and `plugin.js` | `build.cjs` is the canonical source-to-bundle path for shipped artifacts. |
| `validateCommandIntegrity` | repo internal | Command-shape validation for surfaced guidance | Existing command-integrity contract already knows the canonical planning-family operand requirements. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` | built-in | Focused regression coverage | Use for source, bundle, and validator contract tests. |
| `src/plugin/advisory-guardrails.js` | repo source | Source-of-truth for planning edit advisory messages | Change here first when runtime planning guidance changes. |
| `plugin.js` | generated artifact | Shipped plugin runtime bundle | Verify after rebuild; never treat as the editable source of truth. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Placeholder-based canonical syntax in the advisory map | Concrete example commands with sample values | Examples are runnable, but can drift or imply literal values; placeholder syntax better matches the success criterion's "required operands or clearly marks them as reference syntax" wording. |
| Targeted runtime-validator proof | Broad `util:validate-commands --raw` clean run as the phase gate | Broad clean run is currently blocked by unrelated backlog; it would over-scope the phase. |
| Source edit + rebuild | Direct `plugin.js` edit | Direct bundle edits are non-canonical and will drift on the next build. |

## Architecture Patterns

### Recommended Project Structure

- Source-of-truth change in `src/plugin/advisory-guardrails.js`
- Rebuild generated runtime artifact via `npm run build`
- Verify shipped output in `plugin.js`
- Lock behavior with focused tests in `tests/plugin-advisory-guardrails.test.cjs` and runtime guidance integrity tests

### Pattern 1: Source-to-Bundle Runtime Guidance Parity

This repo already treats runtime guidance as a source-to-bundle contract. Earlier phases verified that runtime-sensitive changes must rebuild `plugin.js` and then assert bundle parity. Phase 177 should follow the same pattern: update the advisory source mapping, rebuild the bundle, and prove both source and bundle surface the corrected canonical roadmap syntax.

### Pattern 2: Reuse Existing Canonical Command Contract

Do not invent a new roadmap guidance registry or custom validator exception. The canonical command family already exists in workflow docs and `validateCommandIntegrity`. Phase 177 should make the plugin runtime consume that existing contract more faithfully by using operand-complete roadmap commands or explicit reference syntax in the one remaining static map.

### Pattern 3: Targeted Proof For The Narrow Gap

The milestone audit evidence is specific: incomplete roadmap suggestions in runtime/plugin guidance. Tests should therefore prove three things only: the advisory message contains valid roadmap follow-up syntax, the rebuilt bundle preserves it, and command-integrity validation no longer reports the roadmap `missing-argument` gap on the runtime surface.

### Anti-Patterns to Avoid

- Fixing unrelated docs, agent prompts, or workflow validator failures in the same phase just because `util:validate-commands --raw` still reports them.
- Editing `plugin.js` directly without the matching source change and rebuild.
- Leaving roadmap commands canonical in name but operand-incomplete in usage.
- Adding compatibility aliases or fallback guessing for roadmap follow-up commands; the milestone direction is canonical-only surfaced guidance.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime roadmap guidance source | A second plugin-only registry or formatter | The existing `PLANNING_COMMANDS` map in `src/plugin/advisory-guardrails.js` | Smallest correct fix with lowest drift risk. |
| Shipped runtime verification | Manual visual spot-check only | Focused `node:test` assertions plus rebuilt `plugin.js` checks | The repo already protects runtime guidance with regression tests and bundle parity expectations. |
| Command-shape rules | Ad hoc string validation | Existing `validateCommandIntegrity` behavior and known Phase 175 canonical roadmap syntax | Reuses the supported command-surface contract instead of duplicating it. |

## Common Pitfalls

### Pitfall 1: Fixing the bundle but not the source
**What goes wrong:** `plugin.js` is patched or inspected in isolation, but `src/plugin/advisory-guardrails.js` remains stale.
**Why it happens:** The milestone audit cites the shipped bundle, so it is easy to focus on the artifact instead of the source.
**How to avoid:** Treat `src/plugin/advisory-guardrails.js` as the only edit target and require `npm run build` before verification.
**Warning signs:** Source and bundle strings diverge, or the next build reintroduces the bad guidance.

### Pitfall 2: Canonical command names without required operands
**What goes wrong:** Guidance says `/bgsd-plan roadmap add` or `/bgsd-plan roadmap insert` but omits required arguments, so users still hit missing-argument failures.
**Why it happens:** Canonical route-family cleanup can stop at route naming and miss route shape.
**How to avoid:** Use operand-complete syntax such as `<phase-number>`, `<after>`, and `"<description>"`, or mark the strings clearly as reference syntax.
**Warning signs:** `validateCommandIntegrity` reports `missing-argument` on the runtime surface.

### Pitfall 3: Broad validator cleanup swallows the phase
**What goes wrong:** Work expands into unrelated validator findings in docs, workflows, or agent prompts.
**Why it happens:** `util:validate-commands --raw` currently reports 18 issues across 12 files, not just the roadmap gap.
**How to avoid:** Keep acceptance focused on eliminating the runtime/plugin roadmap guidance gap and use targeted runtime-surface assertions.
**Warning signs:** The plan starts touching `docs/`, `agents/`, or unrelated workflow files without a direct runtime roadmap reason.

### Pitfall 4: Runtime tests stay too shallow
**What goes wrong:** Existing tests only check that a warning mentions `/bgsd-plan roadmap add`, which would still pass with the current broken operand-less text.
**Why it happens:** Earlier tests locked canonical family names but not full argument shapes on this runtime slice.
**How to avoid:** Upgrade tests to assert full roadmap syntax and bundle parity, not just substring presence.
**Warning signs:** The plugin-advisory test suite passes while `util:validate-commands --raw` still flags `plugin.js`.

## Code Examples

Verified repo patterns for the canonical roadmap family already exist in workflow tests and should be mirrored by runtime guidance:

```js
// Current source of truth to update
const PLANNING_COMMANDS = {
  'ROADMAP.md': [
    '/bgsd-plan roadmap add',
    '/bgsd-plan roadmap remove',
    '/bgsd-plan roadmap insert'
  ]
};
```

Recommended shape for runtime-safe reference syntax:

```js
const PLANNING_COMMANDS = {
  'ROADMAP.md': [
    '/bgsd-plan roadmap add "<description>"',
    '/bgsd-plan roadmap remove <phase-number>',
    '/bgsd-plan roadmap insert <after> "<description>"'
  ]
};
```

The command shapes above match the established canonical guidance already protected elsewhere in the repo:

- `workflows/add-phase.md`
- `workflows/insert-phase.md`
- `workflows/remove-phase.md`
- `tests/guidance-command-integrity-workflow-prep-a.test.cjs`

## Suggested Plan Slices

1. **Canonicalize runtime roadmap guidance source**
   Update `src/plugin/advisory-guardrails.js` so `ROADMAP.md` guidance uses operand-complete canonical syntax or explicit reference syntax. Keep the change isolated to the roadmap mapping.

2. **Rebuild shipped runtime artifact**
   Run `npm run build` so `plugin.js` reflects the source change. Verify the built bundle contains the updated roadmap guidance and preserves existing unaffected planning guidance.

3. **Lock the gap with focused regressions**
   Extend `tests/plugin-advisory-guardrails.test.cjs` to assert full roadmap command shapes, and add or extend a runtime guidance integrity test that checks both `src/plugin/advisory-guardrails.js` and `plugin.js` for the corrected roadmap syntax. Use targeted command-integrity proof for the runtime surface if needed.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Runtime guidance could surface legacy planning wrappers or bare canonical names without runnable arguments | Repo guidance increasingly uses one canonical planning family with operand-complete examples and validator-backed integrity checks | Phases 158, 159, 165, and 175 | Most guidance surfaces are aligned, leaving this runtime roadmap mapping as a narrow remaining gap. |
| Source-only guidance edits could leave shipped runtime stale | Runtime-sensitive plugin changes are expected to rebuild `plugin.js` and prove source-to-bundle parity | Phase 165 | Phase 177 must include rebuild + bundle verification, not just source edits. |

## Open Questions

- Should the advisory warning prefer placeholder reference syntax (`<phase-number>`, `"<description>"`) or concrete runnable examples? The roadmap wording permits either, but placeholder syntax is the tighter low-drift choice.
- Is a dedicated runtime-surface validator test needed, or is extending the existing runtime/bundle integrity suite enough once it asserts full roadmap command shapes? Either is viable; choose the smaller proof that fails on operand regression.

## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/MILESTONE-INTENT.md`
- `.planning/research/CLI-SIMPLIFICATION-PRD.md`
- `.planning/research/GREENFIELD-COMPAT-CLEANUP-PRD.md`
- `.planning/v18.1-MILESTONE-AUDIT.md`
- `src/plugin/advisory-guardrails.js`
- `plugin.js`
- `build.cjs`
- `tests/plugin-advisory-guardrails.test.cjs`
- `tests/guidance-command-integrity-workflow-prep-a.test.cjs`
- `tests/guidance-command-integrity-templates-runtime.test.cjs`
- `tests/guidance-remaining-surfaces.test.cjs`
- `tests/validate-commands.test.cjs`
- `node bin/bgsd-tools.cjs util:validate-commands --raw`

### Secondary (MEDIUM confidence)
- `.planning/phases/175-canonical-command-surface-alignment/175-VERIFICATION.md`
- `.planning/phases/175-canonical-command-surface-alignment/175-01-SUMMARY.md`
- `.planning/milestones/v17.1-phases/165-jj-execution-repo-local-verification/165-RESEARCH.md`
- `.planning/milestones/v17.1-phases/165-jj-execution-repo-local-verification/165-VERIFICATION.md`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Phase scope and boundary: HIGH
- Runtime source-of-truth location: HIGH
- Bundle rebuild path: HIGH
- Suggested verification shape: HIGH
- Placeholder-vs-example wording choice: MEDIUM

**Research date:** 2026-04-01
**Valid until:** Next command-integrity or plugin-runtime architecture change that modifies how advisory planning guidance is sourced or validated.
