# Pitfalls Research

**Domain:** Question Design Patterns for AI Agent Workflows
**Researched:** 2026-03-19
**Confidence:** HIGH

<!-- section: compact -->
<pitfalls_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Top pitfalls:**
1. **Vague open-ended questions** — Always add goal+context+specificity (Phase 1)
2. **Option cueing bias** — Correct answer gets longest/detailed; vary option style (Phase 1)
3. **Poor distractor quality** — Wrong options sound plausible to non-experts (Phase 1)
4. **No option taxonomy** — Use single-select vs multi-select based on decision type (Phase 1)
5. **Leading/biased framing** — Neutral language; don't embed assumptions (Phase 1)

**Tech debt traps:** Hardcoding option sets; skipping Bloom's taxonomy levels; no A/B testing

**Security risks:** Option injection via user-controlled text; context poisoning in options

**"Looks done but isn't" checks:**
- Options: verify mutually exclusive, exhaustive, no cueing
- Questions: verify goal+context+level+specificity+actionability
- Taxonomy: verify question type matches decision nature
</pitfalls_compact>
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

### Pitfall 1: Vague Open-Ended Questions

**What goes wrong:**
Agents ask bare questions like "What should we do next?" or "Any thoughts?" that produce generic, unhelpful responses. Users (or the AI operating on behalf of users) receive wide-ranging advice with no clear basis for choosing among options.

**Why it happens:**
Open-ended feels collaborative and low-friction. Designers worry that constraining options feels robotic. The assumption is that open questions gather more information—but they actually gather less useful information.

**How to avoid:**
Apply the QuestionCraft formula: goal clarity + relevant context + cognitive level + specificity + actionability. Every question should include "...so that I can [specific outcome]".

**Warning signs:**
- Question contains "help me", "thoughts", "anything else"
- No format/length/tone constraints specified
- Question could be answered with a shrug

**Phase to address:**
Phase 1 — Taxonomy and option generation patterns must require goal+context+options from the start

---

### Pitfall 2: Option Cueing Bias in Multiple Choice

**What goes wrong:**
The "correct" answer (or most desirable option) is visibly different from the distractors: longer, more detailed, more qualified, more precise. Users (human or AI) learn to identify the best answer by formatting rather than content.

**Why it happens:**
LLMs and humans alike tend to make correct answers thorough and precise while making wrong answers short and vague. This is natural but produces useless questions—anyone who knows the topic already knows which option is right.

**How to avoid:**
Apply formatting parity: all options should be roughly same length, same grammatical structure, same level of detail. Use a constraint like "each option must fit on one line under 20 words."

**Warning signs:**
- One option is noticeably longer than others
- One option uses more precise language while others are fuzzy
- Options have different grammatical structures

**Phase to address:**
Phase 1 — Option generation guidelines must enforce formatting parity

---

### Pitfall 3: Poor Distractor Quality

**What goes wrong:**
Wrong options (distractors) are obviously wrong, irrelevant, or implausible to anyone with domain knowledge. The question becomes trivial to answer, failing to distinguish between those who understand and those who don't.

**Why it happens:**
Generating plausible distractors is harder than generating obviously wrong ones. It requires understanding what misconceptions actually exist and what wrong answers sound credible to non-experts.

**How to avoid:**
For each distractor, verify: would a person without expertise consider this plausible? Use common misconceptions as distractors, not random errors. Include at least one distractor that is "almost correct" (contains a grain of truth).

**Warning signs:**
- Distractors are nonsense or obviously irrelevant
- Distractors are all the same "type" of wrong
- No distractor is close to the correct answer

**Phase to address:**
Phase 1 — Option generation patterns must include distractor quality criteria

---

### Pitfall 4: No Question Taxonomy for Decision Types

**What goes wrong:**
Single-select questions are used where multi-select is appropriate (or vice versa). Users either feel forced to choose one when multiple apply, or must rank-order when a simple yes/no would suffice. The question shape doesn't fit the decision shape.

**Why it happens:**
No framework for matching question type to decision nature. One-size-fits-all "provide options" instruction produces inconsistent question shapes.

**How to avoid:**
Define a taxonomy:
- **Single-select**: Mutually exclusive choices, exactly one applies
- **Multi-select**: Multiple options may apply, any combination valid
- **Yes/No + rationale**: Binary choice where reasoning matters
- **Ranked/priority**: Order matters, not just selection
- **Open-ended with guardrails**: When options genuinely can't be enumerated

