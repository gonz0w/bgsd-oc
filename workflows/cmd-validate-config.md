# /gsd-validate-config

Validate the `.planning/config.json` file against the schema. Checks for missing fields, invalid values, and typos in field names.

<process>

<step name="run">
Run the validate-config command:

```bash
RESULT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs validate-config 2>/dev/null)
```

Parse the JSON output which includes:
- `valid`: Boolean — true if config is valid
- `config_path`: Path to config file
- `errors[]`: Validation errors (field, message, expected)
- `warnings[]`: Non-critical issues (possible typos, deprecated fields)
- `missing[]`: Required fields not present
- `extra[]`: Fields not in schema (possible typos)

**Display format:**

```
## Config Validation

**File:** {config_path}
**Status:** {valid ? "✓ Valid" : "✗ Invalid"}

{If errors:}
### Errors

{For each error:}
- **{field}**: {message} (expected: {expected})

{If warnings:}
### Warnings

{For each warning:}
- **{field}**: {message}

{If missing:}
### Missing Fields

{For each missing:}
- `{field}` — {description}

{If extra:}
### Unknown Fields

{For each extra:}
- `{field}` — Did you mean `{suggestion}`?

{If valid and no warnings: "✓ Config file is valid with no issues."}
```
</step>

</process>
