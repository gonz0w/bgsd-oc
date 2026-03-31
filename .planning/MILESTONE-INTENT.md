# Milestone Intent: v18.0 Adaptive Models & Ambient cmux UX

## Why Now

The workflow foundation is stable enough to turn outward again: operators need better control over which models each agent uses, and the plugin already has enough state to surface a trustworthy ambient workspace HUD through `cmux`. Shipping these together makes bGSD easier to tune and easier to monitor without changing OpenCode core behavior.

## Targeted Outcomes

- DO-117 - Explore dynamic model configuration and smarter profile management
- DO-121 - Explore a CMUX-first OpenCode UX that surfaces working, waiting, blocked, and idle state
- Advance the enduring project objective by reducing operator friction and making agent behavior more legible per token spent

## Priorities

- Make model configuration editable through settings by letting projects choose the concrete models behind `quality`, `balanced`, and `budget` plus one global active profile instead of workflow text or provider-specific defaults
- Keep model configuration and later resolution work provider-agnostic, use sparse direct agent overrides for exceptions, and do not preserve migration-safe legacy behavior inside Phase 168
- Bias the first `cmux` slice toward trustworthy workspace-level status, progress, and attention moments
- Prefer quiet fallback behavior over ambitious but noisy instrumentation

## Non-Goals

- Modifying OpenCode core UI or chat behavior
- Building deep per-agent panes before workspace-level truth is reliable
- Solving multi-user repo coordination, ownership, or GitHub issue workflow in this milestone
- Replacing the whole runtime or packaging model as part of model configuration work

## Notes

- Use `.planning/research/DYNAMIC-MODEL-CONFIG-PRD.md`, `.planning/research/CMUX-FIRST-UX-PRD.md`, and `.planning/research/CMUX-FIRST-UX-BACKLOG.md` as the primary planning seeds.
- Treat `.planning/phases/168-adaptive-model-settings-contract/168-CONTEXT.md` as the locked scope for the model-settings slice: shared built-in profiles, one selected global profile, and sparse direct overrides.
- Prefer existing plugin lifecycle signals and persisted planning state over inventing new orchestration layers.
- Keep `cmux` integration workspace-scoped first; only add richer agent detail if signal quality proves reliable.
