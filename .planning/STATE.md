# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-30)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance.
**Current focus:** Phase 170 plan 03 ready — reversible write-path proof on top of exact workspace targeting

## Current Position

**Phase:** 170
**Current Plan:** 3
**Total Plans in Phase:** 3
**Status:** Ready to execute
**Last Activity:** 2026-03-31

Progress: [██████████] 99%

## Performance Metrics

**Velocity:**
- Total plans completed: 342 (through Phase 170 P02)
- Average duration: ~13 min/plan
- Total execution time: ~51.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 163 | 5 | 5 | ~7.0 min |
| 164 | 3 | 3 | ~7.3 min |
| 165 | 3 | 3 | ~11.3 min |
| 166 | 2 | 2 | ~9.5 min |
| 167 | 2 | 2 | 9.5 min |
| 168 | 1 | 1 | ~2.0 min |
| 169 | 1 | 1 | ~10.0 min |
| 170 | 2 | 2 | ~14.5 min |

**Recent Trend:**
- Last shipped milestone: v17.1 completed 5 phases (163-167)
- Trend: Stable
| Phase 169 P01 | 10 min | 2 tasks | 8 files |
| Phase 168-adaptive-model-settings-contract P02 | 13 min | 2 tasks | 7 files |
| Phase 168 P03 | 9 min | 2 tasks | 11 files |
| Phase 168 P04 | 9 min | 1 tasks | 9 files |
| Phase 169 P02 | 9 min | 2 tasks | 2 files |
| Phase 169 P03 | 7 min | 2 tasks | 5 files |
| Phase 169-canonical-model-resolution-visibility P04 | 9 min | 2 tasks | 9 files |
| Phase 170 P01 | 24 min | 2 tasks | 6 files |
| Phase 170 P02 | 5 min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 169]: Model-state visibility now runs through a shared configured-versus-resolved helper so decisions, enricher context, `util:resolve-model`, and settings diagnostics report the same contract.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 169]: Init surfaces now show compact configured-versus-resolved model summaries plus verbose per-agent state objects. — Reusing the shared model-state presenter keeps init output aligned with settings and workflow resolution without breaking existing workflow model fields.
- [Phase 169]: Orchestration now routes by shared quality, balanced, and budget profiles before canonical concrete-model resolution. — Shared-profile routing keeps semantics stable when the concrete model behind a profile changes.
- [Phase 169-canonical-model-resolution-visibility]: Legacy cache and SQLite model-profile surfaces are now compatibility-only; canonical config remains the only live model-selection truth. — Removing dead cache APIs and fresh default seeding prevents future reads from reviving provider-tier model selection outside canonical config.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 169]: Model-state visibility now runs through a shared configured-versus-resolved helper so decisions, enricher context, `util:resolve-model`, and settings diagnostics report the same contract.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 169]: Init surfaces now show compact configured-versus-resolved model summaries plus verbose per-agent state objects. — Reusing the shared model-state presenter keeps init output aligned with settings and workflow resolution without breaking existing workflow model fields.
- [Phase 169]: Orchestration now routes by shared quality, balanced, and budget profiles before canonical concrete-model resolution. — Shared-profile routing keeps semantics stable when the concrete model behind a profile changes.
- [Phase 169-canonical-model-resolution-visibility]: Legacy cache and SQLite model-profile surfaces are now compatibility-only; canonical config remains the only live model-selection truth. — Removing dead cache APIs and fresh default seeding prevents future reads from reviving provider-tier model selection outside canonical config.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 169]: Model-state visibility now runs through a shared configured-versus-resolved helper so decisions, enricher context, `util:resolve-model`, and settings diagnostics report the same contract.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 169]: Init surfaces now show compact configured-versus-resolved model summaries plus verbose per-agent state objects. — Reusing the shared model-state presenter keeps init output aligned with settings and workflow resolution without breaking existing workflow model fields.
- [Phase 169]: Orchestration now routes by shared quality, balanced, and budget profiles before canonical concrete-model resolution. — Shared-profile routing keeps semantics stable when the concrete model behind a profile changes.
- [Phase 169-canonical-model-resolution-visibility]: Legacy cache and SQLite model-profile surfaces are now compatibility-only; canonical config remains the only live model-selection truth. — Removing dead cache APIs and fresh default seeding prevents future reads from reviving provider-tier model selection outside canonical config.
- [Phase 170]: Plugin startup now classifies cmux availability through one bounded transport and caches an inert adapter with explicit suppression reasons, keeping non-cmux behavior quiet and unchanged until later proof phases attach safely.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 169]: Model-state visibility now runs through a shared configured-versus-resolved helper so decisions, enricher context, `util:resolve-model`, and settings diagnostics report the same contract.
- [Phase 147-148]: Security and release flows now use normalized findings, narrow suppressions, dry-run-first release steps, and explicit skip/fallback semantics rather than hidden guesswork.
- [Phase 149-150]: TDD guidance now comes from one canonical contract, with exact-command RED/GREEN/REFACTOR proof and summary audit coverage.
- [Phase 151-154]: Shared phase snapshots, durable handoffs, resume freshness, and proof-preserving TDD audit sidecars now anchor fresh-context chaining.
- [Phase 155-156]: Execution is JJ-first and workspace-first, with recovery-oriented workspace inspection instead of legacy worktree guidance.
- [Phase 157]: `effective_intent` layers project, milestone, and phase context, while milestone-local strategy lives in `MILESTONE-INTENT.md` rather than mutating project intent.
- [Phase 158-159]: Canonical `/bgsd-plan`, `/bgsd-inspect`, and `/bgsd-settings` guidance is now the preferred command surface, protected by command-integrity validation.
- [Phase 160-162]: Phase intent is explicit in context files, and verification/UAT now report intent alignment separately while legacy contexts stay no-guess and runtime-parity safe.
- [Phase 163]: Shared mutation contracts now keep touched state, config, storage, and plugin progress updates on one coordinated path.
- [Phase 164]: Shared planning indexes and truthful `must_haves` handling now keep planner, checker, and verifier metadata aligned.
- [Phase 165]: JJ execution and verification now support path-scoped fallback commits and repo-local runtime freshness checks.
- [Phase 166]: Plan-scoped completion repair now recomputes summaries and state metadata from on-disk truth instead of ambient workspace noise.
- [Phase 167]: Touched CLI and plugin diagnostics now share one quiet-by-default `BGSD_DEBUG` or `--verbose` contract.
- [v18.0 Roadmap]: Split milestone into 5 phases (168-172): model settings contract, canonical resolution, safe `cmux` targeting, trustworthy ambient state, and low-noise attention UX.
- [v18.0 Roadmap]: Kept the first `cmux` slice workspace-scoped and fallback-safe; deeper per-agent identity remains deferred until signal quality proves reliable.
- [v18.0 Roadmap]: Kept dynamic model work provider-agnostic by separating settings contract work from canonical resolution and routing behavior.
- [Phase 168-adaptive-model-settings-contract]: Phase 168 planning artifacts now center on built-in quality/balanced/budget profiles, one selected global profile, and sparse direct overrides instead of aliases or migration-safe legacy compatibility.
- [Phase 168-adaptive-model-settings-contract]: Canonical model settings now normalize through one nested model_settings contract with shared profile definitions, one default profile, and sparse agent overrides.
- [Phase 168-adaptive-model-settings-contract]: CLI and plugin config parsing now derive compatibility model_profile and model_overrides fields from the shared normalizer instead of separate parsing logic.
- [Phase 168]: Runtime model resolution now uses the canonical model_settings contract across helpers, decisions, init, enricher, and diagnostics. — A single config-first resolver removes legacy fallback drift so selected profiles and sparse overrides change live behavior consistently.
- [Phase 168]: Settings guidance now uses the canonical model_settings contract with one selected default profile, shared quality/balanced/budget model definitions, and sparse direct overrides. — This makes /bgsd-settings and user-facing docs match the runtime/config contract without provider-specific tier wording.
- [Phase 169]: Init surfaces now show compact configured-versus-resolved model summaries plus verbose per-agent state objects. — Reusing the shared model-state presenter keeps init output aligned with settings and workflow resolution without breaking existing workflow model fields.
- [Phase 169]: Orchestration now routes by shared quality, balanced, and budget profiles before canonical concrete-model resolution. — Shared-profile routing keeps semantics stable when the concrete model behind a profile changes.
- [Phase 169-canonical-model-resolution-visibility]: Legacy cache and SQLite model-profile surfaces are now compatibility-only; canonical config remains the only live model-selection truth. — Removing dead cache APIs and fresh default seeding prevents future reads from reviving provider-tier model selection outside canonical config.
- [Phase 170]: cmux workspace targeting now trusts managed env only when identify agrees, while alongside callers must prove one exact allowAll cwd match before attachment is considered safe.
- [Phase 170]: Conflicting managed evidence now suppresses immediately instead of falling back to cwd heuristics, preventing cross-workspace leakage in multi-workspace cmux sessions.

### Pending Todos

None yet.

### Blockers/Concerns

None

## Session Continuity

Last session: 2026-03-31T13:18:24.591Z
Stopped at: Completed 170-02-PLAN.md
Resume file: None
