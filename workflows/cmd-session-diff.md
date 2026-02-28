# /gsd-session-diff

Show git commits since last activity. Useful for understanding what changed since the last planning session.

<process>

<step name="run">
Run the session-diff command:

```bash
RESULT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs session-diff 2>/dev/null)
```

Parse the JSON output which includes:
- `commits[]`: Recent commits with hash, author, date, message
- `since`: Timestamp of last known activity
- `count`: Number of commits found

**Display format:**

```
## Session Diff

**Since:** {since}
**Commits:** {count}

| Hash | Date | Message |
|------|------|---------|
| {hash} | {date} | {message} |
```

If no commits found: "No commits since last session activity."
</step>

</process>
