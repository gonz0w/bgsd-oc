---
name: planner-checkpoints
description: Checkpoint planning guidelines for planners — when to use each checkpoint type (human-verify 90%, decision 9%, human-action 1%), XML templates, authentication gates, writing rules, and anti-patterns to avoid.
type: agent-specific
agents: [planner]
sections: [checkpoint-types, auth-gates, writing-guidelines, anti-patterns]
---

## Purpose

Guides the planner in deciding when and how to place checkpoints in plans. Checkpoints are the interface between agent automation and human judgment. The planner must understand the automation-first principle: agents do all CLI/API work; humans only verify, decide, or perform truly manual actions.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| (none) | This skill uses no placeholders | — |

## Content

<!-- section: checkpoint-types -->
### Checkpoint Types

**checkpoint:human-verify (90% of checkpoints)**
Human confirms agent's automated work is correct.

Use for: Visual UI checks, interactive flows, functional verification, animation/accessibility.

```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[What the agent automated]</what-built>
  <how-to-verify>
    [Exact steps — URLs, commands, expected behavior]
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
```

**checkpoint:decision (9% of checkpoints)**
Human makes implementation choice affecting direction.

Use for: Technology selection, architecture decisions, design choices.

```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>[What's being decided]</decision>
  <context>[Why this matters]</context>
  <options>
    <option id="option-a">
      <name>[Name]</name>
      <pros>[Benefits]</pros>
      <cons>[Tradeoffs]</cons>
    </option>
  </options>
  <resume-signal>Select: option-a, option-b, or ...</resume-signal>
</task>
```

**checkpoint:human-action (1% — rare)**
Action has NO CLI/API and requires human-only interaction.

Use ONLY for: Email verification links, SMS 2FA codes, manual account approvals, credit card 3D Secure.

Do NOT use for: Deploying (CLI), creating webhooks (API), creating databases (CLI), running builds/tests (Bash), creating files (Write tool).
<!-- /section -->

<!-- section: auth-gates -->
### Authentication Gates

When the agent tries CLI/API and gets an auth error, it creates a checkpoint dynamically. Auth gates are NOT pre-planned — they emerge during execution.

**Pattern:** Agent automates → auth error → checkpoint:human-action → user authenticates → agent retries → continues.
<!-- /section -->

<!-- section: writing-guidelines -->
### Writing Guidelines

**DO:**
- Automate everything before the checkpoint
- Be specific: "Visit https://myapp.vercel.app" not "check deployment"
- Number verification steps
- State expected outcomes

**DON'T:**
- Ask human to do work the agent can automate
- Mix multiple verifications into one checkpoint
- Place checkpoints before automation completes
<!-- /section -->

<!-- section: anti-patterns -->
### Anti-Patterns

**Bad — Asking human to automate:**
```xml
<task type="checkpoint:human-action">
  <action>Deploy to Vercel</action>
</task>
```
Why bad: Vercel has a CLI. The agent should run `vercel --yes`.

**Bad — Too many checkpoints:**
```xml
<task type="auto">Create schema</task>
<task type="checkpoint:human-verify">Check schema</task>
<task type="auto">Create API</task>
<task type="checkpoint:human-verify">Check API</task>
```
Why bad: Verification fatigue. Combine into one checkpoint at end.

**Good — Single verification checkpoint:**
```xml
<task type="auto">Create schema</task>
<task type="auto">Create API</task>
<task type="auto">Create UI</task>
<task type="checkpoint:human-verify">
  <what-built>Complete auth flow (schema + API + UI)</what-built>
  <how-to-verify>Test full flow: register, login, access protected page</how-to-verify>
</task>
```
<!-- /section -->

## Cross-references

- <skill:checkpoint-protocol /> — Execution-time checkpoint handling (executor perspective)
- <skill:planner-task-breakdown /> — Task type definitions including checkpoint types

## Examples

See planner agent's `<checkpoints>` section for the original comprehensive reference.
