# EDD: Speculative Decoding Optimization for bGSD

**Author:** Cam  
**Date:** 2026-04-01  
**Status:** Draft  
**Repo:** `gonz0w/bgsd-oc`

---

## 1. Problem Statement

bGSD's two-layer architecture (deterministic CLI + AI workflow prompts) generates significant LLM token volume across 10 specialized agents, 41 slash commands, and wave-based parallel execution. The current design prioritizes correctness and separation of concerns but does not account for inference-time token generation efficiency.

Speculative decoding works by having a small draft model predict tokens ahead, then verifying them in batch against the target model. Acceptance rates depend on output predictability — the more deterministic and structurally constrained the expected output, the more tokens the draft model gets right, and the faster wall-clock inference becomes.

bGSD already has strong structural foundations (JSON output from CLI, structured markdown templates, deterministic decision engine), but the agent system prompts, workflow definitions, and template schemas leave substantial speculative decoding performance on the table. This EDD proposes concrete changes to maximize draft model acceptance rates across the entire bGSD pipeline.

---

## 2. Scope

This document covers optimization of:

- **Agent system prompts** — output schema constraints, preamble anchoring, response framing
- **Workflow definitions** — structural tokens in `.md` workflow files
- **Templates** — PLAN.md, SUMMARY.md, VERIFICATION.md, STATE.md schemas
- **Init system** — JSON context payload structure and its effect on continuation predictability
- **Model profiles** — draft/target pairing strategy
- **Decision engine** — extending deterministic routing to reduce LLM invocations
- **Skill system** — structured output contracts for community skills

Out of scope: changes to the underlying inference infrastructure (vLLM, TensorRT-LLM, etc.), modifications to the OpenCode host editor, or changes to the LLM providers' APIs.

---

## 3. Background: Where Speculative Decoding Wins and Loses

### High acceptance rate (fast) — draft model nails these tokens

- Structural tokens: JSON keys, braces, colons, quotes, XML tags, markdown headers
- Enum values from a known set (e.g., `"status": "complete"`)
- Boilerplate preambles, repeated patterns, format-constrained output
- Low-temperature, schema-bound continuations
- Tokens following rigid few-shot examples

### Low acceptance rate (no speedup) — draft model guesses wrong

- Novel reasoning content, creative problem-solving
- High-entropy free-text with no structural constraints
- High temperature sampling
- Outputs where the model must choose from a large vocabulary with no prior constraint

### The optimization principle

Maximize the ratio of structurally-predictable tokens to free-text tokens in every LLM call. The actual reasoning content (the hard part) stays the same — we're making the "packaging" around it as cheap as possible.

---

## 4. Current State Analysis

### What bGSD already does well

1. **Init system returns compound JSON** — agents receive structured context rather than free-text, which means responses follow predictable continuation patterns from structured input.

2. **Decision engine (v11.3)** — 18+ pure functions that replace LLM calls entirely for routing, classification, and gating decisions. Every decision that stays deterministic is one that never touches speculative decoding at all.

3. **CLI outputs JSON (`--raw`)** — agents consume structured data, not markdown prose, reducing parsing ambiguity in the continuation.

4. **Model profiles** — already separate agents by capability tier, which is the right abstraction for draft/target model pairing.

5. **Wave-based execution** — shorter, focused agent invocations per task rather than monolithic sessions.

### What needs improvement

1. **Agent output formats are under-constrained** — agents like `gsd-planner` produce PLAN.md as free-form markdown with YAML frontmatter. The frontmatter schema is defined but not rigidly enforced in the prompt, so the model generates both keys and values with high entropy.

2. **Workflow prompts lack anchoring tokens** — workflows tell agents *what* to do but don't force a predictable *output frame* (e.g., "begin your response with exactly: `## Plan Analysis\n\n<status>`").

3. **Template variability** — SUMMARY.md has three variants (minimal/standard/complex) selected by the agent, which means the draft model can't predict which structure comes next.

4. **Agent preamble waste** — agents often generate conversational lead-ins ("Sure, I'll analyze the codebase and create...") before producing structured output. These tokens are high-entropy and provide zero value.

5. **Verification pipeline outputs** — VERIFICATION.md uses free-text verdicts ("gaps_found", "pass") but the surrounding prose is unconstrained.

6. **Research agents** — `gsd-phase-researcher` and `gsd-project-researcher` produce the most free-text-heavy outputs, with almost no structural constraints.

