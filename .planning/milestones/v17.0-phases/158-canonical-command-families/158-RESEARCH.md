# Phase 158: Canonical Command Families - Research

**Researched:** 2026-03-29
**Domain:** bGSD slash-command surface consolidation and compatibility routing
**Confidence:** HIGH

## User Constraints

- Use `/bgsd-plan` as the master command for phase planning, roadmap, and todo flows.
- Keep `/bgsd-settings` as its own canonical family rather than folding it into another umbrella.
- Introduce `/bgsd-inspect` as a strict read-only diagnostics hub.
- Keep canonical commands as the only documented/preferred surface; legacy commands remain compatibility aliases but should stay out of primary discoverability.
- Treat `/bgsd-quick` as the canonical quick path and `/bgsd-quick-task` as alias-only.
- Preserve equivalent underlying behavior across canonical commands and legacy aliases.
- Keep todos plan-scoped under `/bgsd-plan`; do not design a standalone general todo surface.
- Keep `/bgsd-inspect` limited to cross-cutting read/analysis flows such as progress, impact, trace, decision search, lesson search, and health-style inspection.
- Do not pull mutating or domain-specific flows like review, security, readiness, or release into `/bgsd-inspect`.

## Phase Requirements

- **CMD-01:** `/bgsd-quick` becomes the single recommended quick-entry command; `/bgsd-quick-task` remains compatibility-only.
- **CMD-02:** Planning, roadmap, todo, settings, and advanced inspection flows move behind grouped canonical command families.
- **CMD-03:** Legacy slash commands continue to resolve during migration, but canonical forms are the preferred surfaced path.

## Summary

Phase 158 is mostly a command-wrapper and workflow-routing phase, not a CLI-engine rewrite. The repo already models slash commands as individual markdown wrapper files in `commands/`, deploys them by manifest filename in `deploy.sh` and `install.js`, and routes behavior through workflow markdown or thin alias wrappers. That means the safest implementation path is to add new canonical wrapper files (`/bgsd-plan`, `/bgsd-roadmap`, `/bgsd-inspect`) and convert old top-level commands into compatibility shims that route into the same underlying workflows or argument-normalized family entrypoints.

The important planning boundary is that this phase should establish canonical grouped families and alias parity, but it should not try to finish the full help/reference cleanup promised by Phase 159. Some targeted wording updates are unavoidable where canonical wrappers are introduced, especially for quick-entry and direct compatibility routes, but the broad repo-wide audit, main help redesign, and command-reference validation should stay deferred. Plan work should therefore focus on: command inventory changes, family routing behavior, parity tests, and only the minimum discoverability rewiring needed to make canonical forms the preferred path where this phase directly touches behavior.

**Primary recommendation:** Implement Phase 158 as thin canonical family wrappers plus legacy alias normalization, with tests proving canonical and legacy entrypoints land on the same workflow contracts, while leaving broad help/audit cleanup to Phase 159.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Slash command wrapper markdown in `commands/` | current repo convention | Public command surface | Every shipped slash command is installed from a `commands/bgsd-*.md` file listed in `bin/manifest.json` |
| Workflow markdown in `workflows/` | current repo convention | End-to-end command behavior | Existing commands route through workflow files rather than custom command-engine code |
| `bin/manifest.json` + `deploy.sh` / `install.js` | current repo convention | Install/remove command wrappers by filename | New canonical families and kept aliases must both be represented here so deployment stays correct |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `docs/commands.md` | current repo doc | Long-form command inventory and examples | Update only where Phase 158 must keep canonical names from being contradicted |
| `workflows/help.md` | current repo workflow | Primary help text | Touch only if needed for direct Phase 158 parity or alias wording; full redesign belongs to Phase 159 |
| `src/plugin/command-enricher.js` | current repo runtime | Command-name-to-agent heuristics and context enrichment | Update if new canonical command names need the same agent routing metadata as legacy names |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Thin wrapper/family commands | Rebuild slash-command parsing in CLI or plugin | Unnecessary scope and much higher regression risk for a naming-surface phase |
| Legacy aliases routing into canonical wrappers | Duplicated new workflows per alias | Creates behavior drift and violates CMD-03/CMD-04 parity expectations |
| Phase-limited discoverability updates | Full repo-wide help and audit rewrite now | Bleeds directly into Phase 159 and makes planning too broad |

## Architecture Patterns

