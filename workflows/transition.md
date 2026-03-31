<!-- section: purpose -->
<purpose>
Mark current phase complete and advance to next. "Planning next phase" = "current phase is done."
</purpose>
<!-- /section -->

<skill:bgsd-context-init />

<process>

<!-- section: load_state -->
<step name="load_project_state" priority="first">
```bash
cat .planning/STATE.md 2>/dev/null
cat .planning/PROJECT.md 2>/dev/null
```

Parse current position. Note accumulated context needing updates.
</step>
<!-- /section -->

<!-- section: verify_completion -->
<step name="verify_completion">
```bash
ls .planning/phases/XX-current/*-PLAN.md 2>/dev/null | sort
ls .planning/phases/XX-current/*-SUMMARY.md 2>/dev/null | sort
```

Count PLANs vs SUMMARYs. Match → complete. Mismatch → incomplete.

**If all plans complete:**

<if mode="yolo">

```
⚡ Auto-approved: Transition Phase [X] → Phase [X+1]
```

Proceed to cleanup_handoff.

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

Ask: "Phase [X] complete — all [Y] plans finished. Ready to mark done and move to Phase [X+1]?"
→ Options: `questionTemplate('transition-complete', 'SINGLE_CHOICE')` (Mark done / Cancel)

</if>

**If plans incomplete:**

**SAFETY RAIL: always_confirm_destructive applies.** Always prompt regardless of mode.

```
Phase [X] has incomplete plans:
- {phase}-01-SUMMARY.md ✓ Complete
- {phase}-02-SUMMARY.md ✗ Missing

⚠️ Safety rail: Skipping plans requires confirmation (destructive action)

→ Options: `questionTemplate('transition-incomplete', 'SINGLE_CHOICE')` (Continue current phase / Mark complete anyway / Review what's left)
```

</step>
<!-- /section -->

<!-- section: cleanup_handoff -->
<step name="cleanup_handoff">
```bash
ls .planning/phases/XX-current/.continue-here*.md 2>/dev/null
```

If found, delete them — phase is complete, handoffs are stale.
</step>
<!-- /section -->

<!-- section: update_roadmap -->
<step name="update_roadmap_and_state">
```bash
TRANSITION=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:phase complete "${current_phase}")
```

CLI handles: phase checkbox `[x]`, plan count, Progress table, STATE.md advance, last-phase detection.
Extract: `completed_phase`, `plans_executed`, `next_phase`, `next_phase_name`, `is_last_phase`.
</step>
<!-- /section -->

<!-- section: evolve_project -->
<step name="evolve_project">

Read phase summaries:
```bash
cat .planning/phases/XX-current/*-SUMMARY.md
```

Assess requirement changes using this decision table:

| Change type | Condition | Action |
|-------------|-----------|--------|
| Validated | Active requirement shipped | Move to Validated: `- ✓ [Req] — Phase X` |
| Invalidated | Requirement found unnecessary | Move to Out of Scope with reason |
| Emerged | New requirement discovered | Add to Active: `- [ ] [New req]` |
| Decision | Decision made in SUMMARY | Add to Key Decisions table |
| Description | Product meaningfully changed | Update "What This Is" |

Update PROJECT.md inline. Update footer:
```markdown
---
*Last updated: [date] after Phase [X]*
```

**Step complete when:** Validated/invalidated/emerged requirements updated, decisions logged, description current.
</step>
<!-- /section -->

<!-- section: update_position -->
<step name="update_current_position_after_transition">
Basic position updates were handled by `bgsd-tools plan:phase complete`. Verify STATE.md is correct. If progress bar needs updating:

```bash
PROGRESS=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:progress bar)
```

Update the progress bar line in STATE.md.
</step>
<!-- /section -->

<!-- section: update_reference -->
<step name="update_project_reference">
Update Project Reference in STATE.md: date, core value, current focus → next phase name.
</step>
<!-- /section -->

<!-- section: review_context -->
<step name="review_accumulated_context">
**Decisions:** Note recent decisions (3-5 max). Full log in PROJECT.md.

**Blockers:** Resolved → remove. Still relevant → keep with "Phase X" prefix. New from summaries → add.
</step>
<!-- /section -->