---

## 5. Proposed Changes

### 5.1 Agent System Prompt Optimization

#### 5.1.1 Mandatory Output Frame Anchoring

Every agent system prompt should specify an exact opening sequence that the model must produce before any reasoning. This gives the draft model a free runway of predictable tokens at the start of every response.

**Current (gsd-executor, conceptual):**
```
You are the executor agent. Implement the plan described below...
```

**Proposed:**
```
You are the executor agent. Implement the plan described below.

YOUR RESPONSE MUST BEGIN WITH EXACTLY:
---
agent: gsd-executor
plan_id: {plan_id}
phase: {phase}
status: in_progress
---

Then produce your implementation output in the following structure:
<implementation>
  <file path="...">
    <action>create|modify|delete</action>
    <content>...</content>
  </file>
</implementation>

End your response with EXACTLY:
<result>
  <status>success|failure|partial</status>
  <files_changed>N</files_changed>
  <tests_passed>N</tests_passed>
  <tests_failed>N</tests_failed>
  <summary>One sentence summary</summary>
</result>
```

The YAML frontmatter block, XML tags, attribute names, and enum values (`create|modify|delete`, `success|failure|partial`) are all tokens the draft model will predict nearly perfectly.

**Apply to all 10 agents.** Each agent gets a mandatory opening frame and closing frame with agent-specific structured fields.

#### 5.1.2 Preamble Suppression

Add to every agent system prompt:

```
CRITICAL: Do NOT begin with conversational preamble, acknowledgments, or 
restatements of the task. Begin directly with the required output frame.
Do NOT say "Sure", "I'll", "Let me", "Here's", or similar lead-ins.
```

This eliminates 10-50 high-entropy tokens per agent invocation that serve no purpose.

#### 5.1.3 Enum Standardization Across Agents

Define a global enum vocabulary that all agents share. When the draft model sees a field it knows takes an enum, it can predict with near-certainty.

```javascript
// Proposed: references/enums.md or constants in decision-rules.js

const AGENT_ENUMS = {
  status: ["not_started", "in_progress", "blocked", "complete", "failed", "skipped"],
  severity: ["blocker", "warning", "info"],
  confidence: ["high", "medium", "low"],
  verdict: ["pass", "fail", "partial", "needs_review"],
  action: ["create", "modify", "delete", "rename", "move"],
  complexity: ["trivial", "low", "medium", "high", "critical"],
  priority: ["p0", "p1", "p2", "p3"],
  test_status: ["pass", "fail", "skip", "error"],
  review_gate: ["approved", "revise", "reject"],
  tdd_phase: ["red", "green", "refactor"],
  checkpoint_type: ["progress", "milestone", "recovery", "manual"]
};
```

These enums should be injected into every agent's context via the init system and referenced in output schemas.

### 5.2 Workflow Definition Optimization

#### 5.2.1 Structured Inter-Agent Communication

Currently, agents communicate through files (PLAN.md in → SUMMARY.md out). The file formats should be tightened to use rigid schemas with YAML frontmatter as the structured envelope.

**Current SUMMARY.md (conceptual):**
```markdown
# Summary

I implemented the authentication module...
[free-form prose]
```

**Proposed SUMMARY.md contract:**
```markdown
---
plan_id: "{plan_id}"
phase: {phase}
agent: gsd-executor
status: complete|failed|partial
duration_estimate: "{N min}"
files_changed:
  - path: "src/auth.js"
    action: create
    lines: 142
  - path: "tests/auth.test.js"  
    action: create
    lines: 89
tests:
  total: 12
  passed: 12
  failed: 0
review_gate: approved|revise
---

## Changes

{structured prose, max 200 words}

## Verification Checklist

- [x] must_have_1: {description}
- [x] must_have_2: {description}
- [ ] must_have_3: {description} — {reason for gap}
```

The frontmatter is almost entirely predictable by a draft model once the schema is known. The only high-entropy content is the `## Changes` prose section and gap descriptions.

#### 5.2.2 Workflow Step Numbering with Deterministic Prefixes

Every workflow step should produce a numbered, tagged output so the model's continuation is anchored:

```markdown
## Workflow: execute-plan

For each step, output EXACTLY:

STEP 1/N: CONTEXT_LOAD
<step n="1" name="context_load" status="complete">
  <data>{JSON from init}</data>
</step>

STEP 2/N: DEPENDENCY_CHECK  
<step n="2" name="dependency_check" status="complete|blocked">
  <result>{validation output}</result>
</step>

STEP 3/N: EXECUTE
<step n="3" name="execute" status="in_progress">
  ...
</step>
```