### Recommended Project Structure

- Keep public slash-command entrypoints in `commands/`.
- Keep routing/orchestration logic in `workflows/`.
- Keep low-level CLI/runtime support in `src/` only when wrapper/workflow changes are insufficient.
- Keep deployment truth in `bin/manifest.json`, `deploy.sh`, and `install.js` aligned with any added or retained wrappers.

### Pattern 1: Canonical wrapper + legacy alias shim

Use a canonical command file as the preferred public surface, then keep the legacy command file as a thin route into the same workflow or canonical argument contract. `commands/bgsd-quick.md` already demonstrates this pattern: it is a backward-compatible wrapper that routes to the same quick workflow, while `commands/bgsd-quick-task.md` is still the direct workflow wrapper. For Phase 158, flip that discoverability relationship repo-wide for the covered command families.

### Pattern 2: Family command with sub-action argument normalization

For grouped surfaces like `/bgsd-roadmap`, `/bgsd-plan`, and `/bgsd-inspect`, prefer one family entrypoint that reads the first argument as a sub-action and normalizes it onto existing workflows. This preserves the current workflow investment while shrinking the visible top-level surface.

### Pattern 3: Keep canonical migration additive first

Add new canonical wrappers before removing or hiding old ones in code. Deployment already supports stale-file cleanup through the manifest, so planning can safely stage migration by introducing canonical files, repointing guidance, then deciding later whether long-tail alias wrappers should ever be removed.

### Anti-Patterns to Avoid

- Do not fork behavior so canonical commands and aliases evolve separately.
- Do not let `/bgsd-inspect` absorb mutating flows just because they are diagnostic-adjacent.
- Do not spread command-family logic across docs-only changes without executable wrapper support.
- Do not make Phase 158 depend on a full command-reference audit; that is Phase 159 scope.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canonical migration | A new command runtime or parser framework | Existing `commands/*.md` wrapper model plus workflow routing | The repo already ships slash-command behavior through wrapper files; migration can stay additive and low-risk |
| Alias compatibility | Separate reimplementations of legacy workflows | Thin alias wrappers to shared workflows/canonical normalization | Shared routing is the only reliable way to preserve behavior parity |
| Discoverability flip | Repo-wide manual cleanup as part of this phase | Narrow Phase 158 updates, then Phase 159 audit/validation | Broad cleanup now would merge two roadmap phases and inflate risk |

## Common Pitfalls

### Pitfall 1: Accidental Phase 159 spillover
**What goes wrong:** Planning expands into full help redesign, command-reference scanning, and repo-wide example cleanup.
**Why it happens:** The command-footprint PRD bundles canonical families and reference integrity in one larger initiative.
**How to avoid:** Treat Phase 158 as wrapper/family/alias parity only; defer global help and validation work to CMD-04 through CMD-06 in Phase 159.
**Warning signs:** Plan tasks start touching most docs, templates, skills, and agent prompts instead of command surfaces plus a few directly affected guides.

### Pitfall 2: Canonical and legacy paths drift apart
**What goes wrong:** `/bgsd-plan ...` and legacy commands reach slightly different prompts, defaults, or next steps.
**Why it happens:** Teams duplicate wrapper/workflow text instead of normalizing onto one implementation path.
**How to avoid:** Make aliases route into the canonical workflow contract or vice versa, then add parity tests for equivalent entrypoints.
**Warning signs:** Different argument parsing, different next-command hints, or separate workflow files for what should be one behavior.

### Pitfall 3: Family boundaries become fuzzy
**What goes wrong:** `/bgsd-inspect` starts owning mutating or domain-specific flows, or `/bgsd-plan` grows a standalone todo system.
**Why it happens:** Grouping pressure encourages over-consolidation.
**How to avoid:** Hold the locked boundaries from `158-CONTEXT.md`: `/bgsd-inspect` is read-only; todos stay plan-scoped under `/bgsd-plan`; settings stay separate.
**Warning signs:** Proposed commands like inspect-based repair/mutation actions or todo flows unrelated to phase planning.

### Pitfall 4: Runtime metadata still recognizes only legacy names
**What goes wrong:** Canonical commands work superficially, but plugin enrichment, agent routing, or contextual guidance treat them as unknown.
**Why it happens:** Command-name additions often need matching updates in `src/plugin/command-enricher.js` or similar runtime maps.
**How to avoid:** Audit command-name keyed logic whenever new canonical wrappers are introduced.
**Warning signs:** Missing `agent_type`, degraded context injection, or different behavior between canonical and legacy entrypoints despite shared workflows.

