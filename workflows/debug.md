<purpose>
Debug issues using scientific method with subagent isolation.

Standalone debug command. Gathers symptoms, spawns bgsd-debugger, handles checkpoints and continuations.
</purpose>

<process>

## 0. Initialize Context

```bash
INIT=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state load)
```

Extract `commit_docs` from init JSON. Resolve debugger model:

**Pre-computed value:** If `executor_model` exists in `<bgsd-context>`, use it as `DEBUGGER_MODEL`. Skip subprocess call below.

**Fallback** (if not available in context):
```bash
DEBUGGER_MODEL=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:resolve-model bgsd-debugger --raw)
```

## 1. Check Active Sessions

If active sessions exist AND no $ARGUMENTS:
- List sessions with status, hypothesis, next action
- User picks number to resume OR describes new issue

If $ARGUMENTS provided OR user describes new issue:
- Continue to symptom gathering

## 2. Gather Symptoms (if new issue)

Use question for each:

1. **Expected behavior** - What should happen?
2. **Actual behavior** - What happens instead?
3. **Error messages** - Any errors? (paste or describe)
4. **Timeline** - When did this start? Ever worked?
5. **Reproduction** - How do you trigger it?

After all gathered, confirm ready to investigate.

## 3. Spawn bgsd-debugger Agent

Fill prompt and spawn:

```markdown
<objective>
Investigate issue: {slug}

**Summary:** {trigger}
</objective>

<symptoms>
expected: {expected}
actual: {actual}
errors: {errors}
reproduction: {reproduction}
timeline: {timeline}
</symptoms>

<mode>
symptoms_prefilled: true
goal: find_and_fix
</mode>

<debug_file>
Create: .planning/debug/{slug}.md
</debug_file>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="bgsd-debugger",
  model="{debugger_model}",
  description="Debug {slug}"
)
```

## 4. Handle Agent Return

**Pre-computed decision:** If `decisions.debug-handler-route` exists in `<bgsd-context>`, use its `.value` as a suggestion for which return handler to use (MEDIUM confidence — LLM may override based on actual agent output). Skip agent return type interpretation below.

**Fallback** (if decisions not available):

**If `## ROOT CAUSE FOUND`:**
- Display root cause and evidence summary
- Offer options:
  - "Fix now" - spawn fix subagent
  - "Plan fix" - suggest /bgsd-plan-phase --gaps
  - "Manual fix" - done

**If `## CHECKPOINT REACHED`:**
- Present checkpoint details to user
- Get user response
- Spawn continuation agent (see step 5)

**If `## INVESTIGATION INCONCLUSIVE`:**
- Show what was checked and eliminated
- Offer options:
  - "Continue investigating" - spawn new agent with additional context
  - "Manual investigation" - done
  - "Add more context" - gather more symptoms, spawn again

## 5. Spawn Continuation Agent (After Checkpoint)

When user responds to checkpoint, spawn fresh agent:

```markdown
<objective>
Continue debugging {slug}. Evidence is in the debug file.
</objective>

<prior_state>
<files_to_read>
- .planning/debug/{slug}.md (Debug session state)
</files_to_read>
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>

<mode>
goal: find_and_fix
</mode>
```

```
Task(
  prompt=continuation_prompt,
  subagent_type="bgsd-debugger",
  model="{debugger_model}",
  description="Continue debug {slug}"
)
```

</process>

<success_criteria>
- [ ] Active sessions checked
- [ ] Symptoms gathered (if new)
- [ ] bgsd-debugger spawned with context
- [ ] Checkpoints handled correctly
- [ ] Root cause confirmed before fixing
</success_criteria>
