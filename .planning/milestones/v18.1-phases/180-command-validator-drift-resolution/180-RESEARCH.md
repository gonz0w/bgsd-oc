# Phase 180: Command Validator Drift Resolution - Research

**Researched:** 2026-04-01
**Domain:** Command-surface validation, contract derivation, surfaced-guidance drift control
**Confidence:** HIGH

## User Constraints

- Keep Phase 180 contract-first. First settle the validator's supported-command and exception rules, then update only the surfaced files that still legitimately drift from that contract.
- Keep the proof bar strict: milestone-close proof must cover surfaced milestone-close files across docs, workflows, agents, and built runtime guidance, with only narrow named exclusions.
- The validator's own output must own proof inventory and named exclusions. Do not create a second drifting manifest.
- Treat quoted examples, redirects, internal-bootstrap flows, headings, and reference-only matrices as legitimate special cases only when classified explicitly and deterministically.
- Do not broaden this phase into a new general-purpose linter or a reporting UX project.
- Use current milestone focus and requirement traceability: this phase closes reopened `CLEAN-03` and reinforces trustworthy milestone-close guidance proof for the current JJ/workspace-first model.
- No project-local `.agents/skills/` directory exists.

## Phase Requirements

- **CLEAN-03:** Users see docs, templates, and help text that match the supported JJ/workspace-first model rather than stale worktree-era or compatibility-era guidance.

## Summary

Phase 180 is not primarily a docs-cleanup phase and not primarily a parser phase. It is a contract-governance phase. Current repo evidence shows the validator is already on the right architectural path: it derives planning-family grammar from `commands/bgsd-plan.md`, groups surfaced issues by file, distinguishes some reference-only contexts, and validates slash and CLI examples against inventories. But the current proof is still not trustworthy because the validator's CLI inventory is narrower than the real router contract, and some rendered/reference contexts are still parsed as runnable commands. The live validator now reports 9 issues across 9 surfaced files, while direct command execution proves several flagged commands are real supported routes.

The established pattern here should be: derive the validator contract from canonical sources that already own behavior, then classify context deterministically before raising failures. In this repo that means using routed command sources (`router.js`, `commands/*.md`, and help/inventory data) as the contract base, not ad hoc negative heuristics or a second hand-maintained proof manifest. The most important immediate gap is that `validateCommandIntegrity()` currently pulls CLI inventory from `COMMAND_HELP`, but real routed commands such as `init:phase-op`, `init:execute-phase`, `verify:validate roadmap`, and `detect:gh-preflight` are executable while missing from that inventory. That is classic validator drift.

State of the art in CLI ecosystems also points the same way: modern CLI frameworks treat the command tree as the single source of truth and generate help/completions/docs from it rather than maintaining parallel registries manually. For Phase 180, the prescriptive implementation is to strengthen source-of-truth derivation, add explicit classification buckets for named special cases, and make validator output report covered surfaces plus named exclusions so a green run has durable meaning.

**Primary recommendation:** Plan Phase 180 around one canonical validator contract pipeline: derive supported command inventory from authoritative routed sources, classify named exception contexts explicitly, then repair the remaining surfaced files and make `util:validate-commands --raw` emit proof inventory plus exclusions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `>=18` | Runtime for validator, CLI, and tests | Repo engine floor is Node 18; `node:test` and current build pipeline already assume it. |
| esbuild | `^0.27.3` | Build shipped CLI and `plugin.js` artifact for parity checks | Repo-standard bundler; Phase 180 must keep built runtime guidance aligned with source. |
| `src/lib/commandDiscovery.js` | repo internal | Surfaced command extraction, classification, and reporting | Existing validator entrypoint; extend it instead of creating a second validator. |
| `src/lib/planning-command-surface.js` | repo internal | Derives planning-family grammar from `commands/bgsd-plan.md` | This is already the repo's best example of contract derivation from a canonical command doc. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` | built-in (Node 18+) | Regression coverage for parser/classification and proof output | Use for all changed validator classes and named exclusions. |
| `src/router.js` | repo internal | Authoritative routed command behavior | Use as truth source when validator claims a command is nonexistent. |
| `src/lib/constants.js` / help inventory | repo internal | Current documented CLI inventory | Use only if reconciled with real router coverage; do not treat as sole authority today. |
| `commands/*.md` and `bin/manifest.json` | repo internal | Slash-command inventory and canonical workflow routing | Use as surfaced command source-of-truth for slash families. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Second proof manifest listing covered files | Validator-derived proof inventory in command output | Separate manifests drift; output-owned inventory keeps one authority. |
| Broad regex relaxation until current issues disappear | Explicit context classifiers for headings, reference examples, redirects, bootstrap flows | Blanket relaxation lowers proof quality and hides real drift. |
| New external CLI framework/parser library | Existing repo validator plus stronger contract derivation | Phase goal is drift resolution, not CLI rewrite; smallest safe path is improving current validator. |