## Code Examples

### Existing alias-wrapper pattern

`commands/bgsd-quick.md` shows the preferred migration shape: a thin wrapper that routes to the existing quick workflow while preserving a compatibility entrypoint.

### Existing direct workflow wrapper pattern

Files like `commands/bgsd-add-todo.md`, `commands/bgsd-check-todos.md`, and `commands/bgsd-settings.md` are simple top-level wrappers over one workflow each. Phase 158 can replace this visible sprawl with grouped family wrappers that normalize sub-actions onto those same workflows.

### Existing deployment contract

`deploy.sh` and `install.js` both map `commands/bgsd-*.md` entries from `bin/manifest.json` into the host editor command directory and clean stale files by manifest diff. Any plan introducing canonical families or retaining aliases must update the manifest and preserve deploy/install symmetry.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Many sibling top-level commands for related intents | Phase 158 target is grouped canonical families with aliases preserved | Planned in v17.0 | Smaller visible surface without losing capability |
| Quick path split between `/bgsd-quick` and `/bgsd-quick-task` | `/bgsd-quick` already exists as a wrapper and is ready to become canonical | Already present before Phase 158 | Low-risk place to establish the migration pattern |
| Help/docs teach broad top-level inventory | Broad discoverability cleanup deferred to Phase 159 | Roadmap current state | Phase 158 should avoid over-optimizing help beyond direct contradictions |

## Planning Implications

- The natural plan slices are by command family, not by file type.
- Start with the quick-entry flip and shared alias pattern because it is the smallest CMD-01 slice and establishes migration mechanics for the rest.
- Then add `/bgsd-plan` as the largest family because it absorbs planning, roadmap, and plan-scoped todo behavior and has the most user-facing aliases.
- Add `/bgsd-roadmap` and `/bgsd-inspect` next, since they are mostly grouping/normalization work over existing commands.
- Finish with runtime parity updates and tests across manifest, deployment, plugin enrichment, and any touched help/docs surfaces.

## Test Targets

- Command wrapper inventory tests or snapshots covering new canonical files and retained aliases in `bin/manifest.json`.
- Workflow/help contract tests for the minimum Phase 158 surfaces that must now prefer canonical quick and grouped families.
- Plugin/enricher tests for any command-name keyed logic so canonical wrappers get the same routing metadata as legacy names.
- Integration or fixture tests proving canonical and legacy entrypoints land on equivalent underlying behavior for at least one command in each affected family.

## Open Questions

- Whether `/bgsd-plan-gaps` stays outside the new family in this phase or receives a compatibility relationship only later; the phase context does not lock this, so plan carefully to avoid crossing into milestone-gap redesign.
- How much canonical-preference wording should be updated now versus left for the explicit help/reference pass in Phase 159.

## Assertions Status

- No `.planning/ASSERTIONS.md` file exists in this repo, so there are no prewritten assertions to evaluate for CMD-01 through CMD-03.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/158-canonical-command-families/158-CONTEXT.md`
- `.planning/research/command-footprint-reduction-prd.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `commands/bgsd-quick.md`
- `commands/bgsd-quick-task.md`
- `commands/bgsd-add-todo.md`
- `commands/bgsd-check-todos.md`
- `commands/bgsd-settings.md`
- `commands/bgsd-progress.md`
- `commands/bgsd-impact.md`
- `commands/bgsd-trace.md`
- `commands/bgsd-search-decisions.md`
- `commands/bgsd-search-lessons.md`
- `commands/bgsd-health.md`
- `workflows/help.md`
- `docs/commands.md`
- `src/plugin/command-enricher.js`
- `bin/manifest.json`
- `deploy.sh`
- `install.js`

### Secondary (MEDIUM confidence)
- `.planning/STATE.md`
- `.planning/INTENT.md`
- `.planning/MILESTONE-INTENT.md`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:** HIGH for scope boundaries, wrapper architecture, deployment model, and migration strategy; MEDIUM only for exact Phase 158 vs Phase 159 wording touchpoints because the roadmap deliberately splits those concerns.
**Research date:** 2026-03-29
**Valid until:** Next roadmap or command-surface restructuring change
