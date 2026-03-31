---
name: decision-conflict-questioning
description: Conflict-driven clarification for phase discussions — only question when intent, requirements, prior decisions, or tradeoffs are in tension, and present concrete alternatives instead of generic why-prompts.
type: shared
agents: [planner, roadmapper, orchestrator]
sections: [trigger-gate, conflict-types, question-patterns, stop-rules, anti-patterns]
---

## Purpose

Phase discussion is not open-ended discovery. Its job is to resolve implementation tensions that would change the result for downstream planning and execution.

## Content

<!-- section: trigger-gate -->
### Trigger Gate

Ask a decision question only when a meaningful conflict exists. Good triggers:

- Intent and current preference point in different directions
- Requirements or phase boundary leave multiple plausible interpretations
- A proposed choice conflicts with a prior decision, existing pattern, or product consistency
- Two or more implementation directions would produce materially different outcomes

If none of these are true, record the preference and move on.
<!-- /section -->

<!-- section: conflict-types -->
### Conflict Types

Name the tension explicitly before asking:

- **Intent conflict** — "You want speed here, but the phase goal emphasizes reliability"
- **Requirement conflict** — "The requirement suggests X, but this choice leans toward Y"
- **Prior-decision conflict** — "Earlier we favored consistency; this would be a special case"
- **Tradeoff conflict** — "This is really scanability vs density"

The user should be reacting to a framed tradeoff, not inventing one from scratch.
<!-- /section -->

<!-- section: question-patterns -->
### Question Patterns

Lead with a brief observation, then give 3-4 concrete alternatives.

Recommended pattern:

1. State the tension in one sentence
2. Offer concrete alternatives with different strengths
3. Include a fallback such as `Agent decides` or `Defer` when reasonable

Useful follow-ups:

- "Which tradeoff matters more here?"
- "If we optimize for A, what are we willing to give up from B?"
- "Keep consistency with the earlier decision, or make this an exception?"
- "Should we lock a rule now, use a default, or leave this to agent discretion?"

Avoid generic "why?" unless you are unpacking a specific contradiction.
<!-- /section -->

<!-- section: stop-rules -->
### Stop Rules

Stop questioning when any of these are true:

- The tradeoff is resolved clearly enough for planners to act
- The user explicitly delegates the choice to the agent
- The question would now be repeating the same tension in different words
- More probing would drift into new scope instead of clarifying the current phase

One good conflict question is better than four shallow follow-ups.
<!-- /section -->

<!-- section: anti-patterns -->
### Anti-Patterns

- **Generic why-loop** — repeatedly asking "why" without surfacing a concrete conflict
- **Curiosity without stakes** — probing preferences that do not change implementation
- **False tension** — manufacturing a tradeoff when there is a clear default
- **Option dumping** — listing many weak choices instead of a few meaningful alternatives
- **Interrogation** — making the user defend a preference rather than react to a framed decision
<!-- /section -->
