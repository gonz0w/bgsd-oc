# Research Summary Template

Template for `.planning/research/SUMMARY.md` — executive summary of project research with roadmap implications.

<template>

```markdown
# Project Research Summary

**Project:** [name from PROJECT.md]
**Domain:** [inferred domain type]
**Researched:** [date]
**Confidence:** [HIGH/MEDIUM/LOW]

<!-- section: compact -->
<compact_summary>
<!-- The compact summary is the DEFAULT view for orchestrators and planners.
     Keep it under 30 lines. Synthesizes all 4 research areas.
     Full sections below are loaded on-demand via extract-sections. -->

**Summary:** [2-3 sentence overview: what was researched, primary recommendation, key risk]

**Recommended stack:** [comma-separated list of core technologies with purposes]

**Architecture:** [one-liner: primary pattern and major components]

**Top pitfalls:**
1. [Pitfall] — [how to avoid]
2. [Pitfall] — [how to avoid]
3. [Pitfall] — [how to avoid]

**Suggested phases:** [numbered list of phase names, one-liner rationale each]

**Confidence:** [overall level] | **Gaps:** [any unresolved areas]
</compact_summary>
<!-- /section -->

<!-- section: executive_summary -->
## Executive Summary

[2-3 paragraph overview of research findings]

- What type of product this is and how experts build it
- The recommended approach based on research
- Key risks and how to mitigate them
<!-- /section -->

<!-- section: key_findings -->
## Key Findings

### Recommended Stack

[Summary from STACK.md — 1-2 paragraphs]

**Core technologies:**
- [Technology]: [purpose] — [why recommended]
- [Technology]: [purpose] — [why recommended]
- [Technology]: [purpose] — [why recommended]

### Expected Features

[Summary from FEATURES.md]

**Must have (table stakes):**
- [Feature] — users expect this
- [Feature] — users expect this

**Should have (competitive):**
- [Feature] — differentiator
- [Feature] — differentiator

**Defer (v2+):**
- [Feature] — not essential for launch

### Architecture Approach

[Summary from ARCHITECTURE.md — 1 paragraph]

**Major components:**
1. [Component] — [responsibility]
2. [Component] — [responsibility]
3. [Component] — [responsibility]

### Critical Pitfalls

[Top 3-5 from PITFALLS.md]

1. **[Pitfall]** — [how to avoid]
2. **[Pitfall]** — [how to avoid]
3. **[Pitfall]** — [how to avoid]
<!-- /section -->

<!-- section: roadmap_implications -->
## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: [Name]
**Rationale:** [why this comes first based on research]
**Delivers:** [what this phase produces]
**Addresses:** [features from FEATURES.md]
**Avoids:** [pitfall from PITFALLS.md]

### Phase 2: [Name]
**Rationale:** [why this order]
**Delivers:** [what this phase produces]
**Uses:** [stack elements from STACK.md]
**Implements:** [architecture component]

### Phase 3: [Name]
**Rationale:** [why this order]
**Delivers:** [what this phase produces]

[Continue for suggested phases...]

### Phase Ordering Rationale

- [Why this order based on dependencies discovered]
- [Why this grouping based on architecture patterns]
- [How this avoids pitfalls from research]

### Research Flags

Phases likely needing deeper research during planning:
- **Phase [X]:** [reason — e.g., "complex integration, needs API research"]
- **Phase [Y]:** [reason — e.g., "niche domain, sparse documentation"]

Phases with standard patterns (skip research-phase):
- **Phase [X]:** [reason — e.g., "well-documented, established patterns"]
<!-- /section -->

<!-- section: confidence -->
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | [HIGH/MEDIUM/LOW] | [reason] |
| Features | [HIGH/MEDIUM/LOW] | [reason] |
| Architecture | [HIGH/MEDIUM/LOW] | [reason] |
| Pitfalls | [HIGH/MEDIUM/LOW] | [reason] |

**Overall confidence:** [HIGH/MEDIUM/LOW]

### Gaps to Address

[Any areas where research was inconclusive or needs validation during implementation]

- [Gap]: [how to handle during planning/execution]
- [Gap]: [how to handle during planning/execution]
<!-- /section -->

<!-- section: sources -->
## Sources

### Primary (HIGH confidence)
- [Context7 library ID] — [topics]
- [Official docs URL] — [what was checked]

### Secondary (MEDIUM confidence)
- [Source] — [finding]

### Tertiary (LOW confidence)
- [Source] — [finding, needs validation]

---
*Research completed: [date]*
*Ready for roadmap: yes*
```

</template>

<guidelines>

**Executive Summary:**
- Write for someone who will only read this section
- Include the key recommendation and main risk
- 2-3 paragraphs maximum

**Key Findings:**
- Summarize, don't duplicate full documents
- Link to detailed docs (STACK.md, FEATURES.md, etc.)
- Focus on what matters for roadmap decisions

**Implications for Roadmap:**
- This is the most important section
- Directly informs roadmap creation
- Be explicit about phase suggestions and rationale
- Include research flags for each suggested phase

**Confidence Assessment:**
- Be honest about uncertainty
- Note gaps that need resolution during planning
- HIGH = verified with official sources
- MEDIUM = community consensus, multiple sources agree
- LOW = single source or inference

**Integration with roadmap creation:**
- This file is loaded as context during roadmap creation
- Phase suggestions here become starting point for roadmap
- Research flags inform phase planning

</guidelines>
