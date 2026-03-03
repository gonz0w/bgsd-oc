<purpose>
Research how to implement a phase. Spawns gsd-phase-researcher with phase context.

Standalone research command. For most workflows, use `/bgsd-plan-phase` which integrates research automatically.
</purpose>

<process>

## Step 0: Resolve Model Profile

@__OPENCODE_CONFIG__/get-shit-done/references/model-profile-resolution.md

Resolve model for:
- `gsd-phase-researcher`

## Step 1: Normalize and Validate Phase

@__OPENCODE_CONFIG__/get-shit-done/references/phase-argument-parsing.md

```bash
PHASE_INFO=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs plan:roadmap get-phase "${PHASE}")
```

If `found` is false: Error and exit.

## Step 2: Check Existing Research

```bash
ls .planning/phases/${PHASE}-*/RESEARCH.md 2>/dev/null
```

If exists: Offer update/view/skip options.

## Step 3: Gather Phase Context

```bash
INIT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs init:phase-op "${PHASE}")
# Extract: phase_dir, padded_phase, phase_number, state_path, requirements_path, context_path
```

## Step 3.5: Collect Research Sources

Pre-collect web and YouTube sources to inject into the researcher's prompt. This step is additive — if collection fails or no tools are available, the researcher proceeds identically to before.

```bash
# If --quick flag was passed to this workflow, pass it through to skip collection
QUICK_FLAG=""
if [[ "$*" == *"--quick"* ]]; then
  QUICK_FLAG="--quick"
fi

COLLECT_OUTPUT=$(node __OPENCODE_CONFIG__/get-shit-done/bin/gsd-tools.cjs research:collect "${PHASE_DESCRIPTION}" ${QUICK_FLAG} 2>/dev/null)
```

Extract tier and agent_context from the JSON output:

```bash
TIER=$(echo "$COLLECT_OUTPUT" | jq -r '.tier // 4')
AGENT_CONTEXT=$(echo "$COLLECT_OUTPUT" | jq -r '.agent_context // ""')
```

**Conditional injection logic:**
- If `TIER < 4` AND `AGENT_CONTEXT` is non-empty: include collected sources in the `<additional_context>` block of the researcher prompt (Step 4).
- If `TIER == 4` OR `AGENT_CONTEXT` is empty: use the existing prompt unchanged. **Do NOT inject empty tags or error messages.** This ensures zero regression — the researcher works exactly as before when no tools are available.
- If `research:collect` fails entirely (command not found, JSON parse error): treat as tier 4 — no sources injected, researcher proceeds normally.

## Step 4: Spawn Researcher

```
Task(
  prompt="<objective>
Research implementation approach for Phase {phase}: {name}
</objective>

<files_to_read>
- {context_path} (USER DECISIONS from /bgsd-discuss-phase)
- {requirements_path} (Project requirements)
- {state_path} (Project decisions and history)
- .planning/INTENT.md (Project intent — objective, desired outcomes, target users. Skip if absent.)
</files_to_read>

<additional_context>
Phase description: {description}
If INTENT.md exists: scope research to align with stated project objective and desired outcomes. Prioritize findings relevant to P1 outcomes.

{If TIER < 4 AND AGENT_CONTEXT is non-empty:}
The following sources were collected automatically from web search and YouTube. Use them to ground your research findings. Cite sources by URL when referencing specific information.

{AGENT_CONTEXT}
{End if — omit this entire block when TIER == 4 or AGENT_CONTEXT is empty}
</additional_context>

<output>
Write to: .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
</output>",
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}"
)
```

## Step 5: Handle Return

- `## RESEARCH COMPLETE` — Display summary, offer: Plan/Dig deeper/Review/Done
- `## CHECKPOINT REACHED` — Present to user, spawn continuation
- `## RESEARCH INCONCLUSIVE` — Show attempts, offer: Add context/Try different mode/Manual

</process>
