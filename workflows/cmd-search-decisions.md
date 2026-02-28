# /gsd-search-decisions

Search STATE.md and archived states for decisions matching a query. Useful for understanding past architectural and implementation choices.

**Usage:** `/gsd-search-decisions <query>`

<process>

<step name="parse_args">
Extract search query from arguments:

```
QUERY="$ARGUMENTS"
```

If no query provided:
```
Usage: /gsd-search-decisions <query>

Example: /gsd-search-decisions "auth approach"
Example: /gsd-search-decisions config
```
Exit.
</step>

<step name="run">
Run the search-decisions command:

```bash
RESULT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs search-decisions "$QUERY" 2>/dev/null)
```

Parse the JSON output which includes:
- `query`: The search query used
- `matches[]`: Matching decisions with source, phase, text, context
- `count`: Number of matches found

**Display format:**

```
## Decision Search: "{query}"

**Found:** {count} match(es)

{For each match:}
### {source} — Phase {phase}
{text}
{If context: "> {context}"}

---
```

If no matches: "No decisions found matching '{query}'. Try broader terms."
</step>

</process>
