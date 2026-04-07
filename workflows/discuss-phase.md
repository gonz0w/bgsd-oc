<!-- section: purpose -->
<purpose>
Extract implementation decisions that downstream agents need. Analyze the phase for gray areas, rank them by impact, then work through the meaningful ambiguity until the important decisions are no longer guesswork. Capture decisions WITH REASONING, not just choices.

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

Rank every gray area before discussion:
- High = big implementation impact, user-visible consequences, or major planning risk if guessed wrong
- Medium = meaningful behavior or structure differences, but unlikely to derail the phase if defaulted carefully
- Low = useful clarification, but safe to default without materially changing the phase outcome

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
**Context:** This workflow prefers project context from `<bgsd-context>` auto-injected by the bGSD plugin's `command.execute.before` hook.

**If `<bgsd-context>` is present:** Parse that JSON directly.

**If no `<bgsd-context>` found:** Treat this as a routed or copied `/bgsd-plan discuss <phase-number>` execution where the slash-command hook was bypassed. Reconstruct the same phase-discussion context from the explicit phase argument:

- Extract `PHASE` from the first non-flag token in `$ARGUMENTS`. If no phase number can be extracted:

```
ERROR: Phase number required.
Usage: /bgsd-plan discuss <phase-number>
Example: /bgsd-plan discuss 92
Use /bgsd-inspect progress to see available phases.
```

Exit.

```bash
BGSD_CONTEXT=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs init:phase-op "${PHASE}" --raw)
```

If the fallback command fails unexpectedly, then tell the user: "bGSD plugin required for v9.0. Install with: npx bgsd-oc"

**Load phase discussion context from `<bgsd-context>` JSON or `BGSD_CONTEXT`:**

Parse the loaded JSON for: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`, `plan_count`, `roadmap_exists`, `planning_exists`, `resume_summary`.

Parse `$ARGUMENTS` for `--fast`:
- If `--fast` is present, set `is_fast = true`
- Pass `is_fast` forward through the workflow state

**If `phase_found` is false:**
```
Phase [X] not found in roadmap. Use /bgsd-inspect progress to see available phases.
```
Exit.
</step>
<!-- /section -->

<!-- section: handoff_entry -->
<step name="handoff_aware_entrypoint">
Use `resume_summary` as the chain-aware re-entry contract when prior handoff artifacts exist.

- If `resume_summary` is absent: `discuss` is the only workflow step allowed to start cleanly with no prior chain state.
- That clean-start path stays additive: it does not invent a second orchestration mode or change the reference-style standalone `/bgsd-plan discuss <phase-number>` behavior.
- If `resume_summary` is present and valid: show the explicit resume summary first and preserve the exact `resume` / `inspect` / `restart` contract instead of silently resuming.
- If `resume_summary` is present but invalid: fail closed for chained continuation, keep `inspect` and `restart` available, and do not guess from `STATE.md` or partial markdown artifacts.
- On `restart`, treat `discuss` as the clean-start exception, but replace the previous same-phase handoff set only after the new discuss handoff artifacts are durable and fresh for the current planning inputs.
</step>
<!-- /section -->

<!-- section: check_existing -->
<step name="check_existing">
Use `has_context` from init. If CONTEXT.md exists — use questionTemplate('discuss-context-existing', 'SINGLE_CHOICE'):
- "Update it" → load existing, continue to analyze_phase
- "View it" → display, then offer update/skip
- "Skip" → exit

If no CONTEXT.md and `has_plans` is true — use questionTemplate('discuss-replan-warning', 'SINGLE_CHOICE'):
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
3. **Priority ranking** for each gray area — High / Medium / Low based on user-visible impact, implementation impact, and planner risk
4. **Low-risk candidates** — Low-ranked choices that appear low-conflict, consistent with existing product patterns, and safe to propose as defaults
5. **Skip assessment** — pure infrastructure or clear-cut → may not need discussion

Output analysis internally, then present to user.
</step>
<!-- /section -->

<!-- section: low_risk_fast_path -->
<step name="low_risk_fast_path">
Before opening the full discussion flow, look for 1-3 low-risk gray areas. These should be Low-ranked gray areas that meet **all** of these tests:

- consistent with roadmap intent, requirements, and established product patterns
- unlikely to create a materially different user-visible outcome
- no unresolved tension with locked decisions or deferred ideas
- safe to treat as a default unless the user objects

If none qualify: proceed to `present_gray_areas`.

If some qualify, present them as a quick confirmation pass:

```
Before we go area-by-area, here are the low-risk defaults I'd carry unless you want to redirect them:
- [Area]: [proposed default]
- [Area]: [proposed default]

