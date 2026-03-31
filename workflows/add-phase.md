<purpose>
Add a new integer phase to the end of the current milestone in the roadmap. Automatically calculates next phase number, creates phase directory, and updates roadmap structure.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="parse_arguments">
Parse the command arguments:
- All arguments become the phase description
- Example: `/bgsd-plan roadmap add "Add authentication"` → description = "Add authentication"
- Example: `/bgsd-plan roadmap add "Fix critical performance issues"` → description = "Fix critical performance issues"

If no arguments provided:

```
ERROR: Phase description required
Usage: /bgsd-plan roadmap add <description>
Example: /bgsd-plan roadmap add "Add authentication system"
```

Exit.
</step>

<step name="init_context">
**Context:** This workflow receives project context via `<bgsd-context>` auto-injected by the bGSD plugin's `command.execute.before` hook. If no `<bgsd-context>` block is present, the plugin is not loaded.

**If no `<bgsd-context>` found:** Stop and tell the user: "bGSD plugin required for v9.0. Install with: npx bgsd-oc"

Check `roadmap_exists` from `<bgsd-context>` JSON. If false:
```
ERROR: No roadmap found (.planning/ROADMAP.md)
Run /bgsd-new-project to initialize.
```
Exit.
</step>

<step name="add_phase">
**Delegate the phase addition to bgsd-tools:**

```bash
RESULT=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:phase add "${description}")
```

The CLI handles:
- Finding the highest existing integer phase number
- Calculating next phase number (max + 1)
- Generating slug from description
- Creating the phase directory (`.planning/phases/{NN}-{slug}/`)
- Inserting the phase entry into ROADMAP.md with Goal, Depends on, and Plans sections

Extract from result: `phase_number`, `padded`, `name`, `slug`, `directory`.
</step>

<step name="update_project_state">
Update STATE.md to reflect the new phase:

1. Read `.planning/STATE.md`
2. Under "## Accumulated Context" → "### Roadmap Evolution" add entry:
   ```
   - Phase {N} added: {description}
   ```

If "Roadmap Evolution" section doesn't exist, create it.
</step>

<step name="completion">
Present completion summary:

```
Phase {N} added to current milestone:
- Description: {description}
- Directory: .planning/phases/{phase-num}-{slug}/
- Status: Not planned yet

Roadmap updated: .planning/ROADMAP.md

---

## ▶ Next Up

**Phase {N}: {description}**

`/bgsd-plan phase {N}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/bgsd-plan roadmap add "<description>"` — add another phase
- Review `.planning/ROADMAP.md` (reference only)

---
```
</step>

</process>

<success_criteria>
- [ ] `bgsd-tools plan:phase add` executed successfully
- [ ] Phase directory created
- [ ] Roadmap updated with new phase entry
- [ ] STATE.md updated with roadmap evolution note
- [ ] User informed of next steps
</success_criteria>
