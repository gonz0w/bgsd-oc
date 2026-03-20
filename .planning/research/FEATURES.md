# Feature Research

**Domain:** Question Design Patterns & Option Generation for AI Agent Workflows
**Researched:** 2026-03-19
**Confidence:** HIGH

<!-- section: compact -->
<features_compact>
<!-- Compact view for planners. Keep under 30 lines. -->

**Table stakes (must have):**
- Single-select vs multi-select distinction — different question types require different option semantics
- 3-5 options per question — 3 minimum for single-select, 2+ for multi-select
- Plausible distractors — wrong answers must be believable to someone with partial knowledge
- Parallel structure — all options grammatically and stylistically consistent

**Differentiators:**
- Workflow-specific option taxonomies — milestone/phase/plan discussions each have distinct option sets
- Consequence-framed options — each choice shows its outcome trade-off
- Mutual exclusivity signaling — clear when only one answer is valid vs multiple allowed

**Key dependencies:** Question taxonomy must exist before option generation templates; agent prompts must be updated to enforce option generation.
</features_compact>
<!-- /section -->

<!-- section: feature_landscape -->
## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single-select questions | User expects to pick ONE best answer | LOW | Each option mutually exclusive; one correct/preferred answer |
| Multi-select questions | User expects to pick ALL that apply | MEDIUM | Distinct from single-select; different UI and option semantics |
| 3-5 options per question | Cognitive load management | LOW | 3 minimum for single-select (A/B/C pattern); 2-4 typical for multi-select |
| Plausible distractors | Wrong answers should challenge partial knowledge | MEDIUM | Distractors reflect real misconceptions, not random wrong answers |
| Parallel option structure | Options read as equally weighted choices | LOW | Same grammar, similar length, same level of detail |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Workflow-specific option taxonomies | Questions feel tailored, not generic | MEDIUM | Milestone vs phase vs plan discussions have different decision types |
| Consequence-framed options | Users understand what each choice leads to | MEDIUM | Option text includes outcome hint, not just label |
| Option generation enforcement | Agents cannot ask bare open-ended questions | LOW | Prompt constraint: always generate 3-5 thoughtful options first |
| Mutual exclusivity signaling | Clear visual/textual cue when only one answer valid | LOW | "Pick one" vs "Select all that apply" explicit |
| Escalation option | Every question set includes escape hatch | LOW | "None of the above" or "Something else" preserves agency |

<!-- /section -->

<!-- section: anti_features -->
### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| "All of the above" | Makes questions easier to construct | Prevents true single-select logic; creates guessing artifacts | Ensure each option is independently correct/incorrect |
| "None of the above" for single-select | Catches disagreement cases | Forces binary comparison; often used as escape hatch | Include explicit "Something else" escalation option |
| >5 options per question | Comprehensive coverage feels thorough | Cognitive overload; diminishing discrimination returns | Use hierarchical questions (broad category first, then refine) |
| Random wrong answers as distractors | Fast to generate | Obviously wrong; tests nothing; erodes trust | Base distractors on documented misconceptions |
| True/False as question type | Simple binary decision | Only tests recall, not reasoning; 50% guessing | Ask "Which approach is better?" with substantive options |
| Open-ended questions (bare) | User freedom feels important | No guidance; high friction; inconsistent outcomes | Always pair with suggested options, even if optional |

<!-- /section -->

<!-- section: dependencies -->
## Feature Dependencies

```
[Question Taxonomy]
    └──requires──> [Option Generation Templates]
                          └──requires──> [Agent Prompt Updates]

[Workflow-specific Taxonomies]
    ├──milestone-discussion──> [Milestone Option Sets]
    ├──phase-discussion──────> [Phase Option Sets]
    └──plan-discussion───────> [Plan Option Sets]

[Mutual Exclusivity Signaling] ──enhances──> [User Decision Quality]
```

### Dependency Notes

- **Question Taxonomy requires Option Generation Templates:** Cannot generate good options without knowing what kinds of questions exist
- **Option Generation Templates require Agent Prompt Updates:** Templates only help if agents are instructed to use them
- **Workflow-specific taxonomies enable relevant options:** Generic option sets feel disconnected from the actual decision being made
<!-- /section -->

<!-- section: mvp -->
## MVP Definition

### Launch With (v15.0)

Minimum viable product — what's needed to validate the concept.

- [ ] **Question type classification** — Single-select vs multi-select distinction in agent prompts and workflow templates
- [ ] **3-5 options enforcement** — Agent prompts updated: "Before asking, generate 3-5 thoughtful options"
- [ ] **Parallel structure rule** — Options must match in grammar, length, specificity
- [ ] **Plausible distractor generation** — Distractors must be believable to someone with partial knowledge
- [ ] **Escalation option** — Every question set includes "Something else / None of the above" escape hatch
- [ ] **Mutual exclusivity signal** — "Pick one" vs "Select all that apply" explicit in question phrasing

### Add After Validation (v15.x)

Features to add once core is working.

- [ ] **Workflow-specific option taxonomies** — Curated option sets for milestone, phase, and plan discussion workflows
- [ ] **Consequence-framed options** — Each option includes a brief outcome hint
- [ ] **Option difficulty calibration** — Options vary in commitment/risk level (safe → bold spectrum)