The `STEP N/N: NAME` prefix and the `<step>` XML tags are fully predictable.

#### 5.2.3 Eliminate SUMMARY.md Variant Selection

Currently there are three variants: `summary-minimal.md`, `summary-standard.md`, `summary-complex.md`. The executor agent selects which to use, introducing a branching point the draft model can't predict.

**Proposed:** Collapse into a single `summary.md` template with optional sections. The structure is always the same; sections are populated or left as `N/A`. This makes the token sequence deterministic regardless of plan complexity.

### 5.3 Template Schema Hardening

#### 5.3.1 PLAN.md Frontmatter Schema

Lock down the YAML frontmatter in `phase-prompt.md` to a strict key ordering with typed values:

```yaml
---
plan_id: "PP-{phase}-{seq}"           # always this format
phase: {N}                            # integer
title: "{string}"                     # free text, but key is predictable
status: not_started                   # enum, always starts as not_started
complexity: trivial|low|medium|high|critical
estimated_duration: "{N} {unit}"
wave: {N}                             # integer
depends_on: []                        # array of plan_ids
must_haves:                           # always present, array
  - "{requirement}"
files_targeted:                       # always present, array
  - "{path}"
test_strategy: unit|integration|e2e|manual|none
tdd_mode: true|false
---
```

**Key ordering matters.** If every PLAN.md frontmatter emits keys in the same order, the draft model learns the pattern and predicts the next key name with high confidence. Document and enforce this ordering in the template.

#### 5.3.2 VERIFICATION.md Structured Verdicts

Replace free-text verdicts with structured XML blocks:

```markdown
---
phase: {N}
verdict: pass|gaps_found|human_needed
score: {0-100}
grade: A|B|C|D|F
---

<verification>
  <must_have id="1" status="pass|fail|partial">
    <description>{text}</description>
    <evidence>{file:line or test name}</evidence>
  </must_have>
  <must_have id="2" status="pass">
    <description>{text}</description>  
    <evidence>{file:line}</evidence>
  </must_have>
  <anti_patterns found="{N}">
    <pattern type="stub|todo|placeholder|empty_return" file="{path}" line="{N}"/>
  </anti_patterns>
  <regression status="pass|fail" tests_run="{N}" tests_failed="{N}"/>
</verification>
```

#### 5.3.3 STATE.md as Generated View

The architecture doc notes that STATE.md is a generated view from SQLite. Formalize this: STATE.md should be emitted in a completely deterministic format by `bgsd-tools.cjs` with zero AI involvement. If it's already generated, ensure no agent ever writes free-text into STATE.md directly.

### 5.4 Init System Enhancements

#### 5.4.1 Schema Declaration in Context Payload

Include the expected output schema in every init payload so the model has it in-context:

```json
{
  "context": { ... },
  "output_schema": {
    "type": "yaml_frontmatter+markdown",
    "frontmatter_keys": ["plan_id", "phase", "status", "complexity", ...],
    "frontmatter_key_order": "strict",
    "required_sections": ["## Tasks", "## Checkpoints", "## Dependencies"],
    "enums": {
      "status": ["not_started", "in_progress", "complete", "failed"],
      "complexity": ["trivial", "low", "medium", "high", "critical"]
    }
  }
}
```

This doesn't change the init system's data — it adds metadata about the expected response format. The model seeing this schema in-context dramatically improves the draft model's ability to predict structural tokens.

#### 5.4.2 Compact Mode as Default (Already Done)

The architecture doc notes compact mode returns 38-50% smaller payloads. This is already the default. Good — smaller input context means less divergence in the model's attention, which indirectly helps speculative decoding by keeping the continuation distribution tighter.

### 5.5 Model Profile Strategy for Draft/Target Pairing

#### 5.5.1 Explicit Draft Model Configuration

Add a `draft_model` field to the model profile system:

```json
{
  "model_profile": "balanced",
  "speculative_decoding": {
    "enabled": true,
    "draft_model": "qwen-2.5-coder-1.5b",
    "max_draft_tokens": 8,
    "acceptance_threshold": 0.7
  },
  "model_profiles": {
    "gsd-executor": "opus",
    "gsd-planner": "opus"
  }
}
```

