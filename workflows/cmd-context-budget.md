# /gsd-context-budget

Estimate token usage for a plan file. Warns when plan content exceeds the configured context window threshold (default: 50% of 200K tokens).

**Usage:** `/gsd-context-budget <plan-path>`

<process>

<step name="parse_args">
Extract plan path from arguments:

```
PLAN_PATH="$ARGUMENTS"
```

If no path provided:
```
Usage: /gsd-context-budget <plan-path>

Example: /gsd-context-budget .planning/phases/03-developer-experience/03-01-PLAN.md
```
Exit.
</step>

<step name="run">
Run the context-budget command:

```bash
RESULT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs context-budget "$PLAN_PATH" 2>/dev/null)
```

Parse the JSON output which includes:
- `plan_path`: Path analyzed
- `estimated_tokens`: Token estimate for the plan
- `context_window`: Configured context window size
- `target_percent`: Configured target percentage
- `usage_percent`: Estimated usage as percentage of target
- `warning`: Boolean — true if exceeds threshold
- `files[]`: Per-file token estimates

**Display format:**

```
## Context Budget: {plan_path}

**Estimated tokens:** {estimated_tokens}
**Context window:** {context_window} ({target_percent}% target = {target_tokens})
**Usage:** {usage_percent}% of target

{If warning: "⚠ WARNING: Plan exceeds context budget threshold!"}
{If !warning: "✓ Within budget"}

### File Breakdown

| File | Tokens |
|------|--------|
| {file} | {tokens} |
```
</step>

</process>
