# Phase 179: Shipped Guidance Surface Integrity - Research

**Researched:** 2026-04-01
**Domain:** Shipped plugin runtime guidance, command-integrity validation, bundle parity
**Confidence:** HIGH

## User Constraints

- Phase scope is narrow and fixed by the roadmap, milestone audit, requirement traceability, and the provided phase brief: close the shipped runtime/plugin next-step guidance gap only.
- Treat the injected planning alignment contract as authoritative for project, milestone, and phase purpose: this phase exists to make shipped guidance runnable as surfaced, not to solve the full repo-wide validator backlog.
- Keep Phase 180 boundaries intact. Docs, workflows, agent prompts, internal bootstrap examples, and broader validator false positives stay out of scope unless they are a direct blocker to making shipped runtime guidance validator-clean.
- `plugin.js` is a generated shipped artifact. Edit `src/plugin/*`, rebuild, then verify the bundle; do not plan direct bundle edits.
- No `CONTEXT.md` exists for this phase, so there are no locked implementation decisions beyond the phase contract.
- No `ASSERTIONS.md` exists, so the plan must create its own focused proof slices for the shipped runtime surfaces.
- No project-local `.agents/skills/` directory exists.

## Phase Requirements

- **SAFE-03:** Users see help and workflow guidance that match the real supported command surface after cleanup, with stale aliases or contradictory guidance removed.

## Summary

Phase 179 is now even narrower than the milestone audit snapshot suggests. The audit reopened two shipped-runtime issues: the idle-validator action string in `plugin.js` still surfaced `Next: /bgsd-plan phase ...`, and the shipped advisory map still appeared to have operand-incomplete roadmap commands. Current repo evidence shows the Phase 177 roadmap operand gap is already closed in both source and bundle: `src/plugin/advisory-guardrails.js` and `plugin.js` now contain operand-complete roadmap guidance, related focused tests already assert those shapes, and the live `node bin/bgsd-tools.cjs util:validate-commands --raw` run no longer reports any roadmap `missing-argument` issue on `plugin.js`.

The only current shipped-runtime validator failure is the idle-validator notification action in `plugin.js`, where the surfaced action still starts with `Next:` and is therefore parsed as a malformed command. The source of truth is `src/plugin/idle-validator.js`, which currently sets `action: \`Next: /bgsd-plan phase ${nextPhase.number}\``. That string is bundled unchanged into `plugin.js`, and the live validator reports it as the sole runtime issue. This means the best Phase 179 plan is a small source-to-bundle parity repair: canonicalize that action to a runnable planning command, rebuild `plugin.js`, and lock the fix with focused regression coverage on both source and shipped artifact behavior.

The main planning risk is stale local proof encoding the current bad string. Existing tests in `tests/plugin.test.cjs` and fixture-style plan assertions in `tests/integration.test.cjs` still explicitly expect `Next: /bgsd-plan phase`. If the phase only edits the plugin source, those checks will fail or continue teaching the malformed form. The plan should therefore include expectation updates as part of the narrow runtime surface repair, while leaving the separate CLI example parsing drift and repo-wide surfaced-validator backlog to Phase 180.

