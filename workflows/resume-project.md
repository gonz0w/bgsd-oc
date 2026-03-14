<trigger>
New session on existing project, user says "continue"/"resume"/"where were we", or returning after time away.
</trigger>

<purpose>
Restore full project context — instant answer to "Where were we?"
</purpose>

<required_reading>
@__OPENCODE_CONFIG__/bgsd-oc/references/continuation-format.md
</required_reading>

<process>

<step name="initialize">
**Context:** This workflow receives project context via `<bgsd-context>` auto-injected by the bGSD plugin's `command.execute.before` hook. If no `<bgsd-context>` block is present, the plugin is not loaded.

**If no `<bgsd-context>` found:** Stop and tell the user: "bGSD plugin required for v9.0. Install with: npx bgsd-oc"

Parse `<bgsd-context>` JSON for: `state_exists`, `roadmap_exists`, `project_exists`, `planning_exists`, `has_interrupted_agent`, `interrupted_agent_id`, `commit_docs`.

**If `state_exists` is true:** Proceed to load_state
**If `state_exists` is false but `roadmap_exists` or `project_exists` is true:** Offer to reconstruct STATE.md
**If `planning_exists` is false:** This is a new project - route to /bgsd-new-project
</step>

<step name="load_state">
```bash
cat .planning/STATE.md
cat .planning/PROJECT.md
```

From STATE.md: project reference, current position, progress, decisions, todos, blockers, session continuity.
From PROJECT.md: description, requirements, key decisions, constraints.
</step>

<step name="check_incomplete_work">
Look for incomplete work that needs attention:

```bash
# Check for continue-here files (mid-plan resumption)
ls .planning/phases/*/.continue-here*.md 2>/dev/null

# Check for plans without summaries (incomplete execution)
for plan in .planning/phases/*/*-PLAN.md; do
  summary="${plan/PLAN/SUMMARY}"
  [ ! -f "$summary" ] && echo "Incomplete: $plan"
done 2>/dev/null

# Check for interrupted agents (use has_interrupted_agent and interrupted_agent_id from init)
if [ "$has_interrupted_agent" = "true" ]; then
  echo "Interrupted agent: $interrupted_agent_id"
fi
```

**If .continue-here file exists:**

- This is a mid-plan resumption point
- Read the file for specific resumption context
- Flag: "Found mid-plan checkpoint"

**If PLAN without SUMMARY exists:**

- Execution was started but not completed
- Flag: "Found incomplete plan execution"

**If interrupted agent found:**

- Subagent was spawned but session ended before completion
- Read agent-history.json for task details
- Flag: "Found interrupted agent"
  </step>

<step name="present_status">
Present complete project status to user:

```
╔══════════════════════════════════════════════════════════════╗
║  PROJECT STATUS                                               ║
╠══════════════════════════════════════════════════════════════╣
║  Building: [one-liner from PROJECT.md "What This Is"]         ║
║                                                               ║
║  Phase: [X] of [Y] - [Phase name]                            ║
║  Plan:  [A] of [B] - [Status]                                ║
║  Progress: [██████░░░░] XX%                                  ║
║                                                               ║
║  Last activity: [date] - [what happened]                     ║
╚══════════════════════════════════════════════════════════════╝

[If incomplete work found:]
⚠️  Incomplete work detected:
    - [.continue-here file or incomplete plan]

[If interrupted agent found:]
⚠️  Interrupted agent detected:
    Agent ID: [id]
    Task: [task description from agent-history.json]
    Interrupted: [timestamp]

    Resume with: Task tool (resume parameter with agent ID)

[If pending todos exist:]
📋 [N] pending todos — /bgsd-check-todos to review

[If blockers exist:]
⚠️  Carried concerns:
    - [blocker 1]
    - [blocker 2]

[If alignment is not ✓:]
⚠️  Brief alignment: [status] - [assessment]
```

</step>

<step name="determine_next_action">
**Pre-computed decision:** If `decisions.resume-route` exists in `<bgsd-context>`, use its `.value` as the primary next action. Skip condition evaluation below.

**Fallback** (if decisions not available):

Based on project state, determine the most logical next action:

