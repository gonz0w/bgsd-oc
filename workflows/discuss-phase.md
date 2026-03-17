<!-- section: purpose -->
<purpose>
Extract implementation decisions that downstream agents need. Analyze the phase for gray areas, let the user choose what to discuss, then Socratic-dive each area — questioning assumptions at every turn. Capture decisions WITH REASONING, not just choices.

After discussion, stress-test by role-playing a frustrated 2-year power user. Future-proof without over-engineering.

**CONTEXT.md feeds:** bgsd-phase-researcher (what to research) + bgsd-planner (what's locked). Your job: capture decisions clearly enough that downstream agents don't need to ask again.
</purpose>
<!-- /section -->

<!-- section: scope_guardrail -->
<scope_guardrail>
**No scope creep.** Phase boundary from ROADMAP.md is FIXED. Discussion clarifies HOW, never adds capabilities.

Clarifies existing scope → OK. New capability that could be its own phase → scope creep. On creep: "That's a new capability — its own phase. I'll note it as deferred. Back to [phase domain]."
</scope_guardrail>
<!-- /section -->

<!-- section: gray_area_identification -->
<gray_area_identification>
Gray areas = implementation decisions the user cares about — things that could go multiple ways and change the result.

**Identify by domain type:**
- Users SEE → visual presentation, interactions, states
- Users CALL → interface contracts, responses, errors
- Users RUN → invocation, output, behavior modes
- Users READ → structure, tone, depth, flow
- ORGANIZED → criteria, grouping, exception handling

Generate phase-specific areas (not generic labels). Examples:
```
Phase: "User authentication" → Session handling, Error responses, Multi-device policy, Recovery flow
Phase: "CLI for database backups" → Output format, Flag design, Progress reporting, Error recovery
```

**Don't ask about:** technical details, architecture patterns, performance, scope.
</gray_area_identification>
<!-- /section -->

<process>

<!-- section: initialize -->
<step name="initialize" priority="first">
<skill:bgsd-context-init />

Parse `<bgsd-context>` JSON for: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`, `plan_count`, `roadmap_exists`, `planning_exists`.

**If `phase_found` is false:**
```
Phase [X] not found in roadmap. Use /bgsd-progress to see available phases.
```
Exit.
</step>
<!-- /section -->

<!-- section: check_existing -->
<step name="check_existing">
Use `has_context` from init. If CONTEXT.md exists — use question:
- "Update it" → load existing, continue to analyze_phase
- "View it" → display, then offer update/skip
- "Skip" → exit

If no CONTEXT.md and `has_plans` is true — use question: "Phase [X] already has {plan_count} plan(s) without user context. Decisions here won't affect existing plans unless you replan."
- "Continue and replan after" → continue
- "View existing plans" → display, then offer "Continue" / "Cancel"
- "Cancel" → exit

If no CONTEXT.md and no plans: continue to analyze_phase.
</step>
<!-- /section -->

<!-- section: analyze_phase -->
<step name="analyze_phase">
Read phase description from ROADMAP.md. Determine:

1. **Domain boundary** — What capability is this phase delivering?
2. **Gray areas** (1-2 per category) — specific ambiguities that would change implementation
3. **Skip assessment** — pure infrastructure or clear-cut → may not need discussion

Output analysis internally, then present to user.
</step>
<!-- /section -->

<!-- section: present_gray_areas -->
<step name="present_gray_areas">
State the boundary:
```
Phase [X]: [Name]
Domain: [What this phase delivers]

We'll clarify HOW to implement this. (New capabilities belong in other phases.)
```

Use question (multiSelect: true):
- header: "Discuss"
- question: "Which areas do you want to discuss for [phase name]?"
- options: 3-4 phase-specific gray areas, each with 1-2 concrete questions

**Do NOT include "skip" or "you decide" options.** Give real choices.
</step>
<!-- /section -->

<!-- section: discuss_areas -->
<step name="discuss_areas">
For each selected area, conduct a focused Socratic discussion loop.

**Approach:** Question assumptions, ask "why", dig deeper. Not adversarial — curious. "Help me understand" not "prove it."

**Patterns:**
- "Why this over [alternative]?"
- "What changes if we're wrong about [assumption]?"
- "Who benefits from this decision?"
- "What would have to be true for [opposite] to be better?"

**Per area:**
1. "Let's talk about [Area]."
2. Ask 4 questions via question (header: "[Area]", max 12 chars). Include "You decide" when reasonable. **After each answer:** ask a "why" follow-up before the next question.
3. After 4 questions: "More questions about [area], or move to next?" → "More questions" (4 more) / "Next area"
   - Continuation phrases ("chat more", "keep going", "yes") → More questions
   - Advancement phrases ("done", "move on", "next") → Next area
   - Ambiguous → ask explicitly

4. After all areas: proceed to `customer_stress_test`.

**Scope creep:** "That belongs in its own phase. I'll note it as deferred. Back to [area]: [question]"

**Question design:** Concrete options ("Cards" not "Option A"). Every decision gets a "why" follow-up.
</step>
<!-- /section -->

<!-- section: customer_stress_test -->
<step name="customer_stress_test">
Quick adversarial review (2-3 min, 3-5 challenges). Role-play as a frustrated 2-year power user who cares about the product.

```
---
**Stress Test:** Before I write this up, let me put on a different hat.
I'll play someone who's been using this for 2 years — invested, opinionated, seen things break. I'll push back on decisions we made. Defend them, change your mind, or say "good point." Quick — 3-5 challenges.
---
```

**Challenge angles:** over-engineering / future-proofing gaps / migration pain / consistency / missing basics.

**Format per challenge:** State complaint in-character (1-2 sentences) → wait for response → accept or push back once more.

After 3-5 challenges:
- question: "That's my grumpy user impression. Any of those points change your thinking?"
- options: "No changes — proceed" / "Revisit a decision"

Revised decisions → note in CONTEXT.md under "Stress-Tested". Then proceed to write_context.
</step>
<!-- /section -->

<!-- section: write_context -->
<step name="write_context">
Use `phase_dir`, `phase_slug`, `padded_phase` from `<bgsd-context>`. If `phase_dir` is null:
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

Write `${phase_dir}/${padded_phase}-CONTEXT.md`:

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary
[Clear statement of what this phase delivers]
</domain>

<decisions>
## Implementation Decisions

### [Category 1]
- [Decision]

### Agent's Discretion
[Areas where user said "you decide"]
</decisions>

<specifics>
## Specific Ideas
[Particular references, examples, "I want it like X" moments. If none: "No specific requirements — open to standard approaches"]
</specifics>

<stress_tested>
## Stress-Tested Decisions
[Decisions challenged during stress test — downstream agents treat these as high-confidence.
If none changed: "All decisions held up under stress testing — no revisions needed"]
</stress_tested>

<deferred>
## Deferred Ideas
[Ideas that came up but belong in other phases. If none: "None — discussion stayed within phase scope"]
</deferred>

---
*Phase: XX-name*
*Context gathered: [date]*
```
</step>
<!-- /section -->

<!-- section: confirm_creation -->
<step name="confirm_creation">
```
Created: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisions Captured
### [Category]
- [Key decision]

[If deferred ideas:]
## Noted for Later
- [Deferred idea] — future phase

---
## ▶ Next Up

**Phase ${PHASE}: [Name]** — [Goal]

`/bgsd-plan-phase ${PHASE}`

<sub>`/clear` first → fresh context window</sub>

---
**Also available:**
- `/bgsd-plan-phase ${PHASE} --skip-research` — plan without research
- Review/edit CONTEXT.md before continuing
---
```
</step>
<!-- /section -->

<!-- section: git_commit -->
<step name="git_commit">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs(${padded_phase}): capture phase context" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```
</step>
<!-- /section -->

<!-- section: update_state -->
<step name="update_state">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state record-session \
  --stopped-at "Phase ${PHASE} context gathered" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs(state): record phase ${PHASE} context session" --files .planning/STATE.md
```
</step>
<!-- /section -->

<!-- section: auto_advance -->
<step name="auto_advance">
**Pre-computed decision:** If `decisions.auto-advance` exists in `<bgsd-context>`, use its `.value`. Skip config check below.

**Fallback:**
1. Parse `--auto` flag from $ARGUMENTS
2. ```bash
   AUTO_CFG=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

If `--auto` flag present AND `AUTO_CFG` not true → persist:
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:config-set workflow.auto_advance true
```

**If `--auto` OR `AUTO_CFG` true:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 bGSD ► AUTO-ADVANCING TO PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Context captured. Spawning plan-phase...
```

```
Task(
  prompt="Run /bgsd-plan-phase ${PHASE} --auto",
  subagent_type="general",
  description="Plan Phase ${PHASE}"
)
```

- **PLANNING COMPLETE** → plan-phase handles chaining to execute-phase
- **CHECKPOINT** → display result, stop: "Auto-advance stopped: Planning needs input. /bgsd-plan-phase ${PHASE}"

**If neither `--auto` nor config:** route to `confirm_creation`.
</step>
<!-- /section -->

</process>

<!-- section: success_criteria -->
<success_criteria>
- Phase validated against roadmap
- Gray areas identified through intelligent analysis (not generic questions)
- User selected areas to discuss
- Each area explored with Socratic "why" follow-ups
- Scope creep redirected to deferred ideas
- Customer stress test challenged decisions from real-user perspective
- CONTEXT.md captures decisions with reasoning and stress-test results
- Deferred ideas preserved for future phases
- STATE.md updated with session info
- User knows next steps
</success_criteria>
<!-- /section -->
