# Phase 135: Workflow Compression & Section Markers - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Prose-tighten the top 10 highest-traffic workflows, add section markers for selective loading, and extract shared blocks to skill references. All changes verified against the Phase 134 baseline. No behavioral changes — workflows must produce identical agent behavior post-compression.

</domain>

<decisions>
## Implementation Decisions

### Compression Approach
- **Style:** Concise but readable — shorter sentences, fewer filler words, but still natural language. Not telegraphic.
- **Motivation:** Agent comprehension is the primary concern. Precautionary — no observed failures with terse instructions, but workflows are complex enough to hedge.
- **Examples:** Trim aggressively — keep 1 example per concept, cut the rest. Examples are the biggest token cost.
- **Philosophy/purpose sections:** Compress lightly — remove filler but keep core mental model statements. Lighter touch than step-level compression.
- **Execution:** Single sweep — compress all 10 workflows, then measure. No iterative batching.
- **File strategy:** Modify in-place. Git diff against Phase 134 baseline commit provides comparison.
- **Markup format:** Keep existing XML structure (`<step>`, `<purpose>`, etc.). XML has no agent comprehension advantage over markdown, but it works and isn't broken.
- **Step merging:** Merge where obvious — tiny sequential steps with no branching can be combined. Don't restructure complex flows.
- **Target:** 40% average token reduction is aspirational guidance, not a hard gate. Compress naturally following "concise but readable" style, measure results, accept what readable compression yields.

### Section Marker Design
- **Format:** Existing `<step name="X">` XML tags ARE the section markers. No separate `<!-- section: X -->` comments — avoids redundancy and prevents drift from dual systems.
- **Granularity:** Step-level only. ~~Sub-step markers~~ deferred to Phase 137 when the loader actually needs them (YAGNI — revised during stress test).
- **Non-step content:** All top-level blocks (`<purpose>`, `<philosophy>`, `<scope_guardrail>`, etc.) are loadable sections, but preamble sections always load — they set the agent's mental model and are not candidates for elision (revised during stress test).
- **Unstructured workflows:** If a workflow in the top 10 lacks clear `<step>` structure, restructure it during compression to have consistent section markers.
- **Verification tool:** `workflow:verify-structure` needs to be built in this phase (does not exist from Phase 134). Full structural check: markers exist, names are consistent, every step has one, valid sequence.

### Shared Block Extraction
- **Threshold:** 3+ workflows with clearly duplicated blocks (exact or near-exact). ~~Semantic matching~~ scaled back to obvious duplicates only — semantic unification is a separate future effort (revised during stress test).
- **Storage:** Extracted blocks go into the existing `skills/` directory as standard skills.
- **Loading mechanism:** Agent loads on-demand via the existing skill tool when the workflow instructs it. No enricher changes needed — no `<skill:X />` pre-injection (revised during stress test). This means extracted content is only loaded when/if the agent reaches that step — real token savings.
- **Scope:** Named three (deviation rules, commit protocol, checkpoint format) plus any other clearly duplicated blocks found during compression. Proactive discovery allowed but only for obvious duplicates.
- **Identity:** Once extracted, a skill is a skill. No origin tracking or manifest needed.

### Preservation Guarantees
- **Hard constraint:** Structure always wins over compression. Every CLI command, Task() call, question tool call, and branch marker survives compression. No exceptions.
- **Reason:** Agents parse and execute specific CLI commands and Task() patterns from workflow text. Changing them breaks execution.
- **Code blocks:** Context-dependent — commands in process steps are structural (preserved). Commands in example blocks are compressible (illustrative). This aligns with "trim examples aggressively."
- **Verification:** `workflow:verify-structure` counts CLI commands, Task() calls, question calls, and branch markers. All counts must match pre-compression baseline.

### Agent's Discretion
- Sub-step marker format (when Phase 137 adds them)
- Which specific steps to merge during compression
- How to restructure unstructured workflows into consistent section format

</decisions>

<specifics>
## Specific Ideas

- The top 10 workflows are: discuss-phase, execute-phase, new-milestone, execute-plan, transition, new-project, audit-milestone, quick, resume-project, map-codebase
- Phase 134 delivered `workflow:baseline` and `workflow:compare` commands — use these for measurement
- `workflow:verify-structure` must be built as a new CLI command in this phase
- Some skills already exist (deviation-rules, commit-protocol) — workflows referencing those blocks should instruct agents to load the existing skills rather than creating new ones
- Git diff against the Phase 134 baseline commit is the A/B comparison mechanism

</specifics>

<stress_tested>
## Stress-Tested Decisions

The following decisions were revised during the customer stress test:

1. **Sub-step markers dropped** — Originally planned sub-step markers within large steps. Revised to step-level only (YAGNI). Phase 137 can add sub-step markers when the loader actually needs them.

2. **Semantic extraction scaled back** — Originally planned semantic matching across workflows. Revised to obvious/exact duplicates only. Semantic unification is a separate future effort to avoid scope creep.

3. **Enricher changes dropped** — Originally planned to build `<skill:X />` expansion in the enricher. Revised to agent-loads-on-demand via existing skill tool. No enricher infrastructure changes needed in this phase.

4. **40% target softened** — Originally a hard success criterion. Revised to aspirational guidance — compress naturally, measure results, accept what readable compression yields.

5. **Preamble always loads** — Originally all sections were skippable. Revised: preamble sections (purpose, philosophy, guardrails) always load since they set the agent's mental model. Not candidates for Phase 137 elision.

</stress_tested>

<deferred>
## Deferred Ideas

- Sub-step markers within large steps — Phase 137 when loader needs them
- Semantic unification of similar-but-different shared blocks — future optimization pass
- Enricher-level `<skill:X />` pre-injection — Phase 137 or later if on-demand loading proves insufficient

</deferred>

---

*Phase: 135-workflow-compression*
*Context gathered: 2026-03-16*
