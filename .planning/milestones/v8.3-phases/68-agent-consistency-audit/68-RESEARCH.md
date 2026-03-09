# Phase 68: Agent Consistency Audit - Research

**Researched:** 2026-03-08
**Domain:** Agent definition file structure and consistency
**Confidence:** HIGH

## Summary

This phase is about structural normalization of 10 agent markdown definition files (`agents/gsd-*.md`). The domain is entirely internal to this project — no external libraries, APIs, or ecosystem research needed. All research is based on direct examination of the 10 agent files themselves, cross-referenced against the audit baseline in CONTEXT.md.

The audit confirms the CONTEXT.md baseline is accurate: 5 agents are missing `<project_context>`, 1 is missing PATH SETUP, 3 are missing `<structured_returns>` (executor uses `<completion_format>` which is functionally equivalent but differently named, and verifier lacks it entirely). Beyond the big 3 blocks, there are additional structural patterns that vary: deviation rules (only executor + github-ci have them, which is correct — only execution agents need them), TodoWrite (only github-ci), checkpoint formats (only agents that handle checkpoints), and success_criteria (all 10 have it — consistent already). The work is mechanical and well-scoped: add missing blocks, normalize naming, adapt content per agent domain.

**Primary recommendation:** Work agent-by-agent, using gsd-github-ci as the primary structural reference. For each agent, add missing blocks adapted to that agent's domain, and normalize the `<structured_returns>` tag name (rename executor's `<completion_format>` to `<structured_returns>`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use best-of adaptation: draw the best patterns from gsd-planner, gsd-executor, and gsd-github-ci as reference agents
- Adapt per agent's needs — not cookie-cutter copy/paste. Each agent's domain determines which patterns apply and how they're worded.
- Go beyond the 3 named blocks (project_context, PATH SETUP, structured_returns)
- Also normalize: deviation rules, checkpoint formats, TodoWrite instructions, and any other structural patterns that vary across agents
- Goal: an agent opened at random looks structurally familiar — same section order, same conventions, same discovery patterns
- Core domain logic and capabilities are NOT touched — only structural framing around the domain content
- Every agent gets a `<structured_returns>` section — no exceptions
- The section structure is consistent (same XML tag, same general layout)
- The actual return format fields and content are agent-appropriate

