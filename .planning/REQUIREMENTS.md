# Requirements

**Milestone:** v18.0 Adaptive Models & Ambient cmux UX
**Generated:** 2026-03-30
**Status:** Drafted

## Goal

Make bGSD easier to tune and monitor by shipping provider-agnostic dynamic model configuration with GPT-first defaults and by surfacing trustworthy, low-noise workspace state through `cmux`.

## Requirement Categories

### MODEL - Dynamic Model Configuration

- [x] `MODEL-01` User can define the concrete models behind built-in `quality`, `balanced`, and `budget` profiles in settings.
- [x] `MODEL-02` User can choose one provider-agnostic global active profile for the project instead of editing workflow prompts or maintaining a per-agent mapping matrix.
- [x] `MODEL-03` User can override any specific agent through one canonical `model_settings.agent_overrides` key that points directly to a concrete model when an exception is needed.
- [x] `MODEL-04` User can change model behavior from settings alone because all workflow spawn paths resolve through one canonical model resolver.
- [x] `MODEL-05` User can inspect both the configured global profile or direct override and the resolved concrete model in settings or init output where model state is shown.
- [x] `MODEL-06` Phase 168 ships as a break-and-replace contract centered on `quality`, `balanced`, and `budget` instead of preserving legacy `opus`, `sonnet`, and `haiku` naming.
- [x] `MODEL-07` User reads settings, workflow, and skill guidance that describes profiles by capability and speed rather than provider-specific defaults.
- [x] `MODEL-08` User gets consistent agent routing behavior even when concrete providers change because routing logic no longer depends directly on Anthropic tier names.

### CMUX - Ambient Workspace UX

- [x] `CMUX-01` User running inside or alongside a reachable `cmux` environment gets integration only when the active workspace can be targeted safely.
- [ ] `CMUX-02` User sees a stable workspace state model (`Working`, `Input needed`, `Blocked`, `Idle`, `Warning`, `Complete`) derived from plugin lifecycle events.
- [ ] `CMUX-03` User sees a sidebar status pill with compact phase, plan, task, or workflow context when that context is reliable.
- [ ] `CMUX-04` User sees sidebar progress derived from trustworthy phase, plan, task, or workflow state, and progress is hidden rather than guessed when signal quality is weak.
- [ ] `CMUX-05` User sees concise sidebar log entries for major lifecycle moments such as planner start, task completion, waiting for input, blocker detection, and state warnings.
- [ ] `CMUX-06` User gets `cmux` notifications for attention-worthy moments such as checkpoints, blockers, warnings, and completion events.
- [ ] `CMUX-07` User running several active `cmux` workspaces gets workspace-scoped updates that do not leak or overwrite another workspace's status.
- [x] `CMUX-08` User outside `cmux` experiences unchanged plugin behavior because the integration fails open and stays silent when unavailable.
- [ ] `CMUX-09` User does not get noisy or repetitive sidebar churn because non-essential updates are deduped and rate-limited.

## Future Requirements

- Greenfield compatibility cleanup that removes migration-era commands, schema normalization, and stale worktree guidance.
- Multi-user repo coordination with explicit ownership, lease, and handoff semantics.
- Bun-first migration for runtime, build, packaging, and test workflows.
- Deeper per-agent `cmux` visualization only if child-agent identity proves reliable in production use.

## Out of Scope

- Modifying OpenCode core behavior or UI primitives.
- Full Bun/runtime migration as part of model configuration work.
- Multi-user coordination, GitHub issue ownership, or team lock semantics.
- Rich per-agent `cmux` panes before workspace-level truth is proven trustworthy.
- A full provider abstraction rewrite beyond the milestone's model-resolution contract.

## Traceability

| Requirement | Source | Planned Phase |
|-------------|--------|---------------|
| `MODEL-01` | Dynamic model config PRD - built-in profile definitions | Phase 168 |
| `MODEL-02` | Dynamic model config PRD - one global active profile | Phase 168 |
| `MODEL-03` | Dynamic model config PRD - canonical direct overrides key | Phase 168 |
| `MODEL-04` | Dynamic model config PRD - canonical resolver across workflows | Phase 169 |
| `MODEL-05` | Dynamic model config PRD - configured versus resolved model visibility | Phase 169 |
| `MODEL-06` | Dynamic model config PRD - break-and-replace built-in profile contract | Phase 168 |
| `MODEL-07` | Dynamic model config PRD - provider-agnostic docs and settings copy | Phase 168 |
| `MODEL-08` | Dynamic model config PRD - routing independent from provider tier names | Phase 169 |
| `CMUX-01` | CMUX PRD FR1 + backlog Epic 1 | Phase 170 |
| `CMUX-02` | CMUX PRD FR2 + backlog Epic 2 | Phase 171 |
| `CMUX-03` | CMUX PRD FR3 + UX context labels | Phase 171 |
| `CMUX-04` | CMUX PRD FR4 + backlog Epic 3 | Phase 171 |
| `CMUX-05` | CMUX PRD FR5 + backlog Epic 4 | Phase 172 |
| `CMUX-06` | CMUX PRD FR6 + backlog Epic 4 | Phase 172 |
| `CMUX-07` | CMUX backlog Epic 5 - multi-workspace behavior | Phase 170 |
| `CMUX-08` | CMUX PRD FR8 + backlog Epic 6 | Phase 170 |
| `CMUX-09` | CMUX PRD FR7 + backlog Epic 6 | Phase 172 |
