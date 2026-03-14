**Revision:** 20
**Created:** 2026-02-25
**Updated:** 2026-03-13

<objective>
A well-maintained, reliable agent orchestration engine. This milestone focuses on internal quality: stabilizing the test suite, cleaning accumulated planning debt, auditing CLI command routing, and resetting the intent/outcomes tracking system — ensuring the foundation is solid before building new features.
</objective>

<users>
- Software developers using AI coding assistants (OpenCode) for project planning and execution
- Solo developers managing complex multi-phase projects with AI assistance
- The GSD plugin's own development workflow (self-referential: planning GSD improvements using GSD)
</users>

<outcomes>
- DO-72 [P1]: Test suite fully green — all 1014 tests pass with zero failures (fix Bun runtime banner JSON parse errors)
- DO-73 [P1]: INTENT.md is clean and current — only active outcomes tracked, completed outcomes archived in history
- DO-74 [P1]: CLI command routing verified — every registered command resolves correctly, missing routes identified and fixed, unused commands removed
- DO-75 [P1]: Planning artifacts normalized — MILESTONES.md, PROJECT.md cleaned of formatting inconsistencies and cruft
- DO-76 [P2]: Out-of-scope list reviewed and updated — stale items removed, new exclusions documented with rationale
- DO-77 [P2]: Constraints and decisions audited — resolved items archived, current items verified as still relevant
- DO-78 [P2]: Health metrics updated to reflect current baselines (not v7.1 references from 12 milestones ago)
</outcomes>

<criteria>
- SC-51: `npm test` runs with zero failures across all test suites
- SC-52: INTENT.md has fewer than 15 active outcomes, all relevant to current or near-future work
- SC-53: Every slash command in `commands/` directory has a working route in the CLI router
- SC-54: No orphaned command files (commands that reference non-existent CLI operations)
- SC-55: PROJECT.md has no stale version references or broken details/summary blocks
- SC-56: MILESTONES.md entries have consistent formatting (checkmarks, dates, archives)
- SC-57: Out-of-scope section reflects actual current exclusions, not historical ones
</criteria>

<constraints>
### Technical
- C-03: All operations are advisory — never block workflow execution
- C-07: Test fixes must not change test behavior — only fix infrastructure issues (Bun banner)

### Business
- C-04: Backward compatible — projects without codebase analysis work exactly as before
- C-05: Analysis adds value without adding ceremony — no mandatory steps
</constraints>

<health>
### Quantitative
- HM-06: All 1014 tests pass with zero failures after each phase
- HM-07: CLI command routing has zero broken routes

### Qualitative
The planning system should be lean and accurate — every tracked outcome is actionable, every command route works, and the test suite provides reliable signal. Technical debt should decrease, not accumulate.
</health>

<history>
### v11.4 — 2026-03-13
- **Reset** objective: Shifted from LLM offloading to internal quality and planning debt cleanup
  - Reason: Milestone v11.4: Housekeeping & Stabilization — 44 outcomes had accumulated across 18 milestones
- **Archived** outcomes: DO-20 through DO-71 (44 outcomes delivered across v1.0-v11.3) — moved to completed status
  - Reason: Milestone v11.4: Full intent reset — all prior outcomes were delivered or no longer relevant
- **Archived** criteria: SC-01 through SC-50 (35 criteria from prior milestones) — all achieved or superseded
  - Reason: Milestone v11.4: Clean slate for measurable success criteria
- **Added** outcomes: DO-72 through DO-78 for test stabilization, planning cleanup, and command audit
  - Reason: Milestone v11.4: Fresh outcomes specific to housekeeping scope
- **Added** criteria: SC-51 through SC-57 for v11.4 verification
  - Reason: Milestone v11.4: Measurable criteria for cleanup work
- **Removed** C-06 (workflow prompt simplification) — achieved in v11.3
  - Reason: No longer needed as an active constraint
- **Added** C-07 (test fixes preserve behavior) — guard against test changes masking real issues
  - Reason: Milestone v11.4: Ensure test fixes are infrastructure-only

### v9.2 — 2026-03-13
- **Modified** objective: Shift from performance benchmarking to LLM offloading
- **Added** DO-68 through DO-71 for LLM offloading audit and implementation
- **Added** C-06 for workflow prompt modification

### v11.1 — 2026-03-11
- **Added** DO-60 through DO-62 for command execution and polish

### v10.0 — 2026-03-10
- **Added** DO-49 through DO-59 for agent intelligence and UX

### v9.3 — 2026-03-10
- **Added** DO-46 through DO-48 for CLI tool integrations and Bun runtime

### v9.0 — 2026-03-09
- **Added** DO-39 through DO-45 for embedded plugin experience
- **Added** SC-31 through SC-36 for plugin verification

### v8.3 — 2026-03-08
- **Added** DO-37, DO-38 for skills architecture and test suite health
- **Added** SC-28 through SC-30 for agent quality

### v11.2 — 2026-03-12
- **Added** DO-63 through DO-67 for code audit and performance

### v8.2 — 2026-03-06
- **Added** DO-33 through DO-36 for cleanup and validation
- **Added** SC-24 through SC-27 for cleanup criteria

### v7.1 — 2026-03-02
- **Modified** objective: Added performance and agent architecture focus
</history>
