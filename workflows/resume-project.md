<trigger>
New session on existing project, user says "continue"/"resume"/"where were we", or returning after time away.
</trigger>

<purpose>Restore full project context — instant answer to "Where were we?"</purpose>

<required_reading>
@__OPENCODE_CONFIG__/bgsd-oc/references/continuation-format.md
</required_reading>

<process>

<!-- section: initialize -->
<step name="initialize">
<skill:bgsd-context-init />

Parse `<bgsd-context>` JSON for: `state_exists`, `roadmap_exists`, `project_exists`, `planning_exists`, `has_interrupted_agent`, `interrupted_agent_id`, `commit_docs`.

| state_exists | roadmap/project_exists | planning_exists | Action |
|---|---|---|---|
| true | — | — | Proceed to load_state |
| false | true | — | Offer to reconstruct STATE.md |
| — | — | false | Route to /bgsd-new-project |
</step>
<!-- /section -->

<!-- section: load_state -->
<step name="load_state">
```bash
cat .planning/STATE.md
cat .planning/PROJECT.md
```

From STATE.md: position, progress, decisions, todos, blockers, session continuity.
From PROJECT.md: description, requirements, key decisions, constraints.
</step>
<!-- /section -->

<!-- section: check_incomplete -->
<step name="check_incomplete_work">
```bash
ls .planning/phases/*/.continue-here*.md 2>/dev/null
for plan in .planning/phases/*/*-PLAN.md; do
  summary="${plan/PLAN/SUMMARY}"
  [ ! -f "$summary" ] && echo "Incomplete: $plan"
done 2>/dev/null
```

| Finding | Flag |
|---------|------|
| `.continue-here` file | "Found mid-plan checkpoint" — read file for resumption context |
| PLAN without SUMMARY | "Found incomplete plan execution" |
| `has_interrupted_agent` true | "Found interrupted agent" — read agent-history.json |
</step>
<!-- /section -->

<!-- section: present_status -->
<step name="present_status">
```
╔══════════════════════════════════════════════════════════════╗
║  Building: [one-liner]  Phase: [X]/[Y]  Plan: [A]/[B]  [XX%] ║
║  Last activity: [date] - [what happened]                     ║
╚══════════════════════════════════════════════════════════════╝
```

Append: `⚠️ Incomplete work` / `⚠️ Interrupted agent [id]` / `📋 [N] todos` / `⚠️ Blockers` as applicable.
</step>
<!-- /section -->

<!-- section: determine_action -->
<step name="determine_next_action">
**Pre-computed decision:** If `decisions.resume-route` exists in `<bgsd-context>`, use its `.value`. Skip evaluation below.

**Fallback** — routing table by state:

| State | Primary | Option |
|-------|---------|--------|
| Interrupted agent | Resume agent (Task tool) | Start fresh |
| .continue-here file | Resume from checkpoint | Start fresh on plan |
| PLAN without SUMMARY | Complete incomplete plan | Abandon and move on |
| Phase in progress, all plans done | Transition to next phase | Review work |
| Phase ready to plan, no CONTEXT.md | Discuss phase vision | Plan directly |
| Phase ready to plan, CONTEXT.md exists | Plan the phase | Review roadmap |
| Phase ready to execute | Execute next plan | Review plan first |
</step>
<!-- /section -->

<!-- section: offer_options -->
<step name="offer_options">
Present options: 1. Primary action (execute/plan/discuss), 2. Review status, 3. Check todos, 4. Review alignment, 5. Something else.

Check CONTEXT.md: `ls .planning/phases/XX-name/*-CONTEXT.md 2>/dev/null` — missing → suggest discuss-phase, exists → offer plan.

Wait for user selection.
</step>
<!-- /section -->

<!-- section: route_to_workflow -->
<step name="route_to_workflow">
Route based on selection:

- **Execute plan:**
  ```
  ## ▶ Next Up
  **{phase}-{plan}: [Plan Name]** — [objective]
  `/bgsd-execute-phase {phase}`
  <sub>`/clear` first → fresh context window</sub>
  ```

- **Plan phase:**
  ```
  ## ▶ Next Up
  **Phase [N]: [Name]** — [Goal]
  `/bgsd-plan phase [N]`
  <sub>`/clear` first → fresh context window</sub>
  **Also available:** `/bgsd-plan discuss [N]`
  ```

- **Transition** → `./transition.md`
- **Check todos** → Read `.planning/todos/pending/`, present summary
- **Review alignment** → Read PROJECT.md, compare to current state
- **Something else** → Ask what they need
</step>
<!-- /section -->

<!-- section: update_session -->
<step name="update_session">
Update STATE.md Session Continuity:
```markdown
Last session: [now]
Stopped at: Session resumed, proceeding to [action]
Resume file: [updated if applicable]
```
</step>
<!-- /section -->

</process>

<!-- section: reconstruction -->
<reconstruction>
If STATE.md missing but other artifacts exist:

"STATE.md missing. Reconstructing..."

1. PROJECT.md → "What This Is", Core Value
2. ROADMAP.md → phases, current position
3. `*-SUMMARY.md` → decisions, concerns
4. `.planning/todos/pending/` → pending count
5. `.continue-here` files → session continuity

Reconstruct and write STATE.md, then proceed normally.
</reconstruction>
<!-- /section -->

<!-- section: quick_resume -->
<quick_resume>
If user says "continue" or "go": load state silently, determine primary action, execute immediately. "Continuing from [state]... [action]"
</quick_resume>
<!-- /section -->

<!-- section: success_criteria -->
<success_criteria>
- [ ] STATE.md loaded (or reconstructed)
- [ ] Incomplete work detected and flagged
- [ ] Clear status presented
- [ ] Contextual next actions offered
- [ ] User knows where project stands
- [ ] Session continuity updated
</success_criteria>
<!-- /section -->