### Agent's Discretion
- Exact wording of project_context discovery blocks (adapted per agent's discovery needs)
- Section ordering within agent files (follow whatever pattern emerges as most readable)
- Which additional structural patterns beyond the big 3 need normalization (discovered during detailed audit)
- Whether to batch agents by similarity or touch them one at a time
- Specific structured_returns field names for executor, verifier, and codebase-mapper

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACON-01 | All 10 agents have `<project_context>` discovery block | Audit identified 5 missing agents: debugger, project-researcher, roadmapper, verifier, codebase-mapper. Reference pattern exists in gsd-github-ci, gsd-planner, gsd-executor, gsd-phase-researcher, gsd-plan-checker. |
| ACON-02 | All 10 agents have PATH SETUP block | Only 1 missing: codebase-mapper. The PATH SETUP block is identical across all 9 agents that have it — same 3-line code block, same instruction text. |
| ACON-03 | codebase-mapper agent has proper `<structured_returns>` section | codebase-mapper currently has `<step name="return_confirmation">` with an informal format. Need to wrap this in a `<structured_returns>` section with the standard XML tag and layout. |
</phase_requirements>

## Detailed Audit Results

### Current State: The Big 3

| Agent | Lines | `<project_context>` | PATH SETUP | `<structured_returns>` |
|-------|-------|---------------------|------------|------------------------|
| gsd-executor | 483 | **Yes** | **Yes** | **MISSING** (has `<completion_format>` instead) |
| gsd-planner | 1197 | **Yes** | **Yes** | **Yes** |
| gsd-github-ci | 540 | **Yes** | **Yes** | **Yes** |
| gsd-phase-researcher | 518 | **Yes** | **Yes** | **Yes** |
| gsd-plan-checker | 655 | **Yes** | **Yes** | **Yes** |
| gsd-debugger | 1216 | **MISSING** | **Yes** | **Yes** |
| gsd-project-researcher | 637 | **MISSING** | **Yes** | **Yes** |
| gsd-roadmapper | 655 | **MISSING** | **Yes** | **Yes** |
| gsd-verifier | 571 | **MISSING** | **Yes** | **MISSING** |
| gsd-codebase-mapper | 770 | **MISSING** | **MISSING** | **MISSING** |

### Current State: Additional Structural Patterns

| Pattern | Which Agents Have It | Should All Have It? |
|---------|---------------------|---------------------|
| `<deviation_rules>` | executor, github-ci | **No** — only execution-stage agents need deviation rules. Research, planning, verification, and mapping agents don't deviate from plans. |
| `<checkpoint_return_format>` / checkpoint handling | executor, github-ci, debugger, planner (defines checkpoint types) | **No** — only agents that can encounter checkpoints during execution need these. |
| TodoWrite setup | github-ci only | **No** — TodoWrite is specific to long-running execution agents. The CI agent was given this in Phase 67. Other agents don't need it. |
| `<success_criteria>` | All 10 | **Yes** — already consistent! No work needed. |
| Mandatory Initial Read block in `<role>` | All 10 | **Yes** — already consistent! No work needed. |
| `<execution_flow>` / `<process>` | All 10 (some use `<process>`, some `<execution_flow>`) | **Normalize tag name** — recommend all use `<execution_flow>` for consistency. Currently codebase-mapper uses `<process>`. |

### Agent-by-Agent Work Needed

#### 1. gsd-codebase-mapper (most work — missing all 3)

**Missing:** `<project_context>`, PATH SETUP, `<structured_returns>`

**PATH SETUP:** Add the standard 3-line block before `<role>`. This is identical across all agents:
```markdown
**PATH SETUP:** Before running any gsd-tools commands, first resolve:
\`\`\`bash
GSD_HOME=$(ls -d $HOME/.config/*/get-shit-done 2>/dev/null | head -1)
\`\`\`
Then use `$GSD_HOME` in all subsequent commands. Never hardcode the config path.
```

**`<project_context>`:** Add after `<role>`. Adapt for mapper's domain — the mapper explores codebases, so the discovery block should note that project skills affect what conventions to look for:
```markdown
<project_context>
Before mapping, discover project context:

**Project instructions:** Read `./AGENTS.md` if it exists in the working directory. Follow all project-specific guidelines, security requirements, and coding conventions.

**Project skills:** Check `.agents/skills/` directory if it exists:
1. List available skills (subdirectories)
2. Read `SKILL.md` for each skill (lightweight index ~130 lines)
3. Load specific `rules/*.md` files as needed during mapping
4. Do NOT load full `AGENTS.md` files (100KB+ context cost)
5. Account for project skill patterns when documenting conventions

This ensures codebase analysis reflects project-specific conventions and patterns.
</project_context>
```

**`<structured_returns>`:** The mapper currently has an informal return format inside `<step name="return_confirmation">`. Extract and formalize into `<structured_returns>`:
- Mapping Complete return (documents written, line counts, focus area)
- Mapping Blocked return (if unable to explore — e.g., empty codebase)

**Additional:** Rename `<process>` to `<execution_flow>` for tag consistency.

#### 2. gsd-verifier (missing 2: project_context, structured_returns)

**Missing:** `<project_context>`, `<structured_returns>`

**`<project_context>`:** Adapt for verification domain — verifier checks code against expectations, so skills context helps verify that implementations follow project conventions:
```markdown
<project_context>
Before verifying, discover project context:

**Project instructions:** Read `./AGENTS.md` if it exists in the working directory. Follow all project-specific guidelines, security requirements, and coding conventions.

**Project skills:** Check `.agents/skills/` directory if it exists:
1. List available skills (subdirectories)
2. Read `SKILL.md` for each skill (lightweight index ~130 lines)
3. Load specific `rules/*.md` files as needed during verification
4. Do NOT load full `AGENTS.md` files (100KB+ context cost)
5. Verify implementations follow project skill patterns

This ensures verification checks implementations against project-specific conventions.
</project_context>
```

**`<structured_returns>`:** The verifier already has an `<output>` section with structured return formats (Verification Complete, Gaps Found, Human Needed). Wrap the return-to-orchestrator format in `<structured_returns>` tags, keeping the existing `<output>` section for the VERIFICATION.md file creation instructions. The structured return portion (the "Return to Orchestrator" markdown block) should move into `<structured_returns>`.

#### 3. gsd-debugger (missing 1: project_context)

**Missing:** `<project_context>`

**`<project_context>`:** Adapt for debugging domain — when investigating bugs, project skills help understand expected patterns:
```markdown
<project_context>
Before investigating, discover project context:

**Project instructions:** Read `./AGENTS.md` if it exists in the working directory. Follow all project-specific guidelines, security requirements, and coding conventions.

**Project skills:** Check `.agents/skills/` directory if it exists:
1. List available skills (subdirectories)
2. Read `SKILL.md` for each skill (lightweight index ~130 lines)
3. Load specific `rules/*.md` files as needed during investigation
4. Do NOT load full `AGENTS.md` files (100KB+ context cost)
5. Use skill patterns to understand expected behavior vs actual behavior

This ensures debugging investigates against project-specific conventions and patterns.
</project_context>
```

#### 4. gsd-project-researcher (missing 1: project_context)

**Missing:** `<project_context>`

**`<project_context>`:** Adapt for project-level research — when researching domain ecosystems, project skills indicate existing conventions:
```markdown
<project_context>
Before researching, discover project context:

**Project instructions:** Read `./AGENTS.md` if it exists in the working directory. Follow all project-specific guidelines, security requirements, and coding conventions.

**Project skills:** Check `.agents/skills/` directory if it exists:
1. List available skills (subdirectories)
2. Read `SKILL.md` for each skill (lightweight index ~130 lines)
3. Load specific `rules/*.md` files as needed during research
4. Do NOT load full `AGENTS.md` files (100KB+ context cost)
5. Research should account for project skill patterns

This ensures research aligns with project-specific conventions and libraries.
</project_context>
```

#### 5. gsd-roadmapper (missing 1: project_context)

**Missing:** `<project_context>`

**`<project_context>`:** Adapt for roadmapping — when creating roadmaps, project skills indicate what conventions exist:
```markdown
<project_context>
Before creating the roadmap, discover project context:

**Project instructions:** Read `./AGENTS.md` if it exists in the working directory. Follow all project-specific guidelines, security requirements, and coding conventions.

**Project skills:** Check `.agents/skills/` directory if it exists:
1. List available skills (subdirectories)
2. Read `SKILL.md` for each skill (lightweight index ~130 lines)
3. Load specific `rules/*.md` files as needed during roadmap creation
4. Do NOT load full `AGENTS.md` files (100KB+ context cost)
5. Account for project skill patterns when structuring phases

This ensures roadmap phases account for project-specific conventions and existing patterns.
</project_context>
```

#### 6. gsd-executor (missing 1: structured_returns naming)

**Issue:** Has `<completion_format>` instead of `<structured_returns>`. Functionally equivalent but inconsistently named.

**Fix:** Rename `<completion_format>` to `<structured_returns>`. Add the checkpoint return format under the same section (currently in a separate `<checkpoint_return_format>` tag — this can stay separate since it's referenced inline, but the primary completion output should be under `<structured_returns>`).

The executor's structured return already has the right content:
- PLAN COMPLETE (tasks completed, commits, duration)
- CHECKPOINT REACHED (via `<checkpoint_return_format>`)

Rename the tag: `<completion_format>` → `<structured_returns>`, `</completion_format>` → `</structured_returns>`.

## Architecture Patterns

### Reference Agent Structure (gsd-github-ci as primary template)

The most recently updated and complete agent follows this section order:

```
---
frontmatter (description, mode, color, estimated_tokens, tools)
---

PATH SETUP block (before <role>)

<role>
  - Identity and purpose
  - Spawned-by information
  - Mandatory Initial Read block
</role>

<project_context>
  - AGENTS.md discovery
  - Skills directory check
  - Domain-adapted discovery steps
</project_context>

<execution_flow>
  <step> blocks defining the agent's process
</execution_flow>

[Domain-specific sections — varies per agent]

<structured_returns>
  - Success return format
  - Failure/blocked return format
  - Checkpoint return format (if applicable)
</structured_returns>

<success_criteria>
  - Checklist of completion indicators
</success_criteria>
```

### Structural Invariants (must be present in ALL agents)

1. **Frontmatter:** `description`, `mode: subagent`, `color`, `estimated_tokens`, `tools`
2. **PATH SETUP:** Identical 3-line block, positioned immediately after frontmatter
3. **`<role>`:** Contains agent identity, spawner info, Mandatory Initial Read
4. **`<project_context>`:** Contains AGENTS.md check, skills directory check, 5 numbered steps
5. **`<structured_returns>`:** Contains at least one success and one failure/blocked return format
6. **`<success_criteria>`:** Contains checklist of completion indicators

### Structural Variants (agent-domain-specific, NOT required in all)

| Section | Required In | Why |
|---------|-------------|-----|
| `<deviation_rules>` | executor, github-ci | Only execution agents deviate from plans |
| `<checkpoint_return_format>` | executor, github-ci, debugger | Only agents that hit checkpoints |
| `<checkpoint_protocol>` | executor | Executor has the most complex checkpoint handling |
| `<checkpoint_behavior>` | debugger | Debug-specific checkpoint rules |
| TodoWrite setup | github-ci | Only CI agent uses TodoWrite for progress |
| `<upstream_input>` | phase-researcher, plan-checker | Agents consuming CONTEXT.md decisions |
| `<downstream_consumer>` | phase-researcher, planner, roadmapper | Agents producing output for other agents |
| `<philosophy>` | All that have domain methodology | Not all need it, but those with deep domain content do |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `project_context` wording per agent | Write each from scratch | Adapt from the reference pattern (5 numbered steps) | Consistency requires the same structure; only step 3 and step 5 wording varies per domain |
| `structured_returns` format | Invent new formats | Follow the existing markdown template pattern used by planner/github-ci | Callers expect consistent structure |
| Section ordering | Guess what goes where | Follow github-ci ordering as reference | Reduces cognitive load when switching between agent files |

## Common Pitfalls

### Pitfall 1: Cookie-Cutter Copy/Paste
**What goes wrong:** Blindly copying `<project_context>` from one agent to another produces text that doesn't match the agent's domain (e.g., "Before planning..." in a debugger agent).
**Why it happens:** Efficiency temptation — just copy/paste and be done.
**How to avoid:** Read step 3 and step 5 of the `<project_context>` block and adapt the verbs and domain context: "during research", "during investigation", "during mapping", "during verification", "during roadmap creation".
**Warning signs:** The intro line says "Before planning" in a non-planning agent.

### Pitfall 2: Adding Blocks That Don't Belong
**What goes wrong:** Adding `<deviation_rules>` to a researcher agent that never deviates, or TodoWrite to an agent that runs for 2 minutes.
**How to avoid:** Only the big 3 (project_context, PATH SETUP, structured_returns) go in ALL agents. Other patterns are domain-specific. Check the "Structural Variants" table above.

### Pitfall 3: Renaming Working Content
**What goes wrong:** When normalizing tags (e.g., `<completion_format>` → `<structured_returns>`), accidentally changing the content inside or breaking references to the tag from other files.
**How to avoid:** Tag rename only — don't modify the content within the tags. Search for references to the old tag name across all files before renaming.

### Pitfall 4: Missing Closing Tags
**What goes wrong:** XML-style tags are easy to mistype. A missing `</structured_returns>` breaks the agent definition.
**How to avoid:** Verify every opening `<tag>` has a matching `</tag>`. The agent file parser relies on these tag boundaries.

### Pitfall 5: Forgetting the Frontmatter estimated_tokens Update
**What goes wrong:** Adding new blocks increases the agent's token footprint but the `estimated_tokens` comment in frontmatter isn't updated.
**How to avoid:** After all changes, re-count lines and update the `# estimated_tokens` comment. Use the formula: lines × ~2.5 tokens/line for rough estimate.

## Code Examples

### Reference `<project_context>` Block (from gsd-github-ci)

```markdown
<project_context>
Before executing, discover project context:

**Project instructions:** Read `./AGENTS.md` if it exists in the working directory. Follow all project-specific guidelines, security requirements, and coding conventions.

**Project skills:** Check `.agents/skills/` directory if it exists:
1. List available skills (subdirectories)
2. Read `SKILL.md` for each skill (lightweight index ~130 lines)
3. Load specific `rules/*.md` files as needed when fixing CI failures
4. Do NOT load full `AGENTS.md` files (100KB+ context cost)
5. Follow skill rules relevant to fix decisions

This ensures project-specific patterns, conventions, and best practices are applied when fixing CI failures.
</project_context>
```

**Adaptation points:** Line 1 intro verb, step 3 "as needed when/during [domain activity]", step 5 domain-specific purpose, closing sentence domain-specific rationale.

### Reference PATH SETUP Block (identical across all agents)

```markdown
**PATH SETUP:** Before running any gsd-tools commands, first resolve:
\`\`\`bash
GSD_HOME=$(ls -d $HOME/.config/*/get-shit-done 2>/dev/null | head -1)
\`\`\`
Then use `$GSD_HOME` in all subsequent commands. Never hardcode the config path.
```

