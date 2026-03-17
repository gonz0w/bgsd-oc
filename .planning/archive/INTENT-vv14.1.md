**Revision:** 24
**Created:** 2026-02-25
**Updated:** 2026-03-17

<objective>
A high-performance agent orchestration engine that maximizes LLM reasoning and coding output per token by shifting administrative work to deterministic CLI operations.
</objective>

<users>
- Software developers using AI coding assistants (OpenCode) for project planning and execution
- Solo developers managing complex multi-phase projects with AI assistance
- The GSD plugin's own development workflow (self-referential: planning GSD improvements using GSD)
</users>

<outcomes>
### v12.1 — Tool Integration & Agent Enhancement (delivered)

**DO-86:** Support ripgrep, fd, jq, yq, bat, gh with unified capability detection and graceful degradation
**DO-87:** Implement smarter agent routing based on task complexity and available agent capabilities
**DO-88:** Create better inter-agent collaboration patterns with shared context and handoff optimization
**DO-89:** Add decision functions for tool selection and multi-phase sequencing
**DO-90:** Improve agent context efficiency through intelligent capability-based filtering

### v13.0 — Closed-Loop Agent Evolution (delivered)

**DO-91:** Enable project-local agent overrides — projects can evolve their own agents without modifying global config
**DO-92:** Create lesson-driven agent improvement — execution experience in lessons.md feeds structured suggestions to improve agents and skills
**DO-93:** Integrate agentskills.io skill discovery — surface relevant skills during milestone workflows so agents grow their capabilities
**DO-94:** Add workflow hooks for agent improvement — verify-work and complete-milestone surface improvement opportunities from patterns
**DO-95:** Enhance research workflow — better multi-source synthesis and quality scoring for improved planning and execution

### v14.0 — LLM Workload Reduction (delivered)

**DO-96:** Compress high-traffic workflows — top 10 workflows reduced by 40%+ tokens without losing behavioral logic
**DO-97:** Pre-compute PLAN.md scaffolds — CLI generates task structure, file paths, and dependency data from roadmap; LLM fills only objectives and verification criteria
**DO-98:** Pre-compute VERIFICATION.md scaffolds — CLI pre-fills success criteria, test results, and requirement status; LLM fills only judgment sections
**DO-99:** Reduce per-invocation context load — workflows load only the sections relevant to their current step, not the full document

### v14.1 — Tool-Aware Agent Routing (active)

**DO-100:** Workflows consume tool routing decisions — file-discovery-mode, search-mode, json-transform-mode decisions alter agent instructions based on available tools
**DO-101:** Agents receive actionable tool guidance — executor/debugger/mapper agents get specific tool commands based on capability level (HIGH/MEDIUM/LOW)
**DO-102:** github-ci uses detect:gh-preflight — structured preflight check replaces raw gh auth status call
**DO-103:** End-to-end validation proves the full chain — detection to enrichment to workflow behavioral change tested
**DO-104:** Dead-weight infrastructure pruned — unused Chain B artifacts simplified or removed
</outcomes>

<criteria>
### v12.1 — Tool Integration & Agent Enhancement (achieved)

**SC-66:** All major CLI tools (ripgrep, fd, jq, yq, bat, gh) detected and available in workflows
**SC-67:** Agent routing improved — 25%+ reduction in context overhead via capability-aware dispatch
**SC-68:** All inter-agent handoffs use shared context patterns — RACI audit validates improvements
**SC-69:** New decision functions for tool selection and phase sequencing with contract tests
**SC-70:** Tool absence gracefully handled — workflows complete with degradation or clear guidance

### v13.0 — Closed-Loop Agent Evolution (achieved)

**SC-71:** A project can override any global agent by placing a file in `.planning/agents/` — verified by enricher detection
**SC-72:** Lessons from verify-work and complete-milestone generate structured agent improvement suggestions
**SC-73:** Users can browse and install skills from agentskills.io during milestone initialization
**SC-74:** Deviation recovery patterns auto-captured as lesson entries after 3-failure recovery cycles
**SC-75:** Research workflow produces quality-scored output linking findings to planning decisions

### v14.0 — LLM Workload Reduction (achieved)

**SC-76:** Top 10 workflows measured before/after with tokenx; average reduction >= 40%
**SC-77:** `plan:generate` produces a PLAN.md scaffold with >= 60% of content pre-filled from CLI data
**SC-78:** `verify:generate` produces a VERIFICATION.md scaffold with success criteria and test data pre-filled
**SC-79:** Workflow compression preserves all behavioral logic — zero regressions in workflow execution

