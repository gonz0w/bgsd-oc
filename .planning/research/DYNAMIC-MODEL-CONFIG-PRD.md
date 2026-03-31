# Dynamic Model Configuration PRD

**Project:** bGSD Plugin
**Author:** OpenCode
**Date:** 2026-03-28
**Status:** Backlog - Post-v16.0
**Target window:** First model-system follow-up after current milestone completion

## Problem

bGSD's model-selection system is only partially dynamic.

Today, workflows already pass resolved model values into agent spawns, but the underlying configuration model still assumes Anthropic-style tiers and names:
- static tier tables are hard-coded in `src/lib/constants.js`, `src/lib/decision-rules.js`, and `src/lib/orchestration.js`
- SQLite storage is fixed to `quality_model`, `balanced_model`, and `budget_model`
- user-facing docs and settings copy still recommend `opus`, `sonnet`, and `haiku`
- config naming is inconsistent between `model_profiles` and `model_overrides`

Result:
- OpenCode can switch models in workflows, but bGSD does not expose that capability cleanly
- users wanting GPT-first or local-model setups must fight the defaults
- docs and prompts still steer users toward provider-specific recommendations that do not match current intent

## Goal

Make model selection fully settings-driven, provider-agnostic, and easy to tune for OpenCode deployments, while shipping strong GPT-based defaults for each agent use case.

The system should:
- let users define model aliases and agent mappings in settings
- keep workflow markdown generic and free of hard-coded provider recommendations
- support OpenAI GPT models as first-class defaults
- allow optional local-model profiles such as Qwen3-Coder without making them the baseline
- preserve backward compatibility with existing `.planning/config.json` files and SQLite data during migration

## Non-Goals

- Rewriting the entire workflow system around a new model provider abstraction layer
- Removing `quality`, `balanced`, and `budget` profile concepts from the UX
- Forcing local models as the default path
- Blocking older configs that still use legacy tier names during the transition period

## User Need

As a bGSD operator using OpenCode, I want model behavior to come from settings instead of prompt text or hard-coded tier names, so I can run the best GPT models for each agent role and optionally swap in local models where they make sense.

## Why This Belongs In Backlog Now

This is not required to finish Phase 148, but it is a high-leverage follow-up once the release milestone ships:
- it removes stale Anthropic assumptions from the product surface
- it improves long-term portability across providers
- it turns existing workflow-level model plumbing into a real feature
- it makes future agent tuning cheaper because changes move from markdown/docs into settings

## Current State Audit

### What already works

- Workflow spawns already accept dynamic `model="{...}"` values, so the OpenCode workflow layer can switch models without structural changes.
- Init commands already resolve per-agent models before workflow execution.
- The repository already has a decision-rule entry point for model resolution.

### What is still coupled to old assumptions

- Static default mapping lives in code and uses `opus` / `sonnet` / `haiku` as the real routing primitives.
- Complexity routing compares those same tier names directly.
- DB schema stores three fixed profile columns rather than an extensible profile map.
- Docs, skills, and settings copy still describe model choice in provider-specific terms.
- Config shape is inconsistent: some places document `model_profiles`, others read `model_overrides`.

## Research Basis

### Internal repo evidence

- Dynamic spawn values already exist in workflows and init bootstrap.
- Hard-coded tier tables still exist in resolver, routing, DB defaults, docs, and skills.
- Existing research PRDs in `.planning/research/` show the right place and format for a post-milestone backlog proposal.

### External product evidence

OpenAI public model docs currently recommend:
- `gpt-5.4` as the flagship model for complex reasoning and coding
- `gpt-5.4-mini` as the strongest mini model for coding, computer use, and subagents
- `gpt-5.4-nano` for simple, high-volume tasks

That guidance supports a GPT-first default strategy based on capability first and speed second.

## Product Decision

Keep the user-facing profiles (`quality`, `balanced`, `budget`), but make the model mappings behind them fully configurable.

### Canonical settings shape