<!-- section: update_session -->
<step name="update_session_continuity_after_transition">
Update Session Continuity in STATE.md:
```markdown
Last session: [today]
Stopped at: Phase [X] complete, ready to plan Phase [X+1]
Resume file: None
```
</step>
<!-- /section -->

<!-- section: offer_next -->
<step name="offer_next_phase">

Before offering the next phase route, run a brief lessons review so prompt/workflow improvements stay visible at phase boundaries:

```bash
RECENT_LESSONS=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs lessons:list --limit 8 2>/dev/null)
LESSON_SUGGESTIONS=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs lessons:suggest 2>/dev/null)
```

If `RECENT_LESSONS.count > 0` or `LESSON_SUGGESTIONS.suggestion_count > 0`, show a compact `## Lessons Review` block before `## ▶ Next Up`:
- `Recent captures:` up to 3 newest lessons (title, severity, type, affected_agents)
- `Optimization suggestions:` up to 3 highest-priority suggestions from `lessons:suggest`
- Close with: `Review whether these point to planner, workflow, or tool-use improvements before starting the next phase.`

Keep this review advisory only. Do not block transition on lessons review, and do not create new lessons during this step.

Pre-computed decisions: use `decisions.auto-advance` and `decisions.branch-handling` from `<bgsd-context>` if present.

Treat auto-advance as fresh-context chaining, not as permission to keep driving from one long-lived transcript.

- The additive fast path still uses the familiar yolo/`--auto` surface, but each hop should hand off to the next workflow through durable artifacts and a fresh context window.
- Auto-advance may continue only after the prior workflow has already written or refreshed its durable handoff artifact for the current phase with the current expected fingerprint. Do not chain on summaries, session fields, or optimistic assumptions alone.
- `discuss` remains the only clean-start exception for a same-phase restart; later steps should consume the validated handoff/resume contract instead of inventing a second continuation model.
- Do not silently bypass the explicit resume summary when chain state already exists. If a handoff-backed resume path is available, preserve the `resume` / `inspect` / `restart` choice before continuing.

Use `is_last_phase` from `plan:phase complete`:

→ Next action: `questionTemplate('transition-next-route', 'SINGLE_CHOICE')` (Plan more phases / Complete milestone)

**Route A (more phases):** Check `ls .planning/phases/*[X+1]*/*-CONTEXT.md 2>/dev/null`
- Yolo: spawn the next command in a fresh context window. CONTEXT.md → `/bgsd-plan phase [X+1] --auto`, else `/bgsd-plan discuss [X+1] --auto`
- Interactive: Show `## ✓ Phase [X] Complete` + `## ▶ Next Up` block with `/bgsd-plan discuss [X+1]` (no context) or `/bgsd-plan phase [X+1]` (has context), `<sub>/clear first</sub>`

**Route B (milestone complete):**
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:config-set workflow.auto_advance false
```
- Yolo: `🎉 Milestone {version} complete!` → exit, run `/bgsd-complete-milestone {version}`
- Interactive: `## ✓ Phase {X} Complete` + `🎉 100% complete` + `## ▶ Next Up: /bgsd-complete-milestone {version}` + `<sub>/clear first</sub>`

</step>
<!-- /section -->

</process>

<!-- section: implicit_tracking -->
<implicit_tracking>
Progress tracking is IMPLICIT: planning phase N implies phases 1-(N-1) complete. No separate progress step — forward motion IS progress.
</implicit_tracking>
<!-- /section -->

<!-- section: partial_completion -->
<partial_completion>
If user wants to move on but phase isn't fully complete, present:

```
Phase [X] has incomplete plans:
- {phase}-02-PLAN.md (not executed)

Options:
1. Mark complete anyway (plans weren't needed)
2. Defer work to later phase
3. Stay and finish current phase
```

If marking complete with incomplete plans: update ROADMAP as "2/3 plans complete" and note skipped plans.
</partial_completion>
<!-- /section -->

<!-- section: success_criteria -->
<success_criteria>
- [ ] Phase summaries verified (all exist or user chose to skip)
- [ ] Stale handoffs deleted
- [ ] ROADMAP.md updated with completion status and plan count
- [ ] PROJECT.md evolved (requirements, decisions, description)
- [ ] STATE.md updated (position, project reference, context, session)
- [ ] Progress table updated
- [ ] User knows next steps
</success_criteria>
<!-- /section -->
