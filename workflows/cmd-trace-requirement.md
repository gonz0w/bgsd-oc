# /gsd-trace-requirement

Trace a requirement from REQUIREMENTS.md through plans to actual files on disk. Shows the full implementation chain for a specific requirement ID.

**Usage:** `/gsd-trace-requirement <req-id>`

<process>

<step name="parse_args">
Extract requirement ID from arguments:

```
REQ_ID="$ARGUMENTS"
```

If no requirement ID provided:
```
Usage: /gsd-trace-requirement <req-id>

Example: /gsd-trace-requirement DX-02
Example: /gsd-trace-requirement FOUND-01
```
Exit.
</step>

<step name="run">
Run the trace-requirement command:

```bash
RESULT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs trace-requirement "$REQ_ID" 2>/dev/null)
```

Parse the JSON output which includes:
- `requirement_id`: The requirement traced
- `requirement_text`: Full requirement description
- `status`: "complete" | "pending" | "in_progress"
- `phase`: Phase where this requirement is addressed
- `plans[]`: Plans that implement this requirement
- `files[]`: Files on disk that implement the requirement
- `commits[]`: Related commits

**Display format:**

```
## Requirement Trace: {requirement_id}

**Status:** {status}
**Description:** {requirement_text}
**Phase:** {phase}

### Implementation Plans

{For each plan:}
- **{plan_id}**: {plan_name} ({plan_status})

### Files on Disk

{For each file:}
- `{file_path}` ({exists ? "✓ exists" : "✗ missing"})

### Related Commits

{For each commit:}
- `{hash}` — {message}

{If no files and no commits: "⚠ Requirement not yet implemented."}
```
</step>

</process>
