---
name: checkpoint-protocol
description: Checkpoint detection, handling, and structured return format for pausing execution at human interaction points. Covers human-verify, decision, and human-action checkpoint types with auto-mode behavior.
type: shared
agents: [executor, github-ci, planner, debugger]
sections: [detection, handling, return-format]
---

## Purpose

Formalizes how agents detect, handle, and return structured data when encountering checkpoints — the interaction points where human judgment is required. Ensures consistent behavior whether the agent is in auto-mode (auto-approve) or standard mode (pause and wait).

## Placeholders

| Placeholder | Description | Example |
|---|---|---|
| `{{phase}}` | Current phase identifier | `01-foundation` |
| `{{plan}}` | Current plan number | `02` |

## Content

<!-- section: detection -->
### Checkpoint Detection

Scan the plan for checkpoint tasks:

```bash
grep -n "type=\"checkpoint" [plan-path]
```

**Execution patterns based on checkpoints:**

| Checkpoints Found | Pattern | Behavior |
|---|---|---|
| None | A (autonomous) | Execute all tasks, create SUMMARY, commit |
| Verify/Decision | B (segmented) | Execute until checkpoint, STOP, return state |
| Decision in main | C (main context) | Execute in main context for decision flow |

### Auto-Mode Detection

Check if auto-mode is active:
```bash
AUTO_CFG=$(node $BGSD_HOME/bin/bgsd-tools.cjs util:config-get workflow.auto_advance 2>/dev/null || echo "false")
```

When `AUTO_CFG` is `"true"`:
- **checkpoint:human-verify** — Auto-approve. Log `Auto-approved: [what-built]`. Continue.
- **checkpoint:decision** — Auto-select first option (planners front-load recommended choice). Log `Auto-selected: [option]`. Continue.
- **checkpoint:human-action** — STOP normally. Auth gates cannot be automated.

<!-- section: handling -->
### Checkpoint Type Handling

**checkpoint:human-verify (90% of checkpoints)**

Visual/functional verification after automation. Before any human-verify checkpoint, ensure the verification environment is ready — if the plan lacks server startup before the checkpoint, add one (deviation Rule 3).

Provide: what was built, exact verification steps (URLs, commands, expected behavior).

**Golden rule:** Users NEVER run CLI commands. Users ONLY visit URLs, click UI, evaluate visuals, provide secrets. The agent does all automation.

**checkpoint:decision (9% of checkpoints)**

Implementation choice needed. Present decision context, options table with pros/cons, and selection prompt.

**checkpoint:human-action (1% — rare)**

Truly unavoidable manual step. Provide: what automation was attempted, the single manual step needed, and a verification command to confirm completion.

Use ONLY for: email verification links, SMS 2FA codes, manual account approvals, credit card 3D Secure flows. NOT for deploying, creating webhooks, running builds, or creating files — those are automatable.

### Authentication Gates

Auth errors during execution are gates, not failures. Indicators: "Not authenticated", "Not logged in", "Unauthorized", "401", "403", "Please run {tool} login", "Set {ENV_VAR}".

Protocol:
1. Recognize it's an auth gate (not a bug)
2. STOP current task
3. Return checkpoint with type `human-action`
4. Provide exact auth steps (CLI commands, where to get keys)
5. Specify verification command

Document auth gates as normal flow in SUMMARY, not as deviations.

<!-- section: return-format -->
### Checkpoint Return Format

When hitting a checkpoint or auth gate, return this structure:

```markdown
## CHECKPOINT REACHED

**Type:** [human-verify | decision | human-action]
**Plan:** {{phase}}-{{plan}}
**Progress:** {completed}/{total} tasks complete

### Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | [task name] | [hash] | [key files created/modified] |

### Current Task

**Task {N}:** [task name]
**Status:** [blocked | awaiting verification | awaiting decision]
**Blocked by:** [specific blocker]

### Checkpoint Details

[Type-specific content — what was built, options table, or auth steps needed]

### Awaiting

[What user needs to do/provide]
```

The Completed Tasks table gives continuation agents full context. Commit hashes verify work was committed. Current Task provides the precise continuation point.

For detailed checkpoint examples and patterns, see the supporting file: `checkpoints-reference.md`

## Cross-references

- <skill:structured-returns /> — Checkpoint returns are a subset of structured return formats
- <skill:deviation-rules /> — Escalation (Rule 4) may trigger a checkpoint
- <skill:commit-protocol /> — Completed task hashes appear in checkpoint returns

## Examples

**Executor hitting human-verify:**
```markdown
## CHECKPOINT REACHED

**Type:** human-verify
**Plan:** 03-02
**Progress:** 2/3 tasks complete

### Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create dashboard layout | abc123f | src/components/Dashboard.tsx |
| 2 | Start dev server | def456g | — |

### Current Task

**Task 3:** Verify responsive layout
**Status:** awaiting verification

### Checkpoint Details

Dashboard built at http://localhost:3000/dashboard.
Verify responsive behavior at desktop (>1024px), tablet (768px), and mobile (375px).

### Awaiting

Visit the URL and type "approved" or describe layout issues.
```