I'll treat these as defaults unless you want to discuss one.
```

Use questionTemplate('discuss-low-risk-path', 'SINGLE_CHOICE'):
- "Lock defaults and continue" → record each as a defaulted decision, then continue to `present_gray_areas`
- "Discuss one of them" → move the chosen item into the normal discussion set, then continue to `present_gray_areas`
- "Skip defaults" → record no decision yet, then continue to `present_gray_areas`

**Important:** This fast path only compresses low-risk clarification. It must not bypass locked decisions, deferred ideas, or agent-discretion capture later in the workflow.

If `is_fast` is true and the phase has 2 or fewer gray areas total, skip `present_gray_areas` entirely and go straight to the low-risk confirmation path.
</step>
<!-- /section -->

<!-- section: present_gray_areas -->
<step name="present_gray_areas">
State the boundary:
```
Phase [X]: [Name]
Domain: [What this phase delivers]

We'll clarify HOW to implement this. (New capabilities belong in other phases.)
I'll rank the gray areas by impact so we resolve the biggest unknowns first.
```

Present the gray areas grouped by priority:
- High gray areas first
- Medium gray areas next
- Low gray areas last (unless already defaulted)

If `is_fast` is true and every gray area was already handled in `low_risk_fast_path`, skip this step and continue directly to `customer_stress_test`.

For each item, show:
- area name
- priority rank
- 1-line explanation of why it matters
- any proposed low-risk default if applicable

Use questionTemplate('discuss-gray-areas', 'SINGLE_CHOICE', {phase}):
- header: "Discuss"
- question: "How should we handle these ranked gray areas for [phase name]?"
- options should keep the flow goal explicit: work High first, then Medium, then Low only if still useful

Discussion is optional overall, but if the user engages this workflow, do not silently leave High gray areas unhandled. Every High gray area must end with an explicit disposition: Locked, Defaulted, Delegated, or Deferred.

If every gray area was safely defaulted or already locked, say so plainly and proceed directly to `customer_stress_test` instead of forcing extra turns.
</step>
<!-- /section -->

<!-- section: discuss_areas -->
<step name="discuss_areas">
Run a ranked conflict-driven clarification loop.

<skill:decision-conflict-questioning />

Work in this order:
1. High gray areas
2. Medium gray areas
3. Low gray areas that are still unresolved and still worth clarifying

Do not force literal completion of every Low gray area. Do force explicit disposition of every High gray area: resolved, defaulted intentionally, delegated intentionally, or deferred intentionally.

If the user says they want to skip discussion after seeing the ranked list, that is allowed only after all High gray areas have an explicit disposition. Medium and Low items may remain untouched if they are clearly non-blocking.

**Per area:**
1. "Let's talk about [Area] ([Priority])."
2. Check whether there is a real decision conflict worth discussing. Probe only when at least one of these is true:
   - The user's current preference conflicts with stated phase intent or requirements
   - The choice would contradict a prior decision or established product pattern
   - There are 2+ plausible implementations with materially different outcomes
   - The user gave a vague preference that hides a real tradeoff
3. If there is **no real conflict**, do not force extra questions. Record the preference and move on.
4. If there **is** a conflict, ask 1 focused question via question (header: "[Area]", max 12 chars) that:
    - names the tension explicitly ("scanability vs density", "consistency vs flexibility")
    - offers 3-4 concrete alternatives, not generic placeholders
    - includes a clear fallback such as "Agent decides" or "Defer" when reasonable
5. Use follow-ups only if the conflict is still unresolved. Follow-ups must be consequence-based, not generic "why" prompts:
   - "If we optimize for [A], what are we giving up from [B]?"
   - "Keep consistency with [prior decision], or make this an exception?"
   - "Should we lock a rule now, use a default, or leave this to agent discretion?"
6. After each resolved conflict, use questionTemplate('discuss-conflict-resolution', 'SINGLE_CHOICE') only when needed to decide whether to lock, default, defer, or delegate.
7. When the area feels resolved, use questionTemplate('discuss-socratic-continue', 'SINGLE_CHOICE') → "Keep refining" / "Next area"
   - Continuation phrases ("chat more", "keep going", "yes") → Keep refining
   - Advancement phrases ("done", "move on", "next") → Next area
   - Ambiguous → ask explicitly
8. Before leaving the High-priority set, verify there are no undispositioned High gray areas left.
9. After the ranked pass is complete: proceed to `customer_stress_test`.

**Scope creep:** "That belongs in its own phase. I'll note it as deferred. Back to [area]: [question]"

**Question design:** Trigger from conflict, not curiosity. Present strong alternatives. Stop once the tradeoff is resolved.

**Decision fidelity:** Preserve whether an outcome was explicitly locked, accepted as a default, delegated to agent discretion, or deferred. Do not collapse those into one generic "decided" bucket.

**Formalization goal:** Use the ranked loop to formalize the requirements and intent as fully as practical before planning, especially for High-impact ambiguity that would otherwise force the planner to guess.
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

Aim the sharpest challenges at High-ranked decisions and any user-visible changes with major downstream impact.

**Challenge angles:** over-engineering / future-proofing gaps / migration pain / consistency / missing basics.

**Turn discipline:** This step is interactive Q&A, not a questionnaire dump.

**Format per challenge:** State exactly one complaint in-character (1-2 sentences) → stop and wait for the user's response → accept or push back once more.

**Hard guardrails:**
- Issue exactly one challenge per assistant turn.
- Do not list upcoming challenges.
- Do not ask 3-5 questions in a single message.
- Do not summarize all challenges before the user replies.
- After each user reply, either accept the answer or push back once, then move to the next single challenge.

After 3-5 challenges:
use questionTemplate('discuss-stress-test-response', 'SINGLE_CHOICE'):
- question: "That's my grumpy user impression. Any of those points change your thinking?"
- options: "No changes — proceed" / "Changed something — check knock-on effects"

If nothing changes: proceed to write_context.

If a decision changes: proceed to `reassess_after_stress_test`.
</step>
<!-- /section -->

<!-- section: reassess_after_stress_test -->
<step name="reassess_after_stress_test">
If the stress test changed any decision, immediately do 1 bounded knock-on revalidation pass before writing context.

Open with:

```
Got it. Let's quickly validate any knock-on gray areas from that change before I write this up.
```

1. Re-scan only the impacted area(s) touched by the revised decision.
2. Look for second-order gray areas introduced by the revision:
   - new ambiguity in behavior, interaction, or structure
   - a contradiction with an earlier decision or product pattern
   - a newly important tradeoff that planners would otherwise have to guess
3. Reuse the same conflict gate from `discuss_areas`:
   - if there is no real tension, record the revised preference and move on
   - if there is real tension, ask 1 focused follow-up question with concrete alternatives
4. Keep this revalidation narrow:
   - discuss only knock-on effects of the revised decision
   - do not reopen unrelated gray areas
   - do not run another stress test after this pass
5. Record the outcome so downstream agents can distinguish:
   - original decision
   - stress-test revision
   - follow-on clarification caused by that revision

After the bounded knock-on revalidation pass: proceed to write_context.
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

<phase_intent>
## Phase Intent
- **Local Purpose:** [One concise statement of the phase-local purpose. Keep it specific to this phase, not the whole milestone.]
- **Expected User Change:** [Observable before/after claim written in plain language. Include 1-3 concrete examples that make the change provable, e.g. "Before: users had to infer the right command from generic prose. After: users see the exact canonical command and required phase argument directly in the surfaced guidance."]
- **Non-Goals:**
  - [Concrete out-of-scope example 1]
  - [Concrete out-of-scope example 2]
  - [Optional concrete out-of-scope example 3]
</phase_intent>

<domain>
## Phase Boundary
[Clear statement of what this phase delivers]
</domain>

<decisions>
## Implementation Decisions

### High-Impact Decisions
- [Gray area] — [Disposition: Locked/Defaulted/Delegated/Deferred]. [Decision and short reasoning]

### Medium Decisions
- [Gray area] — [Disposition: Locked/Defaulted/Delegated/Deferred]. [Decision and short reasoning]

### Low Defaults and Open Questions
- [Gray area] — [Disposition: Defaulted/Untouched/Deferred]. [Decision or note]

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
For each revised item, capture:
- Original decision
- Stress-test revision
- Follow-on clarification from post-stress-test reassessment (if any)
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

Lock the phase-intent block exactly to these 3 fields: `Local Purpose`, `Expected User Change`, and `Non-Goals`.

- Keep it embedded in `CONTEXT.md` — do **not** create a separate phase-intent file.
- `Expected User Change` must read like an observable before/after claim, not generic aspiration.
- `Expected User Change` must include 1-3 concrete examples that help downstream verification prove or disprove the claim.
- `Non-Goals` must include 1-3 concrete examples of tempting adjacent work that this phase is explicitly not solving.
</step>
<!-- /section -->

<!-- section: confirm_creation -->
<step name="write_durable_handoff">
Before confirm_creation or `--auto` chaining, write the durable `discuss` handoff artifact:

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state handoff write \
  --phase "${PHASE}" \
  --step discuss \
  --summary "Discuss context ready for Phase ${PHASE}" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md" \
  --next-command "/bgsd-plan research ${PHASE}"
```

