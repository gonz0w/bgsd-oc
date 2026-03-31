# /bgsd-search-lessons

Search completed phase lessons for relevant patterns and insights from the structured lessons store.

**Usage:** `/bgsd-search-lessons <query>`

<process>

<step name="parse_args">
Extract search query from arguments:

```
QUERY="$ARGUMENTS"
```

If no query provided:
```
Usage: /bgsd-search-lessons <query>

Example: /bgsd-search-lessons "testing strategy"
Example: /bgsd-search-lessons frontmatter
```
Exit.
</step>

<step name="run">
Run the search-lessons command:

```bash
RESULT=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:search-lessons "$QUERY" 2>/dev/null)
```

Parse the JSON output which includes:
- `query`: The search query used
- `matches[]` / `lessons[]`: Matching lessons with title, body, source, format, and metadata
- `count` / `match_count`: Number of matches found
- `canonical_source`: Structured lessons store path

**Display format:**

```
## Lessons Search: "{query}"

**Found:** {count} match(es)

{For each match:}
### {title}
- Severity: {severity}
- Type: {type}
- Agents: {affected_agents}
- Source: {source}
{body}

---
```

If no matches: "No lessons found matching '{query}' in `.planning/memory/lessons.json`. Try broader terms or capture more structured lessons first."
</step>

</process>
