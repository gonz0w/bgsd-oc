# /gsd-rollback-info

Show commits and revert command for a specific plan. Useful when a plan's changes need to be undone.

**Usage:** `/gsd-rollback-info <plan-id>`

<process>

<step name="parse_args">
Extract plan ID from arguments:

```
PLAN_ID="$ARGUMENTS"
```

If no plan ID provided:
```
Usage: /gsd-rollback-info <plan-id>

Example: /gsd-rollback-info 01-02
Example: /gsd-rollback-info 03-01
```
Exit.
</step>

<step name="run">
Run the rollback-info command:

```bash
RESULT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs rollback-info "$PLAN_ID" 2>/dev/null)
```

Parse the JSON output which includes:
- `plan_id`: Plan identifier
- `commits[]`: Commits associated with this plan (hash, message, date, files)
- `commit_count`: Number of commits found
- `revert_command`: Git command to revert the changes

**Display format:**

```
## Rollback Info: Plan {plan_id}

**Commits:** {commit_count}

| Hash | Date | Message |
|------|------|---------|
| {hash} | {date} | {message} |

### Revert Command

```bash
{revert_command}
```

⚠ Review changes before reverting. This cannot be easily undone.
```
</step>

</process>
