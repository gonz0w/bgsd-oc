# /gsd-codebase-impact

Show module dependencies for given files. Analyzes which modules import/reference the specified files, helping assess the blast radius of changes.

**Usage:** `/gsd-codebase-impact <files...>`

<process>

<step name="parse_args">
Extract file paths from arguments:

```
FILES="$ARGUMENTS"
```

If no files provided:
```
Usage: /gsd-codebase-impact <files...>

Example: /gsd-codebase-impact bin/gsd-tools.cjs
Example: /gsd-codebase-impact src/lib/config.js src/lib/frontmatter.js
```
Exit.
</step>

<step name="run">
Run the codebase-impact command:

```bash
RESULT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs codebase-impact $FILES 2>/dev/null)
```

Parse the JSON output which includes:
- `files[]`: Input files analyzed
- `dependencies[]`: Files that depend on the input files (with module name, file path, dependency type)
- `dependents_count`: Total number of dependent files
- `impact`: "low" | "medium" | "high"

**Display format:**

```
## Codebase Impact

**Files analyzed:** {files}
**Impact level:** {impact}
**Dependents:** {dependents_count}

### Dependencies

{For each dependency:}
- **{module_name}** ({file_path}) — {dependency_type}

{If dependents_count === 0: "No other modules depend on these files."}
```
</step>

</process>