### Future Consideration (v16+)

Features to defer until product-market fit is established.

- [ ] **Option generation with user history** — Personalized options based on past decisions
- [ ] **Dynamic option count** — Adaptive number of options based on decision complexity
- [ ] **Option quality scoring** — Automated evaluation of distractor plausibility and option balance
<!-- /section -->

<!-- section: question_taxonomy -->
## Question Taxonomy for AI Agent Workflows

### By Decision Type

| Question Type | When to Use | Options Required | Example |
|--------------|-------------|------------------|---------|
| **Single-select: Recommendation** | Agent recommends one best approach | 3-5 mutually exclusive options + escalation | "Which approach for Phase 2?" |
| **Single-select: Confirmation** | Validate agent's proposed direction | 2-3 options (Yes/No variants + escalation) | "Proceed with Plan A?" |
| **Single-select: Prioritization** | Rank items by importance/urgency | 3-5 options (ordinal) + escalation | "Which task first?" |
| **Multi-select: Elaboration** | User selects multiple facets to explore | 2-6 options (any combination valid) + escalation | "Which aspects to address?" |
| **Multi-select: Validation** | Confirm multiple conditions are understood | 3-6 options (all that apply) + escalation | "Which risks concern you?" |
| **Open with Options** | User provides primary direction, agent clarifies | 3-5 refinement options + freeform | "What should we focus on?" → then refine |

### By Workflow Stage

| Workflow | Primary Question Types | Option Set Focus |
|----------|----------------------|------------------|
| **Milestone Discussion** | Recommendation, Prioritization | Goal approaches, Scope boundaries, Risk tolerance |
| **Phase Discussion** | Recommendation, Confirmation | Implementation strategies, Verification approaches |
| **Plan Discussion** | Confirmation, Elaboration | Task decomposition, Sequence ordering |
| **Review/Gate** | Validation, Confirmation | Criteria completeness, Risk acknowledgment |

<!-- /section -->

<!-- section: option_quality -->
## What Makes Options Thoughtful vs Random

### Thoughtful Options Criteria

| Criterion | Definition | Why It Matters |
|-----------|------------|----------------|
| **Plausible distractors** | Wrong answers are believable to someone with partial knowledge | Tests real understanding, not just recognition |
| **Parallel structure** | All options use same grammatical form, similar length | Prevents position/length clues; equal cognitive load |
| **Mutual exclusivity** | For single-select: options don't overlap in meaning | Clear choice; no "it depends" ambiguity |
| **Coverage** | Options span the real decision space, not strawmen | User feels heard; no obvious "none of the above" is correct |
| **Consequence hint** | Options imply different outcomes, not just labels | User can choose by outcome preference, not just meaning |
| **Distinct commitment levels** | Options vary in how decisive/risky they are | Allows user to express risk tolerance |

### Random Options Anti-Patterns

| Anti-Pattern | What It Looks Like | Why It's Wrong |
|--------------|-------------------|----------------|
| **Obviously wrong distractors** | "Blue" when answer is clearly "Red" | Tests nothing; erodes trust |
| **Unequal length** | One option is a paragraph, others are phrases | Position/length reveals correct answer |
| **Grammatically inconsistent** | Option A is a phrase, Option B is a sentence | Signals hierarchy, not equivalence |
| **Single-axis variation** | Only one dimension differs across all options | Options don't represent real trade-offs |
| **Synonyms posing as different choices** | "Use X" vs "Employ X" vs "Utilize X" | False choice; no real decision |
| **Options that overlap** | Both A and B could be correct depending on interpretation | Paralyzes decision |

### Option Generation Prompt Template

```
When asking a question, you MUST:
1. Generate 3-5 options BEFORE asking the question
2. Ensure all options are:
   - Parallel in structure (same grammatical form)
   - Similar in length (within 30% character count)
   - Mutually exclusive (for single-select questions)
   - Plausible to someone with partial knowledge
3. Include one escalation option ("Something else", "None of the above")
4. For single-select: explicitly mark which option you're recommending
5. Format options with clear labels (A/B/C or 1/2/3)

BAD: "What should we do?" (open-ended, no options)
GOOD: "Which approach for Phase 2?
  A) Incremental — Ship small improvements continuously
  B) Bolder — Pursue the risky optimization that could cut 40% of the work
  C) Conservative — Complete the full current plan as specified
  D) Something else — [describe different approach]
"
```
<!-- /section -->

<!-- section: sources -->
## Sources

- University of Michigan Center for Academic Innovation: "Effective Prompting to Generate Multiple Choice Questions with GPT-4o" (2025)
- LearnExperts.ai: "Guidelines for Writing Multiple-Choice Questions" (2026)
- LogicBalls AI Prompt Library: "AI Multiple Choice Assessment Generator" (2026)
- Zendesk: "Best practices for conversation design for advanced AI agents"
- NN/g Nielsen Norman Group: "The 6 Types of Conversations with Generative AI"
- Kapture.ai: "Intent Architecture: How It Shapes AI Accuracy and Routing"
- Teach.cbs.dk: "A 3-Step Workflow for Creating Multiple-Choice Questions with AI"
<!-- /section -->

---
*Feature research for: Question Design Patterns & Option Generation*
*Researched: 2026-03-19*
