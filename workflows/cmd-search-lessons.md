# /gsd-search-lessons

Search completed phase lessons for relevant patterns and insights. Surfaces lessons learned from past execution to inform current planning.

**Usage:** `/gsd-search-lessons <query>`

<process>

<step name="parse_args">
Extract search query from arguments:

```
QUERY="$ARGUMENTS"
```

If no query provided:
```
Usage: /gsd-search-lessons <query>

Example: /gsd-search-lessons "testing strategy"
Example: /gsd-search-lessons frontmatter
```
Exit.
</step>

<step name="run">
Run the search-lessons command:

```bash
RESULT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs search-lessons "$QUERY" 2>/dev/null)
```

Parse the JSON output which includes:
- `query`: The search query used
- `matches[]`: Matching lessons with source, phase, text
- `count`: Number of matches found

**Display format:**

```
## Lessons Search: "{query}"

**Found:** {count} match(es)

{For each match:}
### Phase {phase} — {source}
{text}

---
```

If no matches: "No lessons found matching '{query}'. Try broader terms or check that completed phases have documented lessons."
</step>

</process>
