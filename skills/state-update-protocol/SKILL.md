---
name: state-update-protocol
description: STATE.md and ROADMAP.md update procedures after plan completion — advancing position, recording metrics, adding decisions, updating session continuity, and marking requirements complete.
type: shared
agents: [executor, github-ci]
---

## Purpose

Standardizes how agents update project state after completing a plan. STATE.md is the project's memory — recording position, decisions, metrics, and session continuity. ROADMAP.md tracks plan progress. REQUIREMENTS.md tracks requirement completion. All updates use bgsd-tools CLI commands to ensure consistent format.

## Placeholders

| Placeholder | Description | Example |
|---|---|---|
| `{{phase}}` | Current phase identifier | `01-foundation` |
| `{{plan}}` | Current plan number | `02` |
| `{{bgsd_home}}` | Path to bgsd-tools installation | `/home/user/.config/oc/bgsd-oc` |

## Content

### State Update Sequence

After SUMMARY.md is created (post self-check), execute these commands in order:

**1. Advance plan counter:**
```bash
node {{bgsd_home}}/bin/bgsd-tools.cjs verify:state advance-plan
```
Increments Current Plan, detects last-plan edge case, sets status.

**2. Recalculate progress:**
```bash
node {{bgsd_home}}/bin/bgsd-tools.cjs verify:state update-progress
```
Recalculates progress bar from SUMMARY.md counts on disk.

**3. Record execution metrics:**
```bash
node {{bgsd_home}}/bin/bgsd-tools.cjs verify:state record-metric \
  --phase "{{phase}}" --plan "{{plan}}" --duration "${DURATION}" \
  --tasks "${TASK_COUNT}" --files "${FILE_COUNT}"
```
Appends to Performance Metrics table in STATE.md.

**4. Add decisions:**

Extract key decisions from SUMMARY.md frontmatter or "Decisions Made" section, then record each:
```bash
node {{bgsd_home}}/bin/bgsd-tools.cjs verify:state add-decision \
  --phase "{{phase}}" --summary "${DECISION_TEXT}"
```
Adds to Decisions section, removes placeholders.

**5. Update session continuity:**
```bash
node {{bgsd_home}}/bin/bgsd-tools.cjs verify:state record-session \
  --stopped-at "Completed {{phase}}-{{plan}}-PLAN.md"
```
Updates Last session timestamp and Stopped At fields.

### ROADMAP.md Progress Update

```bash
node {{bgsd_home}}/bin/bgsd-tools.cjs plan:roadmap update-plan-progress "${PHASE_NUMBER}"
```
Updates ROADMAP.md progress table row with PLAN vs SUMMARY counts.

### Requirements Completion

Extract requirement IDs from the PLAN.md frontmatter `requirements:` field, then mark each complete:
```bash
node {{bgsd_home}}/bin/bgsd-tools.cjs plan:requirements mark-complete ${REQ_IDS}
```
Checks off requirement checkboxes and updates traceability table in REQUIREMENTS.md. Skip this step if the plan has no `requirements` field.

### Blocker Recording

If blockers were encountered during execution:
```bash
node {{bgsd_home}}/bin/bgsd-tools.cjs verify:state add-blocker "Blocker description"
```

### Final Metadata Commit

Commit all state/documentation changes separately from task commits:
```bash
node {{bgsd_home}}/bin/bgsd-tools.cjs execute:commit "docs({{phase}}-{{plan}}): complete [plan-name] plan" \
  --files .planning/phases/XX-name/{{phase}}-{{plan}}-SUMMARY.md .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md
```

### CI Agent State Ownership

The CI agent's state update behavior depends on invocation:
- **Spawned by parent workflow** (`<spawned_by>` tag present): Do NOT update STATE.md directly. Return decisions and session data in CI COMPLETE for the parent to record.
- **Invoked directly** (no `<spawned_by>` tag): Update STATE.md directly using the commands above.

## Cross-references

- <skill:commit-protocol /> — State updates happen after task commits
- <skill:structured-returns /> — Return formats include state update confirmation

## Examples

**Full state update sequence after plan completion:**
```bash
# After SUMMARY.md written and self-checked
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state advance-plan
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state update-progress
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state record-metric \
  --phase "03-auth" --plan "02" --duration "18 min" \
  --tasks "3" --files "5"
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state add-decision \
  --phase "03-auth" --summary "Used jose instead of jsonwebtoken for Edge compatibility"
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state record-session \
  --stopped-at "Completed 03-02-PLAN.md"
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:roadmap update-plan-progress "03"
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:requirements mark-complete AUTH-01 AUTH-02
```