This is the durable clean-start checkpoint. Same-phase restart may replace the older chain only after this new discuss handoff write succeeds.
</step>

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

`/bgsd-plan phase ${PHASE}`

<sub>`/clear` first → fresh context window</sub>

---
**Also available:**
- `/bgsd-plan phase ${PHASE} --skip-research` — plan without research
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

- Keep this as an additive fast path: `--auto`/yolo may chain into the next workflow after the workflow itself writes durable discuss handoff artifacts for the current planning inputs, but it does not replace the explicit resume-summary branch when prior handoff state is present.
- Fresh-context chaining must still begin from `discuss` when no chain state exists, because `discuss` remains the only clean-start exception.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  bGSD ► AUTO-ADVANCING TO PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Context captured. Spawning plan-phase...
```

```
Task(
  prompt="Run /bgsd-plan phase ${PHASE} --auto. Before returning, perform one lessons reflection using the existing lessons subsystem: review your full subagent-visible conversation and tool history for one durable prompt, workflow, tooling, or agent-behavior improvement; if found, capture at most one structured lesson with `bgsd-tools lessons:capture`.",
  subagent_type="general",
  description="Plan Phase ${PHASE}"
)
```

- **PLANNING COMPLETE** → plan-phase handles chaining to execute-phase
- **CHECKPOINT** → display result, stop: "Auto-advance stopped: Planning needs input. /bgsd-plan phase ${PHASE}"

**If neither `--auto` nor config:** route to `confirm_creation`.
</step>
<!-- /section -->

</process>

<!-- section: success_criteria -->
<success_criteria>
- Phase validated against roadmap
- Gray areas identified through intelligent analysis (not generic questions)
- User selected areas to discuss
- Each area questioned only when a real conflict or tradeoff exists
- Conflict questions present concrete alternatives, not generic "why" prompts
- Scope creep redirected to deferred ideas
- Customer stress test challenged decisions from real-user perspective
- Stress-test revisions trigger one focused reassessment pass for knock-on gray areas
- CONTEXT.md captures decisions with reasoning and stress-test results
- Deferred ideas preserved for future phases
- STATE.md updated with session info
- User knows next steps
</success_criteria>
<!-- /section -->
