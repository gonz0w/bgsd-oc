---
name: model-profiles
description: AI model selection profiles for bGSD agents — quality/balanced/budget profile definitions, per-agent model assignments, resolution logic, per-agent overrides, and design rationale for why each agent uses its assigned model tier.
type: shared
agents: [planner, executor, verifier, debugger, roadmapper, project-researcher, phase-researcher, codebase-mapper, plan-checker, github-ci]
sections: [profiles, resolution, overrides, rationale]
---

## Purpose

Controls which AI model each bGSD agent uses, balancing quality vs token spend. Orchestrators resolve the profile once at start, then pass the model parameter to each agent spawn. The profile system prevents wasting expensive models on simple tasks while ensuring critical decision-making agents get maximum reasoning power.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: profiles -->
### Profile Definitions

| Agent | `quality` | `balanced` | `budget` |
|-------|-----------|------------|----------|
| planner | opus | opus | sonnet |
| roadmapper | opus | sonnet | sonnet |
| executor | opus | sonnet | sonnet |
| phase-researcher | opus | sonnet | haiku |
| project-researcher | opus | sonnet | haiku |
| debugger | opus | sonnet | sonnet |
| codebase-mapper | sonnet | haiku | haiku |
| verifier | sonnet | sonnet | haiku |
| plan-checker | sonnet | sonnet | haiku |

**quality** — Maximum reasoning power. Opus for all decision-making agents. Use when: quota available, critical architecture.

**balanced** (default) — Smart allocation. Opus only for planning. Sonnet for execution/research. Use when: normal development.

**budget** — Minimal Opus usage. Sonnet for code-writing. Haiku for research/verification. Use when: conserving quota.
<!-- /section -->

<!-- section: resolution -->
### Resolution Logic

Resolve once at orchestration start:

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

1. Read `.planning/config.json`
2. Check `model_overrides` for agent-specific override
3. If no override, look up agent in profile table
4. Pass model parameter to Task call

**Note:** Opus-tier agents resolve to `"inherit"` (not `"opus"`). This uses the parent session's model, avoiding conflicts with organization policies that may block specific opus versions.
<!-- /section -->

<!-- section: overrides -->
### Per-Agent Overrides

Override specific agents without changing the entire profile:

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "bgsd-executor": "opus",
    "bgsd-planner": "haiku"
  }
}
```

Overrides take precedence over the profile. Valid values: `opus`, `sonnet`, `haiku`.

**Switching profiles:** `/bgsd-set-profile <profile>` at runtime, or set `"model_profile"` in `.planning/config.json`.
<!-- /section -->

<!-- section: rationale -->
### Design Rationale

**Opus for planner:** Planning involves architecture decisions, goal decomposition, task design — highest quality impact.

**Sonnet for executor:** Follows explicit PLAN.md instructions. Plan contains the reasoning; execution is implementation.

**Sonnet (not Haiku) for verifiers in balanced:** Verification needs goal-backward reasoning — checking if code delivers what the phase promised. Haiku may miss subtle gaps.

**Haiku for codebase-mapper:** Read-only exploration and pattern extraction. No reasoning required.

**`inherit` instead of `opus` directly:** The host editor's `"opus"` alias maps to a specific model version. Organizations may block older versions. `"inherit"` uses whatever opus version is configured, avoiding conflicts.
<!-- /section -->

## Cross-references

- <skill:raci /> — Agent roles that determine model assignments

## Examples

See `references/model-profiles.md` and `references/model-profile-resolution.md` for the original references.