## Architecture Patterns

### Recommended Project Structure

- Keep command contract derivation in `src/lib/commandDiscovery.js` and helper modules near it.
- Keep canonical planning grammar sourced from `commands/bgsd-plan.md` through `src/lib/planning-command-surface.js`.
- Add any new validator classification helpers as narrow pure functions with test-first coverage.
- Treat `plugin.js` as generated output: validator changes that affect runtime proof must still verify built artifact behavior.

### Pattern 1: Source-of-Truth Derivation, Not Parallel Registries

Derive validator inventories from authoritative routed sources, then project them into validation rules. Current best precedent is `loadPlanningCommandSurface()` parsing `commands/bgsd-plan.md` route lines into `routeEntries`, `literalPrefix`, and required operand counts. Extend this style to CLI command inventory reconciliation instead of trusting `COMMAND_HELP` alone.

### Pattern 2: Deterministic Classification Before Failure

Treat surfaced mentions as one of a few explicit classes before reporting an issue: runnable command, reference-only example, workflow self-reference, internal bootstrap/reconstruction snippet, output-format example, or named exclusion. The validator already has the beginnings of this (`isReferenceStyleMention`, `isWorkflowFallbackReconstructionContext`, `isReferenceOutputFence`); Phase 180 should formalize and finish it.

### Pattern 3: Validator-Owned Proof Inventory

`util:validate-commands --raw` should report the surfaces it checked, the command inventories it derived, and the named exclusions/classification buckets it applied. A green run should mean “these surfaced files passed under this contract,” not just “no issues were emitted.”

### Pattern 4: Tight Contract Tests Around False-Positive Classes

Every newly supported or excluded class needs a fixed regression test that proves both sides: the legitimate special case now passes, and a nearby real mistake still fails. Use focused tests, not only one broad end-to-end repo assertion.

### Anti-Patterns to Avoid

- Adding a second manually curated list of covered proof files or exclusions.
- Declaring commands nonexistent based only on `COMMAND_HELP` when router execution proves they exist.
- Expanding generic regex exceptions instead of naming the context class being allowed.
- Making docs/workflows silently conform to a wrong validator rather than fixing the contract first.
- Editing built artifacts directly instead of source + rebuild verification.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Planning-family grammar | Another hard-coded `/bgsd-plan` route table | `commands/bgsd-plan.md` → `loadPlanningCommandSurface()` | Existing canonical route derivation already works and reduces drift. |
| Proof inventory | Separate markdown/json manifest of covered files | Validator output generated from collected surfaces | Keeps proof meaning tied to the command actually used for closure. |
| Special-case suppression | Free-form regex skips with no names | Named classifier helpers + regression tests | Keeps exceptions auditable and prevents silent proof erosion. |
| Runtime truth check | Manual inspection of `plugin.js` | Build + validator + focused tests | Built runtime guidance is part of phase scope and must stay provable. |

## Common Pitfalls

### Pitfall 1: Inventory drift from documented-help-only lookup
**What goes wrong:** Real routed commands are flagged as nonexistent.
**Why it happens:** `validateCommandIntegrity()` currently derives CLI inventory from `COMMAND_HELP`, but routed commands like `init:phase-op`, `init:execute-phase`, `verify:validate roadmap`, and `detect:gh-preflight` are absent there while still implemented and runnable.
**How to avoid:** Reconcile validator inventory against authoritative routed command sources before treating “nonexistent” as a real failure.
**Warning signs:** Validator says a command is missing, but `node bin/bgsd-tools.cjs ...` succeeds immediately.

### Pitfall 2: Reference/output text parsed as runnable commands
**What goes wrong:** Headings, output-format snippets, or shell assignment examples fail validation as if users should run them literally.
**Why it happens:** Extraction regex sees a command-like token before the validator understands the surrounding context.
**How to avoid:** Classify context first and add named buckets for headings, example output, bootstrap reconstruction snippets, and reference matrices.
**Warning signs:** Issues such as `Unknown slash command ##` or failures triggered inside bash assignment examples.

### Pitfall 3: Over-correcting with blanket exceptions
**What goes wrong:** The validator turns green by ignoring too much.
**Why it happens:** Special cases are handled with broad regex skips instead of narrow class rules.
**How to avoid:** Each exclusion must be explicit, named, deterministic, and regression-tested against an adjacent real failure.
**Warning signs:** A classifier change makes many unrelated failures disappear at once.

### Pitfall 4: Repo truth and built-runtime truth diverge
**What goes wrong:** Source docs/tests pass but shipped `plugin.js` reintroduces drift.
**Why it happens:** Runtime proof depends on built artifact parity, not only source files.
**How to avoid:** Keep focused built-artifact validator coverage in the same slice as source changes.
**Warning signs:** Source files look fixed, but `util:validate-commands --raw` still flags `plugin.js` or runtime-only surfaces.