**Primary recommendation:** Plan Phase 179 as 2-3 tight slices: fix the idle-validator action in `src/plugin/idle-validator.js`, rebuild `plugin.js`, then update focused runtime tests and validator-backed assertions so shipped next-step guidance remains canonical and runnable without reopening broader validator work.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | node18 target | Runtime, build, and tests | `build.cjs` targets Node 18 for both CLI and plugin bundle outputs. |
| esbuild | repo-installed | Build `bin/bgsd-tools.cjs` and `plugin.js` | `build.cjs` is the canonical path from source edits to shipped bundle artifacts. |
| `validateCommandIntegrity` | repo internal | Surface-command validation | Existing validator already catches the malformed `Next:` runtime action in `plugin.js`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` | built-in | Focused regression coverage | Use for source, bundle, and validator-backed shipped-runtime assertions. |
| `src/plugin/idle-validator.js` | repo source | Source of truth for phase-complete runtime guidance | Edit here first when changing surfaced next-step guidance. |
| `plugin.js` | generated artifact | Shipped plugin runtime bundle | Verify after rebuild; never treat as editable source. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Editing `plugin.js` directly | Source edit plus rebuild | Direct bundle edits are non-canonical and will be lost on rebuild. |
| Broad `util:validate-commands --raw` green repo gate | Focused runtime/plugin acceptance plus one validator spot-check | Broad green runs still fail on unrelated Phase 180 surfaces, so they would over-scope this phase. |
| Keeping `Next:` in prose and teaching users to copy the suffix manually | Surface the canonical command directly in the action field | The phase goal requires users to run guidance exactly as surfaced. |

## Architecture Patterns

### Recommended Project Structure

- Change `src/plugin/idle-validator.js`
- Rebuild shipped artifact via `npm run build`
- Verify `plugin.js` bundle parity
- Update focused tests in `tests/plugin.test.cjs`, `tests/validate-commands.test.cjs`, and any fixture assertions that intentionally encode the old malformed string

### Pattern 1: Source-to-Bundle Runtime Guidance Parity

The plugin runtime contract in this repo is source-first and bundle-verified. Runtime guidance changes belong in `src/plugin/*`, then `npm run build` must regenerate `plugin.js`, and verification should assert the shipped bundle contains the same canonical guidance string.

### Pattern 2: Validator-As-Contract, Not Validator-As-Scope-Expander

Use `validateCommandIntegrity` to prove the touched runtime surface is clean, but do not let unrelated validator output pull docs, workflows, or agents into this phase. The live validator already isolates `plugin.js` as the only remaining runtime failure.

### Pattern 3: Runnable Next-Step Surfaces Must Be Literal Commands

For action-style runtime surfaces, placeholder prose prefixes like `Next:` are not acceptable because users are expected to run the surfaced string as-is. Action fields should contain the runnable canonical command only, while surrounding explanatory prose can stay in the message body.

### Anti-Patterns to Avoid

- Turning this phase into a general cleanup of all remaining `util:validate-commands --raw` findings.
- Editing `plugin.js` without the matching source change in `src/plugin/idle-validator.js`.
- Preserving `Next:` in the action field and hoping the validator or UI will strip it.
- Reworking `validateCommandIntegrity()` unless a direct shipped-runtime proof gap makes it unavoidable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase-complete next-step guidance | A new formatter or secondary runtime guidance registry | The existing notification payload in `src/plugin/idle-validator.js` | Smallest correct fix with lowest drift risk. |
| Shipped-runtime proof | Manual eyeballing of `plugin.js` only | Focused `node:test` assertions plus validator spot-checks | Existing repo patterns already protect runtime guidance this way. |
| Bundle synchronization | Manual bundle patching | `npm run build` | Keeps shipped artifact aligned with the actual source of truth. |

## Common Pitfalls

### Pitfall 1: Fixing source but leaving shipped proof stale
**What goes wrong:** `src/plugin/idle-validator.js` is corrected, but tests or fixture assertions still expect `Next: /bgsd-plan phase`.
**Why it happens:** Some current regression coverage was written around the malformed shipped string rather than the intended runnable action contract.
**How to avoid:** Update all touched runtime assertions in the same phase slice and verify both source and built artifact expectations.
**Warning signs:** `npm test` or targeted tests fail on string expectations after the source fix.

### Pitfall 2: Accidentally absorbing Phase 180
**What goes wrong:** The plan starts fixing agent prompts, docs, workflow examples, or CLI parser classification drift because the broad validator run is still red.
**Why it happens:** `util:validate-commands --raw` still reports 10 issues across non-runtime surfaces.
**How to avoid:** Keep acceptance tied to `src/plugin/idle-validator.js`, rebuilt `plugin.js`, and runtime/plugin guidance tests only.
**Warning signs:** The plan starts editing `agents/`, `docs/`, `workflows/`, or validator parsing helpers without a direct runtime dependency.

### Pitfall 3: Keeping explanatory prose inside the runnable action
**What goes wrong:** The action remains something like `Next: /bgsd-plan phase 179` or similar mixed prose-command text.
**Why it happens:** UI copy and runnable command payloads are conflated.
**How to avoid:** Leave prose in `message`, keep `action` as the canonical command only.
**Warning signs:** `validateCommandIntegrity` still reports a `nonexistent-command` or malformed command for `plugin.js`.

### Pitfall 4: Missing bundle rebuild verification
**What goes wrong:** Source changes look correct, but `plugin.js` is stale or the build step changes neighboring runtime strings unexpectedly.
**Why it happens:** The shipped artifact is generated separately.
**How to avoid:** Require `npm run build`, then verify the exact runtime string in `plugin.js` and rerun targeted proof.
**Warning signs:** Source and bundle strings differ, or the live validator still points at the old bundled line.

## Code Examples

Current shipped-runtime defect source:

```js
await notifier.notify({
  type: 'phase-complete',
  severity: 'warning',
  message: `Phase ${phaseNum} complete! Next: Phase ${nextPhase.number} (${nextPhase.name}). Verify against this repo's current checkout, and rebuild the local runtime before trusting generated guidance if runtime surfaces changed.`,
  action: `Next: /bgsd-plan phase ${nextPhase.number}`,
});
```

Recommended runnable action shape:

```js
await notifier.notify({
  type: 'phase-complete',
  severity: 'warning',
  message: `Phase ${phaseNum} complete! Next: Phase ${nextPhase.number} (${nextPhase.name}). Verify against this repo's current checkout, and rebuild the local runtime before trusting generated guidance if runtime surfaces changed.`,
  action: `/bgsd-plan phase ${nextPhase.number}`,
});
```

Targeted proof should also replace stale expectation strings such as:

```js
assert.match(validatorSource, /\/bgsd-plan phase \$\{nextPhase\.number\}/);
assert.doesNotMatch(validatorSource, /Next: \/bgsd-plan phase/);
```

## Suggested Plan Slices

1. **Canonicalize the phase-complete action source**
   Update `src/plugin/idle-validator.js` so the notification `action` field contains only the runnable canonical `/bgsd-plan phase ${nextPhase.number}` command.

2. **Rebuild and verify the shipped plugin bundle**
   Run `npm run build`, confirm `plugin.js` contains the corrected action string, and confirm `util:validate-commands --raw` no longer reports the runtime `plugin.js` failure.

3. **Lock runtime proof without expanding scope**
   Update focused expectations in `tests/plugin.test.cjs` and any runtime-related fixture assertions such as `tests/integration.test.cjs`, and add or adjust validator-backed tests so the malformed `Next:` action cannot return while roadmap operand-complete guidance remains covered.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Runtime next-step guidance sometimes mixed prose prefixes into runnable action strings | Canonical action payloads are expected to be directly runnable slash commands | Earlier command-integrity work, reopened by v18.1 audit | Phase 179 should finish that contract for the remaining shipped runtime action. |
| Runtime roadmap guidance once surfaced operand-incomplete planning commands | Runtime roadmap guidance in source and bundle is now operand-complete | Phase 177 | Phase 179 does not need to reopen the roadmap advisory map unless new evidence appears. |
| Broad validator runs were used as milestone-close truth but include unrelated backlog | Narrow phase acceptance uses touched-surface proof plus scoped validator evidence | Phase 175 onward | Keeps this gap-closure phase small and credible. |

## Open Questions

- Do any notification rendering layers visually prepend their own affordance around `action`, making the raw command-only string the correct UX everywhere? Current validator evidence strongly suggests yes, but this is worth confirming during implementation.
- Should `tests/integration.test.cjs` keep asserting literal string containment for this runtime artifact, or should it move to a more semantics-focused assertion that avoids encoding UI prose into runnable command checks?

## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/v18.1-MILESTONE-AUDIT.md`
- `src/plugin/idle-validator.js`
- `src/plugin/advisory-guardrails.js`
- `plugin.js`
- `src/lib/commandDiscovery.js`
- `tests/plugin.test.cjs`
- `tests/plugin-advisory-guardrails.test.cjs`
- `tests/validate-commands.test.cjs`
- `tests/integration.test.cjs`
- `node bin/bgsd-tools.cjs util:validate-commands --raw`
- `node /Users/cam/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs init:phase-op 179 --raw`

### Secondary (MEDIUM confidence)
- `.planning/phases/177-runtime-guidance-integrity-cleanup/177-RESEARCH.md`
- `.planning/phases/177-runtime-guidance-integrity-cleanup/177-01-SUMMARY.md`
- `build.cjs`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Phase scope and boundary: HIGH
- Current live runtime failure location: HIGH
- Roadmap guidance no-longer-blocking assessment: HIGH
- Likely affected tests and fixtures: HIGH
- UI rendering layer open question: MEDIUM

**Research date:** 2026-04-01
**Valid until:** Next change to plugin notification payloads, command-integrity extraction rules, or plugin build flow.
