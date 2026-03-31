---
name: executor-continuation
description: Context window continuation handling for executors — saving execution state before context exhaustion, resumption protocol for fresh agents, and completed task verification on resume.
type: agent-specific
agents: [executor]
sections: [continuation-protocol, resume-protocol]
---

## Purpose

When an executor's context window is nearly exhausted mid-plan, it must save state so a fresh agent can continue. This skill defines the protocol for both saving and resuming, ensuring no work is lost or duplicated.

## Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{phase}}` | Current phase identifier | `01-foundation` |
| `{{plan}}` | Current plan number | `02` |

## Content

<!-- section: continuation-protocol -->
### Saving State Before Context Exhaustion

If spawned as continuation agent (`<completed_tasks>` in prompt):

1. Verify previous commits exist: `jj log -n 5 --no-graph`
2. DO NOT redo completed tasks
3. Start from resume point in prompt
4. Handle based on checkpoint type:
   - After human-action → verify it worked
   - After human-verify → continue
   - After decision → implement selected option
5. If another checkpoint hit → return with ALL completed tasks (previous + new)

The executor should monitor context usage and proactively save state when approaching limits, using the bookmark system:

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:memory write \
  --store bookmarks \
  --entry '{"phase":"{{phase}}","plan":"{{plan}}","task":N,"total_tasks":M,"git_head":"'$(jj log -r @- --no-graph -T 'commit_id.shortest(8)')'"}'
```
<!-- /section -->

<!-- section: resume-protocol -->
### Resumption Protocol

A fresh agent receives the completed tasks table and resume point. It must:

1. **Verify commits exist** — Check `jj log` for expected change-ids
2. **Skip completed tasks** — Never redo work that was committed
3. **Pick up at resume point** — Start from the exact task specified
4. **Carry forward context** — The completed tasks table provides commit hashes and files for SUMMARY generation
5. **Report all tasks** — If hitting another checkpoint, return ALL completed tasks (previous + new)
<!-- /section -->

## Cross-references

- <skill:commit-protocol /> — Commits are the primary state-saving mechanism
- <skill:continuation-format /> — Format for presenting next steps

## Examples

See executor agent's `<continuation_handling>` section and `references/continuation-format.md` for detailed format specifications.