## Code Examples

Verified repo patterns and current drift points.

Canonical planning-family derivation already in repo:

```js
const matches = Array.from(content.matchAll(ROUTE_PATTERN));
const routeEntries = matches.map((match) => createRouteEntry(match[1], match[2]));
```

Current validator drift source:

```js
const cliInventory = options.cliInventory || getCliCommandInventory();
// getCliCommandInventory() currently reads COMMAND_HELP keys
```

Current routed behavior that proves the validator inventory is too narrow:

```js
// router.js
} else if (validateSub === 'roadmap') {
  lazyVerify().cmdValidateRoadmap(cwd, { repair: restArgs.includes('--repair') }, raw);
}

// router.js
} else if (subCmd === 'gh-preflight') {
  lazyTools().cmdGhPreflight(cwd, raw);
}
```

Recommended proof-output direction:

```json
{
  "valid": true,
  "surfaceCount": 142,
  "proofInventory": {
    "surfacesChecked": ["docs/...", "workflows/...", "agents/...", "plugin.js"],
    "slashContractSource": "commands/bgsd-plan.md",
    "cliContractSources": ["router.js", "constants/help-inventory"],
    "namedExclusions": ["workflow-bootstrap-reconstruction", "reference-output-fence"]
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parallel manual help/docs/validator registries | Single-source command trees that generate or drive docs/help/completions | Established in modern CLI frameworks; reflected in current Cobra/Click docs | Reduces contract drift and makes validation provable. |
| Regex-only “looks like a command” scanning | Context-aware extraction plus explicit classification buckets | Current best practice for surfaced command linting | Prevents false positives without weakening real command validation. |
| Pass/fail-only validator output | Pass/fail plus proof inventory and named exclusions | Emerging best practice for durable policy validators | Makes green results auditable and stable over time. |
| Repo-specific route tables duplicated by hand | Route metadata derived from canonical command docs (`commands/bgsd-plan.md`) | Already adopted in this repo during Phase 175 | This is the pattern to extend, not replace. |

## Open Questions

- Should CLI inventory be derived directly from `router.js`, from reconciled help metadata, or from a dedicated generated inventory produced during build? Evidence strongly favors derivation from routed sources, but the exact authority chain should be settled in planning.
- Should `transition.md` “Next Up” output strings be treated as output-format reference text or rewritten to avoid command-like headings entirely? Either can work, but the rule must be explicit.
- Which named exclusions belong in milestone-close proof by policy, and which should instead be rewritten out of surfaced files? Keep this list narrow.

## Sources

### Primary (HIGH confidence)
- `.planning/REQUIREMENTS.md`
- `.planning/MILESTONE-INTENT.md`
- `.planning/research/GREENFIELD-COMPAT-CLEANUP-PRD.md`
- `.planning/v18.1-MILESTONE-AUDIT.md`
- `.planning/phases/180-command-validator-drift-resolution/180-CONTEXT.md`
- `src/lib/commandDiscovery.js`
- `src/lib/planning-command-surface.js`
- `commands/bgsd-plan.md`
- `src/router.js`
- `src/commands/verify/health.js`
- `src/commands/tools.js`
- `src/commands/misc/frontmatter.js`
- `tests/validate-commands.test.cjs`
- `build.cjs`
- `package.json`
- `node bin/bgsd-tools.cjs util:validate-commands --raw`
- `node bin/bgsd-tools.cjs init:phase-op 180 --raw`
- `node bin/bgsd-tools.cjs init:execute-phase 1 --raw`
- `node bin/bgsd-tools.cjs verify:validate roadmap --repair`
- `node bin/bgsd-tools.cjs detect:gh-preflight`

### Secondary (MEDIUM confidence)
- Context7: `/nodejs/node` docs for `node:test`
- Context7: `/evanw/esbuild` build API docs
- Click official help-page docs: `https://click.palletsprojects.com/en/stable/documentation/`
- Cobra package docs/README: `https://pkg.go.dev/github.com/spf13/cobra`

### Tertiary (LOW confidence)
- Brave web search result on single-source-of-truth docs generation trends (used only as supporting ecosystem signal)

## Metadata

**Confidence breakdown:**
- Phase scope and sequencing constraints: HIGH
- Current validator false-positive root cause around missing CLI inventory entries: HIGH
- Recommended architectural pattern (source-of-truth derivation + explicit classifiers): HIGH
- Exact long-term authority chain for CLI inventory generation: MEDIUM

**Research date:** 2026-04-01
**Valid until:** Next change to router contract, command help inventory model, surfaced validator classifications, or build/runtime proof surfaces.