### Reference `<structured_returns>` Block (from gsd-planner — shows multi-format pattern)

```markdown
<structured_returns>

## Planning Complete

\`\`\`markdown
## PLANNING COMPLETE

**Phase:** {phase-name}
**Plans:** {N} plan(s) in {M} wave(s)

### Wave Structure
[...]
\`\`\`

## Checkpoint Reached / Revision Complete

[Additional return formats as needed]

</structured_returns>
```

**Pattern:** Each agent has 2-3 return formats:
1. **Success return** — agent completed its work normally
2. **Blocked/failed return** — agent couldn't complete
3. **Checkpoint return** (if applicable) — agent needs human input

### Executor's Current `<completion_format>` (to be renamed)

```markdown
<completion_format>
\`\`\`markdown
## PLAN COMPLETE

**Plan:** {phase}-{plan}
**Tasks:** {completed}/{total}
**SUMMARY:** {path to SUMMARY.md}

**Commits:**
- {hash}: {message}

**Duration:** {time}
\`\`\`
</completion_format>
```

This becomes `<structured_returns>` with the same content.

## Scope Analysis

### Total Changes Per Agent

| Agent | Changes | Complexity |
|-------|---------|------------|
| gsd-codebase-mapper | Add project_context, PATH SETUP, structured_returns, rename `<process>` tag | Medium — 3 additions, 1 rename |
| gsd-verifier | Add project_context, extract structured_returns from `<output>` | Medium — 2 additions, 1 restructure |
| gsd-debugger | Add project_context | Low — 1 addition |
| gsd-project-researcher | Add project_context | Low — 1 addition |
| gsd-roadmapper | Add project_context | Low — 1 addition |
| gsd-executor | Rename completion_format → structured_returns | Low — 1 tag rename |
| gsd-planner | No changes needed | None |
| gsd-github-ci | No changes needed | None |
| gsd-phase-researcher | No changes needed | None |
| gsd-plan-checker | No changes needed | None |

