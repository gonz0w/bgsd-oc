---
phase: "98"
name: "NL Foundation"
created: 2026-03-11
---

# Phase 98: NL Foundation — Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Foundation layer for natural language CLI input parsing. This phase delivers:
- Intent classification — parse input into command types (plan, execute, verify, query)
- Parameter extraction — pull phase numbers, flags, targets from loose descriptions
- Smart alias resolution — map natural phrases to commands via fuzzy matching
- Fallback help — contextual suggestions when input is unclear

This is the foundation that subsequent phases (99+) will build upon for conversational planning and multi-intent detection.

</domain>

<decisions>
## Implementation Decisions

### Fuzzy Matching Threshold
- **Setting:** 0.4 (moderate)
- **Why:** Balances typo tolerance with avoiding false positives
- **Agent's Discretion:** Fine-tune based on user testing

### Disambiguation Strategy
- **Behavior:** Show choices when confidence < 0.8
- **UI:** Present top 2-3 matches with descriptions, let user choose
- **Agent's Discretion:** Exact prompt wording, formatting (list vs. numbered)

### Alias Priority
- **Order:** Short aliases take priority (backward compatibility)
- **Implementation:** Check `jr` map first, then natural language phrases
- **Why:** Existing `p` → `plan`, `e` → `execute` must keep working

### Learning System
- **Decision:** No learning (stateless)
- **Why:** Simpler implementation, no storage complexity
- **Agent's Discretion:** None — this is locked

### Core Libraries
- **Fuse.js** ^7.x — fuzzy string matching
- **commander** ^11.x — CLI parsing (already in use)

### Architecture Approach
- **Extend, don't replace** — build NL layer on top of existing alias system
- **Lazy load** — fuzzy resolver loads on-demand, not at startup
- **Agent's Discretion:** Exact file structure, internal function names

</decisions>

<specifics>
## Specific Ideas

**Key constraints from requirements:**
- NL-01: Intent classification (plan, execute, verify, query)
- NL-02: Parameter extraction (phase numbers, flags, targets)
- NL-03: Smart alias resolution with fuzzy matching
- NL-04: Fallback help with contextual suggestions

**Known edge cases to handle:**
- "run" — could mean execute, start server, or run tests
- Phase number ambiguity — "phase 5" vs standalone "5"
- Partial commands — "plan" without phase number

</specifics>

<deferred>
## Deferred Ideas

- Learning from user corrections (NL-04) — disabled, no learning system
- Multi-intent detection (NL-06) — deferred to phase 99
- Conversational planning (NL-05) — deferred to phase 99

</deferred>

---

*Phase: 98-nl-foundation*
*Context gathered: 2026-03-11*