### v14.1 — Tool-Aware Agent Routing (active)

**SC-80:** At least 3 workflows emit different agent instructions when tool_availability changes (tools present vs absent)
**SC-81:** github-ci workflow uses detect:gh-preflight JSON output instead of raw gh auth status
**SC-82:** E2E test validates: mock tool_availability → enricher → workflow output contains tool-specific guidance
**SC-83:** No orphaned decision rules — every computed decision in Chain B has at least one workflow consumer
</criteria>

<constraints>
### Technical
- C-03: All operations are advisory — never block workflow execution
- C-08: Map fallback must still work on Node <22.5 — SQLite is an acceleration layer, not a hard dependency
- C-09: Markdown files remain human-readable and git-trackable — SQLite augments, doesn't hide data
- C-10: Project-local agent improvements must stay inside `.planning/agents/` — never write to `~/.config`

### Business
- C-04: Backward compatible — projects without SQLite work exactly as before via Map fallback
- C-05: Analysis adds value without adding ceremony — no mandatory steps
</constraints>

<health>
### Quantitative
- HM-08: All tests pass with zero failures after each phase
- HM-09: Enricher completes in <50ms with warm SQLite cache
- HM-10: Zero redundant file reads per enrichment pass

### Qualitative
The data layer should be invisible to users — workflows feel faster, decisions are instant, and the human-readable markdown files stay accurate. SQLite is infrastructure, not ceremony.
</health>

<history>
### v14.1 — 2026-03-17
- **Added** outcomes: DO-100 through DO-104 for tool-aware routing, agent guidance, gh-preflight, validation, pruning
- **Added** criteria: SC-80 through SC-83 for v14.1 verification
  - Reason: Milestone v14.1 initiated — making v12.1 tool detection infrastructure actionable in workflows and agents

### v14.0 — 2026-03-17 (milestone complete)
- **Marked delivered** v14.0 outcomes (DO-96 through DO-99) — all delivered
- **Marked achieved** v14.0 criteria (SC-76 through SC-79) — all achieved
  - Reason: Milestone v14.0 complete — 41.1% avg workflow compression, scaffold generation, conditional elision shipped

### v14.0 — 2026-03-16
- **Updated** objective: Sharpened from "data-driven" to "maximizes LLM reasoning and coding output per token by shifting administrative work to deterministic CLI operations"
- **Archived** v13.0 outcomes (DO-91 through DO-95) — all delivered
- **Archived** v13.0 criteria (SC-71 through SC-75) — all achieved
- **Added** outcomes: DO-96 through DO-99 for workflow compression, scaffold generation, context reduction
- **Added** criteria: SC-76 through SC-79 for v14.0 verification
  - Reason: Milestone v14.0 initiated — LLM workload reduction, shifting admin work to CLI

### v13.0 — 2026-03-15
- **Added** outcomes: DO-91 through DO-95 for closed-loop agent evolution
- **Added** criteria: SC-71 through SC-75 for v13.0 verification
- **Added** constraint: C-10 (local agents never modify global config)
  - Reason: Milestone v13.0 initiated — closed-loop learning, local agent overrides, skill discovery

### v12.1 — 2026-03-15
- **Added** outcomes: DO-86 through DO-90 for tool integration, agent routing, collaboration
- **Added** criteria: SC-66 through SC-70 for v12.1 verification
  - Reason: Milestone v12.1 initiated

### v12.0 — 2026-03-15
- **Archived** all v12.0 outcomes (DO-79 through DO-85) — all delivered
  - Reason: Milestone v12.0 complete — SQLite-first data layer shipped
- **Archived** all v12.0 criteria (SC-58 through SC-65) — all achieved
  - Reason: Milestone v12.0 complete

### v12.0 — 2026-03-14
- **Updated** objective: Shifted from internal quality/housekeeping to SQLite-first data layer architecture
- **Added** outcomes: DO-79 through DO-85 for structured tables, persistence, memory migration, enricher acceleration, decisions
- **Added** criteria: SC-58 through SC-65 for v12.0 verification

### v11.4 — 2026-03-13
- **Reset** objective: Shifted from LLM offloading to internal quality and planning debt cleanup
- **Archived** outcomes: DO-20 through DO-71 (44 outcomes delivered across v1.0-v11.3)
- **Archived** criteria: SC-01 through SC-50 (35 criteria from prior milestones)

(See `.planning/archive/INTENT-vv12.0.md` for full history)
</history>
<!-- Highest outcome ID: DO-104 -->
<!-- Highest criteria ID: SC-83 -->