**Agents needing work:** 6 out of 10
**Agents already consistent:** 4 out of 10
**Estimated total edits:** ~15 discrete changes across 6 files

## Verification Strategy

After all changes, verify with these commands:

```bash
# ACON-01: All 10 agents have <project_context>
grep -l '<project_context>' agents/gsd-*.md | wc -l
# Expected: 10

# ACON-02: All 10 agents have PATH SETUP
grep -l 'PATH SETUP' agents/gsd-*.md | wc -l
# Expected: 10

# ACON-03: codebase-mapper has <structured_returns>
grep '<structured_returns>' agents/gsd-codebase-mapper.md
# Expected: 1 match

# Bonus: All 10 agents have <structured_returns>
grep -l '<structured_returns>' agents/gsd-*.md | wc -l
# Expected: 10

# Bonus: No agent has <completion_format> (renamed)
grep -l '<completion_format>' agents/gsd-*.md | wc -l
# Expected: 0

# Bonus: No agent has <process> tag (renamed to <execution_flow>)
grep -l '<process>' agents/gsd-*.md | wc -l
# Expected: 0
```

## Open Questions

1. **Should `<process>` → `<execution_flow>` rename happen?**
   - What we know: Only gsd-codebase-mapper uses `<process>` — all other 9 agents use `<execution_flow>`
   - What's unclear: Whether downstream tools parse these tag names
   - Recommendation: Rename for consistency — tags are for agent readability, not parsed by tools

2. **Should the executor's `<checkpoint_return_format>` merge into `<structured_returns>`?**
   - What we know: The executor references `<checkpoint_return_format>` by name from within `<checkpoint_protocol>` text
   - What's unclear: Whether merging would break the inline reference
   - Recommendation: Keep `<checkpoint_return_format>` as a separate section but also mention it in `<structured_returns>` (as github-ci does: "See `<checkpoint_return_format>` above")

## Sources

### Primary (HIGH confidence)
- Direct examination of all 10 agent files in `agents/gsd-*.md`
- `grep` verification of tag presence across all files
- Line count analysis via `wc -l`

### Confidence Assessment
All findings are based on direct file examination — no external sources needed for this purely internal structural audit.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external dependencies, purely internal file edits
- Architecture: HIGH — reference patterns exist in 4+ agents already
- Pitfalls: HIGH — based on direct observation of current inconsistencies

**Research date:** 2026-03-08
**Valid until:** Indefinite (internal structural patterns, no version dependencies)
