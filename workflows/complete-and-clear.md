<purpose>
End a session cleanly with a summary of what was accomplished and a prompt for the next action.
The next session picks up immediately without confusion about what happened previously.
</purpose>

<required_reading>
Read STATE.md before starting. No other files needed — session-summary CLI provides all data.
</required_reading>

<process>

<step name="summarize">
Call session-summary to get structured session data:

```bash
SUMMARY=$(node /home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs session-summary)
```

Parse the JSON response. If error field present, display "No session data available" and suggest `/gsd-resume`.
</step>

<step name="display">
Format the session summary using UI brand patterns:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► SESSION COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## What Was Done

- ✓ Completed {plan-id}: {plan-name}
  [repeat for each plan in session_activity.plans_completed]
- ✓ {N} decisions recorded
  [or "No plans completed this session" if empty]

## Current State

Phase: {current_position.phase} — {current_position.phase_name}
Status: {current_position.status}

## Decisions Made

- {decision-1}
- {decision-2}
  [from session_activity.decisions_made, or "None this session"]
```

**Edge case:** If `plans_completed` is empty, show "No plans completed this session" and still display current state and decisions.
</step>

<step name="update_state">
Update STATE.md session continuity with the stopped-at description:

```bash
node /home/cam/.config/opencode/get-shit-done/bin/gsd-tools.cjs state record-session \
  --stopped-at "{session_continuity.stopped_at}" \
  --resume-file "None"
```

This stamps STATE.md with accurate session ending info for the next `/gsd-resume`.
</step>

<step name="suggest_next">
Display the Next Up block from next_action:

```
───────────────────────────────────────────────────────────────

## ▶ Next Up

**{next_action.description}**

`{next_action.command}`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────────────────────────
```

**Edge case:** If no next action determinable (command is `/gsd-resume`), show:
```
## ▶ Next Up

Run `/gsd-resume` to pick up where you left off.
```

Remind the user to `/clear` for a fresh context window before starting the next session.
</step>

</process>

<success_criteria>
- [ ] Session summary displayed with completed work
- [ ] STATE.md session continuity updated
- [ ] Next command suggested with /clear reminder
</success_criteria>