```json
{
  "model_profile": "quality",
  "model_aliases": {
    "reasoning": "gpt-5.4",
    "coding": "gpt-5.4",
    "coding_fast": "gpt-5.4-mini",
    "fast": "gpt-5.4-mini",
    "cheap": "gpt-5.4-nano",
    "local_coder": "ollama/qwen3-coder:latest",
    "inherit": "inherit"
  },
  "model_profiles": {
    "quality": {
      "bgsd-planner": "reasoning",
      "bgsd-roadmapper": "reasoning",
      "bgsd-executor": "coding",
      "bgsd-phase-researcher": "reasoning",
      "bgsd-project-researcher": "reasoning",
      "bgsd-debugger": "reasoning",
      "bgsd-codebase-mapper": "coding_fast",
      "bgsd-verifier": "reasoning",
      "bgsd-plan-checker": "reasoning",
      "bgsd-github-ci": "coding_fast"
    }
  },
  "model_overrides": {
    "bgsd-executor": "local_coder"
  }
}
```

### Resolution order

1. `model_overrides[agent]`
2. `model_profiles[active_profile][agent]`
3. built-in default profile map
4. built-in default alias fallback

## Recommended GPT-First Defaults

Because the user explicitly prefers GPT models and does not need cost optimization, defaults should prioritize task fit first and speed second.

### Recommended default active profile

- Default `model_profile`: `quality`

### Recommended built-in aliases

- `reasoning` -> `gpt-5.4`
- `coding` -> `gpt-5.4`
- `coding_fast` -> `gpt-5.4-mini`
- `fast` -> `gpt-5.4-mini`
- `cheap` -> `gpt-5.4-nano`
- `inherit` -> `inherit`

### Recommended shipped agent defaults

| Agent | Default alias | Concrete model | Why |
|-------|---------------|----------------|-----|
| `bgsd-planner` | `reasoning` | `gpt-5.4` | Highest-value decomposition and architecture reasoning |
| `bgsd-roadmapper` | `reasoning` | `gpt-5.4` | Milestone and phase design benefit from strongest planning model |
| `bgsd-executor` | `coding` | `gpt-5.4` | Best default for code generation, edits, and implementation judgment |
| `bgsd-phase-researcher` | `reasoning` | `gpt-5.4` | Research quality matters more than raw latency |
| `bgsd-project-researcher` | `reasoning` | `gpt-5.4` | Broad synthesis and recommendation quality dominate |
| `bgsd-debugger` | `reasoning` | `gpt-5.4` | Root-cause analysis is reasoning-heavy |
| `bgsd-codebase-mapper` | `coding_fast` | `gpt-5.4-mini` | Read-heavy, pattern-heavy work benefits from speed more than top-end reasoning |
| `bgsd-verifier` | `reasoning` | `gpt-5.4` | Verification quality is high-leverage and subtle |
| `bgsd-plan-checker` | `reasoning` | `gpt-5.4` | Plan critique needs strong goal-backward reasoning |
| `bgsd-github-ci` | `coding_fast` | `gpt-5.4-mini` | Fix loops and CI triage benefit from fast strong coding/subagent behavior |

### Why not default everything to `gpt-5.4`

If cost is ignored, `gpt-5.4` is still not automatically the best choice for every path. Some agents are high-volume, iterative, or read-dominant. For those, `gpt-5.4-mini` is the better shipped default because OpenAI positions it as especially strong for coding, computer use, and subagents while also being faster.

### Local model stance

Local models should be supported as an opt-in profile, not as the shipped default.

Recommended optional profile:
- `local-balanced`
  - executor -> `local_coder`
  - codebase-mapper -> `local_coder`
  - phase-researcher -> `fast`
  - verifier / planner / debugger remain on GPT defaults unless the user explicitly changes them

This keeps local models available without degrading the out-of-box experience.

## Functional Requirements