This is only actionable when running local inference (LM Studio, vLLM, etc.), but having the config in place means the system is ready when users deploy their own inference stack.

#### 5.5.2 Agent-Specific Draft Sizing

Different agents have different predictability profiles:

| Agent | Output Predictability | Recommended Draft Size | Recommended K (lookahead) |
|-------|----------------------|----------------------|--------------------------|
| gsd-executor | Medium-High (structured code + XML frame) | 1.5B-3B | 6-8 |
| gsd-planner | Medium (YAML frontmatter + structured tasks) | 1.5B-3B | 6-8 |
| gsd-verifier | High (mostly structured verdicts) | 0.5B-1.5B | 8-12 |
| gsd-plan-checker | Medium (structured feedback) | 1.5B-3B | 6-8 |
| gsd-debugger | Low-Medium (free-form reasoning) | 3B+ | 4-6 |
| gsd-phase-researcher | Low (free-text research) | 3B+ | 3-5 |
| gsd-project-researcher | Low (free-text research) | 3B+ | 3-5 |
| gsd-roadmapper | Medium (structured ROADMAP.md) | 1.5B-3B | 6-8 |
| gsd-codebase-mapper | Medium-High (structured analysis) | 1.5B-3B | 6-8 |

For API-hosted models (Anthropic, etc.), these are informational — the provider controls speculative decoding internally. For local inference, they drive configuration.

### 5.6 Decision Engine Expansion

#### 5.6.1 New Deterministic Decisions

Identify additional routing decisions currently made by LLMs that can be moved to `decision-rules.js`:

- **Summary variant selection** — based on plan complexity score and file count, deterministically select summary depth (moot if variants are collapsed per §5.2.3, but valuable as a general pattern)
- **Research depth gating** — based on phase type and existing research coverage, decide whether to spawn researchers at all
- **Checkpoint type classification** — based on task completion percentage and time elapsed, classify checkpoint type without LLM
- **Review severity escalation** — based on finding count and types, deterministically escalate from INFO to WARNING to BLOCKER

Each deterministic decision that replaces an LLM call eliminates not just the speculative decoding overhead but the entire inference call.

#### 5.6.2 Decision Confidence → Draft Token Budget