**Warning signs:**
- Users select "all of the above" or "depends"
- Question asks "which is best" but multiple could apply
- Options overlap or aren't clearly distinct

**Phase to address:**
Phase 1 — Taxonomy definition is prerequisite for curated option sets

---

### Pitfall 5: Leading and Biased Question Framing

**What goes wrong:**
Question wording subtly steers toward a particular answer. Options are not balanced. The "correct" answer is implied by question construction. Users may not even realize the bias—they just feel the question is "off."

**Why it happens:**
Questions are written by people who already know the answer. Unconscious bias creeps in through framing, option ordering, and implied judgments. Positive vs. negative framing of the same question produces different responses.

**How to avoid:**
Use neutral language throughout. Apply the "opposite day" test: if you flipped the question, would the same answer still be best? Randomize option order across question variations. Have someone who doesn't know the answer review for bias.

**Warning signs:**
- Options are not parallel in construction
- Question uses loaded language ("clearly", "obviously", "surely")
- One option is framed positively, others negatively
- Option ordering correlates with desirability

**Phase to address:**
Phase 1 — Bias detection is part of option set curation process
<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding 3-5 options per question | Simple, consistent | Brittle when context changes; doesn't scale | Never for agent-facing options |
| Copy-paste option sets between workflows | Fast initial implementation | Option drift; no single source of truth | Only for identical decision types in same workflow |
| Skipping Bloom's taxonomy levels | Faster question writing | Questions cluster at Remember/Understand; no deeper reasoning | Never — agents need Evaluate/Create level questions |
| Using AI to generate options with no review | Zero manual effort | Cueing bias, implausible distractors, surface-level options | Only after human review pass added |
| One option set for all phases | Simpler prompts | Doesn't match phase-specific decision complexity | Never — phase complexity varies |
| No A/B testing for option phrasing | Saves time upfront | No way to know which options perform better | Only for low-stakes, infrequent questions |
<!-- /section -->

<!-- section: integration -->
## Integration Gotchas

Common mistakes when connecting question design to agent orchestration.

| Integration | Common Mistake | Correct Approach |
|------------|----------------|------------------|
| Agent prompts | Not instructing to generate options before asking | Explicit prompt instruction: "Before asking, generate 3-5 options" |
| Workflow markdown | Options hardcoded in workflow text | Option generation logic in agent prompts, not static text |
| State transitions | No validation that selected option is valid | Validate option exists in defined set before state change |
| Context injection | Options don't reflect current session context | Options must be regenerated per-session, not cached |
| Human-in-loop | Asking open-ended at decision points requiring options | Checkpoint type must match question type |
<!-- /section -->