**If interrupted agent exists:**
→ Primary: Resume interrupted agent (Task tool with resume parameter)
→ Option: Start fresh (abandon agent work)

**If .continue-here file exists:**
→ Primary: Resume from checkpoint
→ Option: Start fresh on current plan

**If incomplete plan (PLAN without SUMMARY):**
→ Primary: Complete the incomplete plan
→ Option: Abandon and move on

**If phase in progress, all plans complete:**
→ Primary: Transition to next phase
→ Option: Review completed work

**If phase ready to plan:**
→ Check if CONTEXT.md exists for this phase:

- If CONTEXT.md missing:
  → Primary: Discuss phase vision (how user imagines it working)
  → Secondary: Plan directly (skip context gathering)
- If CONTEXT.md exists:
  → Primary: Plan the phase
  → Option: Review roadmap

**If phase ready to execute:**
→ Primary: Execute next plan
→ Option: Review the plan first
</step>

<step name="offer_options">
Present contextual options based on project state:

```
What would you like to do?

[Primary action based on state - e.g.:]
1. Resume interrupted agent [if interrupted agent found]
   OR
1. Execute phase (/bgsd-execute-phase {phase})
   OR
1. Discuss Phase 3 context (/bgsd-discuss-phase 3) [if CONTEXT.md missing]
   OR
1. Plan Phase 3 (/bgsd-plan-phase 3) [if CONTEXT.md exists or discuss option declined]

[Secondary options:]
2. Review current phase status
3. Check pending todos ([N] pending)
4. Review brief alignment
5. Something else
```

**Note:** When offering phase planning, check for CONTEXT.md existence first:

```bash
ls .planning/phases/XX-name/*-CONTEXT.md 2>/dev/null
```

If missing, suggest discuss-phase before plan. If exists, offer plan directly.

Wait for user selection.
</step>

<step name="route_to_workflow">
Based on user selection, route to appropriate workflow:

- **Execute plan** → Show command for user to run after clearing:
  ```
  ---

  ## ▶ Next Up

  **{phase}-{plan}: [Plan Name]** — [objective from PLAN.md]

`/bgsd-execute-phase {phase}`

<sub>`/clear` first → fresh context window</sub>

  ---
  ```
- **Plan phase** → Show command for user to run after clearing:
  ```
  ---

  ## ▶ Next Up

  **Phase [N]: [Name]** — [Goal from ROADMAP.md]

`/bgsd-plan-phase [phase-number]`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/bgsd-discuss-phase [N]` — gather context first
- `/bgsd-research-phase [N]` — investigate unknowns

  ---
  ```
- **Transition** → ./transition.md
- **Check todos** → Read .planning/todos/pending/, present summary
- **Review alignment** → Read PROJECT.md, compare to current state
- **Something else** → Ask what they need
</step>

<step name="update_session">
Before proceeding to routed workflow, update session continuity:

Update STATE.md:

```markdown
## Session Continuity

Last session: [now]
Stopped at: Session resumed, proceeding to [action]
Resume file: [updated if applicable]
```

This ensures if session ends unexpectedly, next resume knows the state.
</step>

</process>

<reconstruction>
If STATE.md is missing but other artifacts exist:

"STATE.md missing. Reconstructing from artifacts..."

1. Read PROJECT.md → Extract "What This Is" and Core Value
2. Read ROADMAP.md → Determine phases, find current position
3. Scan \*-SUMMARY.md files → Extract decisions, concerns
4. Count pending todos in .planning/todos/pending/
5. Check for .continue-here files → Session continuity

Reconstruct and write STATE.md, then proceed normally.

This handles cases where:

- Project predates STATE.md introduction
- File was accidentally deleted
- Cloning repo without full .planning/ state
  </reconstruction>

<quick_resume>
If user says "continue" or "go":
- Load state silently
- Determine primary action
- Execute immediately without presenting options

"Continuing from [state]... [action]"
</quick_resume>

<success_criteria>
Resume is complete when:

- [ ] STATE.md loaded (or reconstructed)
- [ ] Incomplete work detected and flagged
- [ ] Clear status presented to user
- [ ] Contextual next actions offered
- [ ] User knows exactly where project stands
- [ ] Session continuity updated
      </success_criteria>
