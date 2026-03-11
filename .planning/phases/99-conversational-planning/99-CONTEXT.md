---
phase: "99"
name: "Conversational Planning"
depends_on: "98"
created: "2026-03-11"
---

# Phase 99: Conversational Planning — Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Conversational planning layer that converts natural language goals into structured plans with contextual awareness. This phase delivers:
- Goal description to structured plan conversion
- Multi-intent detection and sequencing
- Contextual next-action suggestions

Builds on Phase 98 NL Foundation.

</domain>

<decisions>
## Implementation Decisions

### Requirement Extraction (NL-05)
- **Approach:** Ask clarifying questions
- **Why:** Natural language descriptions are ambiguous; need user validation
- **Agent's Discretion:** Exact question wording, number of questions per interaction

### Multi-Intent Sequencing (NL-06)
- **Behavior:** Auto-sequence with subagents (no context clearing)
- **Why:** Seamless pipeline, maintain context across intents
- **Checkpoint:** Between intents if user confirmation needed
- **Agent's Discretion:** Exact checkpoint wording, when to prompt

### Suggestion Logic (NL-07)
- **Trigger:** Command type just executed
- **Examples:**
  - After `plan` → suggest `exec phase`
  - After `exec` → suggest `verify phase`
  - After `verify` → suggest next phase or `milestone complete`
- **Agent's Discretion:** Suggestion wording, formatting, max suggestions

### Scope (NL-05, NL-06, NL-07)
- **Coverage:** Where it makes sense for end-to-end workflow
- **Commands in scope:** plan, exec, verify, session, milestone commands
- **Agent's Discretion:** Which specific commands get suggestions

</decisions>

<specifics>
## Specific Ideas

**Key constraints from requirements:**
- NL-05: Conversational planning with clarifying questions
- NL-06: Multi-intent detection and sequencing
- NL-07: Contextual suggestions by command type

**Known edge cases to handle:**
- "plan and execute" — both intents without phase number
- Chain of 3+ intents — "plan, execute, and verify phase 5"
- No suggestion if no logical next command

</specifics>

<deferred>
## Deferred Ideas

- Learning from user corrections — disabled, no learning system
- Cross-session memory — stateless suggestions only

</deferred>

---

*Phase: 99-conversational-planning*
*Context gathered: 2026-03-11*