1. Users can define reusable `model_aliases` in settings.
2. Users can define per-profile, per-agent mappings in `model_profiles`.
3. Users can override individual agents through one canonical key: `model_overrides`.
4. Model resolution must work for all existing workflow spawn paths without requiring workflow-specific edits.
5. Workflow docs, settings prompts, and skills must avoid recommending provider-specific tier names as the default language.
6. The system must preserve backward compatibility for legacy configs that still use `opus`, `sonnet`, and `haiku` during migration.
7. Helper commands that display model state must show both alias and resolved concrete model where possible.

## Quality Requirements

1. No workflow markdown should hard-code provider model names unless explicitly describing an example config.
2. Settings copy should describe profiles in terms of quality, speed, and use case rather than Anthropic model branding.
3. All model resolution must come from one canonical resolver path.
4. Unknown aliases or missing models must fail clearly with actionable configuration feedback.

## Proposed Delivery Plan

### Phase A - Normalize the contract

- Pick one config key for overrides: `model_overrides`
- Update docs, templates, helpers, and skills to use the same key
- Rewrite settings/profile copy so it is provider-agnostic
- Mark old tier tables as legacy fallback only

### Phase B - Add real dynamic config

- Add `model_aliases`
- Expand `model_profiles` into a profile -> agent -> alias map
- Update resolver code to return concrete model ids from aliases
- Update `resolve-model` and init bootstrap outputs to expose resolved values consistently

### Phase C - Decouple routing from Anthropic tiers

- Replace direct `haiku` / `sonnet` / `opus` comparisons in routing logic
- Introduce a small capability class or priority map based on aliases/profile metadata
- Keep complexity routing independent from provider names

### Phase D - Modernize persistence and migration

- Add migration support from fixed SQLite columns to either JSON-backed profile storage or a row-per-profile schema
- Seed GPT-first defaults for new projects
- Continue reading legacy rows during transition

### Phase E - Finish UX and docs

- Update `/bgsd-settings` and `/bgsd-set-profile` workflows to show resolved model tables from config instead of static examples
- Update `docs/agents.md`, `docs/configuration.md`, `docs/architecture.md`, and `skills/model-profiles/SKILL.md`
- Add tests proving workflows remain free of hard-coded provider model names

## Suggested Backlog Breakdown

1. **Contract cleanup**
   - unify `model_profiles` vs `model_overrides`
   - remove stale Sonnet/Opus guidance from settings copy

2. **Resolver overhaul**
   - add aliases
   - add profile-to-agent maps
   - centralize resolution logic

3. **Routing cleanup**
   - replace tier-name priority checks with capability metadata

4. **Storage migration**
   - move beyond fixed `quality_model` / `balanced_model` / `budget_model` columns

5. **Docs and workflow finish**
   - update docs, skills, tests, templates, and settings output

## Risks

- Backward compatibility risk if old configs are not translated cleanly
- Documentation drift if the resolver changes but settings/docs remain static
- Hidden assumptions in tests and helper commands that still expect tier names
- Provider availability differences across OpenCode installs, especially for local-model ids

## Open Questions

1. Should built-in defaults store concrete model ids directly, or aliases only?
2. Should `quality`, `balanced`, and `budget` remain the only first-class profiles, or can users define arbitrary profile names?
3. Should local-model profiles be seeded automatically when OpenCode detects an Ollama provider, or remain manual?
4. Should `inherit` remain a special reserved value, or be treated as just another alias target?

## Recommended First Slice

Start with the smallest high-leverage package:

1. unify config naming around `model_overrides`
2. add `model_aliases`
3. add provider-agnostic `model_profiles` maps
4. ship GPT-first defaults from this PRD
5. update settings/docs to stop recommending Sonnet/Opus/Haiku

This first slice delivers immediate value without forcing the full DB migration on day one.

## Success Criteria

- New projects default to GPT-first model mappings tuned to agent use case
- Users can swap models in settings without editing workflows or prompts
- Workflow markdown no longer recommends Anthropic-specific model names as product defaults
- Resolver, settings, docs, and tests all agree on one canonical configuration contract
