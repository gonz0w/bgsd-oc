---
name: bgsd-context-init
description: Standard bgsd-context initialization preamble shared by all workflows — detects auto-injected bgsd-context block, provides plugin-required error message, and specifies the Parse JSON instruction pattern.
type: shared
agents: [all]
sections: [init]
---

## Purpose

Provides the standard 2-paragraph preamble that appears at the start of every workflow's initialization step. All 10 bGSD workflows check for the `<bgsd-context>` block (auto-injected by the plugin's `command.execute.before` hook), display the same error if it's missing, and parse the same JSON structure. This skill extracts that shared block to eliminate duplication.

Note: Individual workflows still specify their own field lists after the `<skill:bgsd-context-init />` tag, since each workflow needs different fields from the JSON.

## Placeholders

| Placeholder | Description | Example |
|---|---|---|
| (none) | This skill uses no placeholders — the preamble is identical across all workflows | — |

## Content

<!-- section: init -->
**Context:** This workflow receives project context via `<bgsd-context>` auto-injected by the bGSD plugin's `command.execute.before` hook. If no `<bgsd-context>` block is present, the plugin is not loaded.

**If no `<bgsd-context>` found:** Stop and tell the user: "bGSD plugin required for v9.0. Install with: npx bgsd-oc"

Parse `<bgsd-context>` JSON for the fields listed below (each workflow specifies its own required fields after this block).
<!-- /section -->

## Cross-references

- `execute-phase.md` — `<step name="initialize">` uses this preamble
- `execute-plan.md` — `<step name="init_context">` uses this preamble
- `quick.md` — Step 2 uses this preamble
- `new-milestone.md` — Step 7 uses this preamble
- `new-project.md` — Step 1 uses this preamble
- All other bGSD workflows follow the same pattern

## Examples

**Usage in a workflow step:**
```markdown
<step name="initialize" priority="first">
<skill:bgsd-context-init />

Parse `<bgsd-context>` JSON for: `phase_found`, `phase_dir`, `executor_model`, `plans`.
</step>
```

The `<skill:bgsd-context-init />` tag is replaced with the standard 2-paragraph preamble. Each workflow then adds its specific field list on the next line.
