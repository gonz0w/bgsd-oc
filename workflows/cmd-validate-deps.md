# /gsd-validate-deps

Validate the dependency graph for a phase. Checks that all plan dependencies are satisfiable and flags circular or missing dependencies.

**Usage:** `/gsd-validate-deps <phase>`

<process>

<step name="parse_args">
Extract phase identifier from arguments:

```
PHASE="$ARGUMENTS"
```

If no phase provided:
```
Usage: /gsd-validate-deps <phase>

Example: /gsd-validate-deps 3
Example: /gsd-validate-deps 03-developer-experience
```
Exit.
</step>

<step name="run">
Run the validate-dependencies command:

```bash
RESULT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs validate-dependencies "$PHASE" 2>/dev/null)
```

Parse the JSON output which includes:
- `phase`: Phase validated
- `valid`: Boolean — true if dependency graph is valid
- `plans[]`: Plans with their dependencies
- `waves`: Computed wave groupings
- `errors[]`: Dependency errors (circular, missing, unresolvable)
- `warnings[]`: Non-blocking dependency issues

**Display format:**

```
## Dependency Validation: Phase {phase}

**Status:** {valid ? "✓ Valid" : "✗ Invalid"}

### Wave Structure

| Wave | Plans |
|------|-------|
| {wave} | {plan_ids} |

{If errors:}
### Errors

{For each error:}
- ✗ {error.message}

{If warnings:}
### Warnings

{For each warning:}
- ⚠ {warning.message}
```
</step>

</process>
