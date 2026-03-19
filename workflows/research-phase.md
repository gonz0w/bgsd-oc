<purpose>
Research how to implement a phase. Spawns bgsd-phase-researcher with phase context.

Standalone research command. For most workflows, use `/bgsd-plan-phase` which integrates research automatically.
</purpose>

<process>

## Step 0: Resolve Model Profile

@__OPENCODE_CONFIG__/bgsd-oc/references/model-profile-resolution.md

Resolve model for:
- `bgsd-phase-researcher`

## Step 1: Normalize and Validate Phase

<skill:phase-argument-parsing />

Extract `PHASE` from `$ARGUMENTS` (first non-flag token). **Phase number is required.** If no phase number provided:
```
ERROR: Phase number required.
Usage: /bgsd-research-phase <phase-number>
Example: /bgsd-research-phase 92
Use /bgsd-progress to see available phases.
```
Exit.

```bash
PHASE_INFO=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:roadmap get-phase "${PHASE}")
```

If `found` is false: Error and exit.
If `found` is true: Extract `phase_number`, `phase_name`, `goal` from JSON.

## Step 2: Check Existing Research

```bash
ls .planning/phases/${PHASE}-*/RESEARCH.md 2>/dev/null
```

If exists: Offer: 1) Update research, 2) View existing, 3) Skip. Wait for response.
If doesn't exist: Continue.

## Step 3: Gather Phase Context

**Context:** This workflow receives project context via `<bgsd-context>` auto-injected by the bGSD plugin's `command.execute.before` hook. If no `<bgsd-context>` block is present, the plugin is not loaded.

**If no `<bgsd-context>` found:** Stop and tell the user: "bGSD plugin required for v9.0. Install with: npx bgsd-oc"

Extract from `<bgsd-context>` JSON: `phase_dir`, `padded_phase`, `phase_number`, `commit_docs`, `state_path`, `requirements_path`, `context_path`, `research_path`.

Use paths from `<bgsd-context>` (do not inline file contents in orchestrator context):
- `requirements_path`
- `context_path`
- `state_path`

Present summary with phase description and what files the researcher will load.

## Step 3.5: Collect Research Sources

Pre-collect web and YouTube sources to inject into the researcher's prompt. This step is additive — if collection fails or no tools are available, the researcher proceeds identically to before.

```bash
# If --quick flag was passed to this workflow, pass it through to skip collection
QUICK_FLAG=""
if [[ "$*" == *"--quick"* ]]; then
  QUICK_FLAG="--quick"
fi

COLLECT_OUTPUT=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs research:collect "${PHASE_DESCRIPTION}" ${QUICK_FLAG} 2>/dev/null)
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

**Tier 1 note:** At Tier 1 (Full RAG — all tools available), `agent_context` includes `<nlm_synthesis>` with NotebookLM-grounded analysis alongside raw sources. The existing conditional injection (`if TIER < 4 AND AGENT_CONTEXT is non-empty`) already handles Tier 1 output — the synthesis block appears before raw sources so the researcher sees grounded analysis first, then raw sources for verification. When NotebookLM is unavailable or auth fails, the pipeline falls back silently to Tier 2 (sources without synthesis).

## Step 4: Spawn Researcher

Research modes: ecosystem (default), feasibility, implementation, comparison.

```
Task(
  prompt="<research_type>
Phase Research — investigating HOW to implement a specific phase well.
</research_type>

<key_insight>
The question is NOT 'which library should I use?'

The question is: 'What do I not know that I don't know?'

For this phase, discover:
- What's the established architecture pattern?
- What libraries form the standard stack?
- What problems do people commonly hit?
- What's SOTA vs what the agent's training thinks is SOTA?
- What should NOT be hand-rolled?
</key_insight>

<objective>
Research implementation approach for Phase {phase_number}: {phase_name}
Mode: ecosystem
</objective>

<files_to_read>
- {requirements_path} (Requirements)
- {context_path} (Phase context from discuss-phase, if exists)
- {state_path} (Prior project decisions and blockers)
- .planning/INTENT.md (Project intent — objective, desired outcomes, target users. Skip if absent.)
</files_to_read>

<additional_context>
**Phase description:** {phase_description}
If INTENT.md exists: scope research to align with stated project objective and desired outcomes. Prioritize findings relevant to P1 outcomes.

{If TIER < 4 AND AGENT_CONTEXT is non-empty:}
The following sources were collected automatically from web search and YouTube. Use them to ground your research findings. Cite sources by URL when referencing specific information.

{AGENT_CONTEXT}
{End if — omit this entire block when TIER == 4 or AGENT_CONTEXT is empty}
</additional_context>

<downstream_consumer>
Your RESEARCH.md will be loaded by `/bgsd-plan-phase` which uses specific sections:
- `## Standard Stack` → Plans use these libraries
- `## Architecture Patterns` → Task structure follows these
- `## Don't Hand-Roll` → Tasks NEVER build custom solutions for listed problems
- `## Common Pitfalls` → Verification steps check for these
- `## Code Examples` → Task actions reference these patterns

Be prescriptive, not exploratory. 'Use X' not 'Consider X or Y.'
</downstream_consumer>

<quality_gate>
Before declaring complete, verify:
- [ ] All domains investigated (not just some)
- [ ] Negative claims verified with official docs
- [ ] Multiple sources for critical claims
- [ ] Confidence levels assigned honestly
- [ ] Section names match what plan-phase expects
</quality_gate>

<output>
Write to: .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
</output>",
  subagent_type="bgsd-phase-researcher",
  model="{researcher_model}",
  description="Research Phase {phase}"
)
```

## Step 5: Handle Agent Return

**`## RESEARCH COMPLETE`:** Display summary, offer: Plan phase, Dig deeper, Review full, Done.

**`## CHECKPOINT REACHED`:** Present to user, get response, spawn continuation.

**`## RESEARCH INCONCLUSIVE`:** Show what was attempted, offer: Add context, Try different mode, Manual.

## Step 6: Spawn Continuation Agent

```markdown
<objective>
Continue research for Phase {phase_number}: {phase_name}
</objective>

<prior_state>
<files_to_read>
- .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md (Existing research)
</files_to_read>
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>
```

```
Task(
  prompt="First, read __OPENCODE_CONFIG__/agents/bgsd-phase-researcher.md for your role and instructions.\n\n" + continuation_prompt,
  subagent_type="general",
  model="{researcher_model}",
  description="Continue research Phase {phase}"
)
```

</process>

<success_criteria>
- [ ] Phase validated against roadmap
- [ ] Existing research checked
- [ ] bgsd-phase-researcher spawned with context
- [ ] Checkpoints handled correctly
- [ ] User knows next steps
</success_criteria>