When a decision function returns MEDIUM confidence (suggest to agent, don't auto-apply), include the recommendation in the agent context so the model can confirm it with minimal reasoning tokens:

```json
{
  "pre_decisions": [
    {
      "decision": "summary_depth",
      "recommendation": "standard",
      "confidence": "medium",
      "rationale": "12 files changed, 3 must_haves, no blockers"
    }
  ]
}
```

The agent then just needs to confirm or override, rather than reason from scratch. Confirmation is highly predictable; override is rare and worth the entropy cost.

### 5.7 Skill System Output Contracts

#### 5.7.1 Skill Output Schema Declaration

When skills are installed via the skill system (41-pattern security scanner, audit logging), require a declared output schema:

```json
{
  "skill": "code-review-enhanced",
  "output_schema": {
    "format": "xml",
    "root_element": "review",
    "required_fields": ["severity", "category", "file", "line", "message"],
    "enums": {
      "severity": ["blocker", "warning", "info"],
      "category": ["security", "performance", "style", "logic", "test"]
    }
  }
}
```

Skills without output schemas still work but are flagged as "unoptimized" in `skills:list`.

### 5.8 Temperature Strategy

#### 5.8.1 Per-Agent Temperature Defaults

Add temperature to model profile resolution:

```json
{
  "agent_temperatures": {
    "gsd-executor": 0.0,
    "gsd-verifier": 0.0,
    "gsd-plan-checker": 0.1,
    "gsd-planner": 0.2,
    "gsd-debugger": 0.3,
    "gsd-roadmapper": 0.2,
    "gsd-codebase-mapper": 0.0,
    "gsd-phase-researcher": 0.4,
    "gsd-project-researcher": 0.4
  }
}
```

Lower temperatures directly increase draft model acceptance rates. Executor and verifier should always be at 0 (deterministic); researchers can tolerate higher temperature since their outputs are inherently exploratory.

---

## 6. Implementation Plan

### Phase 1: Zero-Breaking-Change Prompt Optimization (1-2 days)

These changes modify only agent system prompts and workflow .md files. No code changes.

1. Add output frame anchoring to all 10 agent definitions in `agents/`
2. Add preamble suppression directive to all agent system prompts
3. Create `references/enums.md` with standardized enum vocabulary
4. Update `references/model-profiles.md` with temperature defaults
5. Enforce strict key ordering in `templates/phase-prompt.md` frontmatter

### Phase 2: Template Consolidation (1 day)

1. Collapse SUMMARY.md variants into single template with optional sections
2. Harden VERIFICATION.md to use structured XML verdict blocks
3. Add `output_schema` metadata to init system JSON payloads
4. Update workflow .md files with numbered step prefixes

### Phase 3: Configuration Extensions (1 day)

1. Add `speculative_decoding` config block to `config.json` schema
2. Add `agent_temperatures` to model profile system
3. Add `draft_model` field to profile resolution in `decision-rules.js`
4. Update `CONFIG_SCHEMA` in `constants.js`

### Phase 4: Decision Engine Expansion (2-3 days)

1. Implement new deterministic decision functions (§5.6.1)
2. Add `pre_decisions` injection to init system payloads
3. Add confidence-based draft token budget hints
4. Update affected workflows to consume pre-decisions

### Phase 5: Skill System Contracts (1 day)

1. Add `output_schema` to skill manifest format
2. Update `skills:validate` to check for schema presence
3. Flag unoptimized skills in `skills:list` output

---

## 7. Measurement

### Metrics to Track

1. **Tokens per agent invocation** — before/after prompt optimization. Expect 15-30% reduction from preamble suppression alone.
2. **Structural token ratio** — percentage of output tokens that are structural (tags, keys, enums) vs. free-text. Target: >60% for executor/verifier, >40% for planner.
3. **Acceptance rate** (local inference only) — draft model token acceptance rate per agent type. Target: >80% for verifier, >70% for executor, >50% for researchers.
4. **Wall-clock latency per phase** — end-to-end time from `/bgsd-execute-phase` to completion. This is the user-facing metric that matters.
5. **Decision engine coverage** — percentage of routing decisions handled deterministically vs. by LLM. Current baseline needed; target >85%.

### Benchmarking Approach

1. Create a reference project with known complexity (the bGSD repo itself is a good candidate)
2. Run `/bgsd-plan-phase` and `/bgsd-execute-phase` with token counting before and after each phase of this EDD
3. For local inference: compare vLLM with and without speculative decoding enabled across the same reference project
4. Track acceptance rates per agent type to validate the per-agent draft sizing recommendations

---

## 8. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Overly rigid schemas reduce agent reasoning quality | Medium | High | A/B test with quality scoring — if grades drop, relax constraints on that agent |
| Preamble suppression causes models to skip reasoning steps | Low | Medium | The directive suppresses *conversational* preamble, not chain-of-thought; test with reasoning-heavy tasks |
| Template consolidation breaks existing `.planning/` state | Low | High | Backward-compatible parsing rule already exists; new format accepted alongside old |
| Draft model configuration complexity for end users | Medium | Low | Sensible defaults in config.json; advanced config is opt-in |
| API-hosted models don't expose speculative decoding controls | Certain | Low | These optimizations still reduce total token count and improve output structure, which benefits regardless |

---

## 9. Open Questions

1. **Should the output frame use XML or JSON?** XML is more verbose (more structural tokens = more draft-friendly) but heavier on the wire. JSON is more compact but has fewer predictable tokens per field. Current recommendation: XML for inter-agent communication, JSON for CLI output. Needs benchmarking.

2. **Can we measure acceptance rates through the Anthropic API?** Currently no. This limits measurement to local inference setups. Worth asking Anthropic if they expose any inference efficiency metrics.

3. **Should temperature be per-agent or per-step-within-workflow?** Per-agent is simpler. Per-step would allow low temperature for structural output and higher temperature for reasoning sections within a single agent call. Deferred to Phase 4.

4. **How does this interact with prompt caching?** Anthropic's prompt caching caches the system prompt prefix. Longer, more structured system prompts with output schemas may increase cache hit rates. Needs investigation.

---

## 10. References

- Leviathan, Chen, & Shoham (2023). "Fast Inference from Transformers via Speculative Decoding." ICML 2023.
- bGSD Architecture Documentation: `docs/architecture.md`
- bGSD Agent System: `docs/agents.md`
- bGSD Planning System: `docs/planning-system.md`
- vLLM Speculative Decoding: `https://docs.vllm.ai/en/latest/features/spec_decode.html`