<!-- section: performance -->
## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Option generation on every turn | Token bloat; slow responses | Cache stable options; regenerate only when context changes | >10 options per question or >50 questions per session |
| Full option set enumeration in prompts | Prompt size growth | Section markers; selective option loading | >20 questions in conversation |
| No option prioritization | Overwhelming用户在选择时感到困惑，不知道哪个优先考虑 | Option ranking by likely utility before presenting | >7 options (Miller's law) |
| Regenerating options without invalidation | Stale options after context shift | Track what context elements affect options; invalidate on change | Multi-session workflows |
| Verbose options for every question | High token cost per question | Compress options to essential differentiators only | High-frequency questioning (>20/minute) |
<!-- /section -->

<!-- section: security -->
## Security Mistakes

Domain-specific security issues beyond general concerns.

| Mistake | Risk | Prevention |
|---------|------|------------|
| User text injected into option generation | Prompt injection via option text | Never let user content become option text without sanitization |
| Options reflecting internal state exposed | Context poisoning; information leakage | Options are agent-generated, not user-influenced, for sensitive decisions |
| Option selection logged without sanitization | Decision records contain injection payloads | Sanitize all option text before storage in decisions/trajectories |
| Blind trust in option enumeration | Agent manipulated via option list | Options are guidance, not binding — retain override capability |
| No rate limiting on option regeneration | Token exhaustion via rapid regeneration | Debounce regeneration; cache with TTL |
<!-- /section -->

<!-- section: ux -->
## UX Pitfalls

Common user experience mistakes in question design.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "I don't understand" fallback | Users stuck without recovery path | Specific error messages with suggested next actions |
| No option for "none apply" | Forces arbitrary selection | Always include escape hatch: "none of these", "other", "cancel" |
| Asking multiple questions at once | Cognitive overload; shallow answers to each | One question, one clear goal; separate if genuinely independent |
| Options presented without context | User doesn't know why they're choosing | Brief context line before options: "Given [relevant context], choose..." |
| No confirmation after selection | Uncertainty about what was selected | Confirm: "You selected [X]. Proceeding..." |
| Options too similar to distinguish | Choice paralysis or random selection | Ensure options are clearly differentiated; add qualifiers if needed |
| Wrong question type for decision | Frustration when answer doesn't fit | Match question type to decision: single/multi/rank/binary |
<!-- /section -->

<!-- section: looks_done -->
## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Option sets:** Often missing formatting parity between options — verify each option is ~same length and structure
- [ ] **Distractors:** Often implausible rather than "almost correct" — verify each distractor could fool a non-expert
- [ ] **Taxonomy:** Often applied at generation time but not validated at check time — verify question type matches decision type
- [ ] **Bloom's level:** Often stuck at Remember/Understand — verify questions reach Analyze/Evaluate for agent decisions
- [ ] **Option count:** Often arbitrary (3-5) without justification — verify count based on decision complexity
- [ ] **Escape hatches:** Often missing "none of these" / "other" — verify every multi-select has a way out
- [ ] **Context injection:** Often static options when context should affect options — verify options regenerated per session
- [ ] **Confirmation:** Often missing after selection — verify agent confirms before acting on choice
<!-- /section -->

<!-- section: recovery -->
## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Vague open-ended question asked | LOW | Follow up with "To help you better, I need [specific context]. What is your [specific parameter]?" |
| Cueing bias in options | MEDIUM | Regenerate with formatting constraints; have human review parity |
| Poor distractors identified | LOW | Mark distractor as low-quality; use remaining valid options |
| Wrong question type used | MEDIUM | Re-ask with correct type; invalidate previous response |
| Leading framing identified | MEDIUM | Rewrite with neutral language; re-generate options |
| Options causing decision paralysis | LOW | Add prioritization criteria; reduce to top-3 by stated criteria |
| Stale options after context shift | LOW | Invalidate cache; regenerate options for current context |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Vague open-ended questions | Phase 1: Taxonomy + patterns | Prompt templates enforce goal+context+options |
| Option cueing bias | Phase 1: Option generation guidelines | Option audit checklist before publishing |
| Poor distractor quality | Phase 1: Option generation guidelines | Distractor plausibility test |
| No question taxonomy | Phase 1: Taxonomy definition | Decision type → question type mapping validated |
| Leading/bias framing | Phase 1: Option set curation | Neutral language review; "opposite day" test |
| Hardcoded option sets | Phase 2: Curated option sets | Option sets parameterized by context |
| No A/B testing infrastructure | Phase 3: Integration + testing | Track option selection rates; iterate |
| Token bloat from options | Phase 3: Performance optimization | Measure token cost per question; enforce budgets |
| Security: injection via options | Phase 1: Security review | Sanitize user text; never embed unsanitized |
| UX: no escape hatches | Phase 1: UX guidelines | Every multi-select includes "none/other" |
<!-- /section -->

<!-- section: sources -->
## Sources

- QuestionCraft "Ultimate Guide to Asking Better Questions in the AI Age" (2025) — 60+ years questioning research synthesis
- PMC "Pitfalls of multiple-choice questions in generative AI and medical education" (2024) — MCQ format risks, 39% performance drop on free-response
- AI4VET4AI "AI Chatbots Are Terrible at Creating Multiple-Choice Questions" — Distractor quality, Bloom's taxonomy levels, cueing bias
- Kadence "Bad Survey Questions and How to Avoid Them" — Leading questions, double-barreled, complex questions
- Attest "Mastering Multiple Choice Survey Questions" — Option design, mutual exclusivity, balance
- Chaos and Order "Chatbot Conversation Design Guide" (2026) — Anti-patterns: overconfident bot, personality whiplash, false promise
- MooseBase "Conversation Design Guide" — Opening greetings, question routing, option-based vs open-ended
- NeuronUX "UX Design Best Practices for Conversational AI" — Transparency, context memory, escalation
- Jotform "Chatbot Best Practices" — Quick replies, error handling, mobile-first
- Noform "AI Chatbot Best Practices" — Conversation starters, personality, natural flow
- Azure AI "Custom Question Answering Best Practices" — Question-answer pair design, alternate questions
- Quiq "Five Pitfalls Your AI Agent Will Most Likely Face" — Hallucination, measurement, siloed CX stack

---
*Pitfalls research for: Question Design Patterns for AI Agent Workflows*
*Researched: 2026-03-19*
