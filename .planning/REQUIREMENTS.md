# Requirements

**Milestone:** v18.1 Greenfield Cleanup & CLI Simplification
**Generated:** 2026-03-31
**Status:** Roadmapped

## Goal

Make bGSD easier to maintain and safer for agents to modify by removing compatibility-era drag and simplifying the CLI's most overloaded architecture without changing supported behavior.

## Requirement Categories

### AUDIT - Simplification Audit

- [x] **AUDIT-01** Maintainer can review a milestone audit that identifies dead code, duplication, simplification opportunities, concurrency risks, error-handling gaps, and maintainability hotspots with file-level references.
- [x] **AUDIT-02** Maintainer can prioritize cleanup work by blast radius and safe order of operations so low-risk deletions land before risky refactors.

### CLEAN - Greenfield Compatibility Cleanup

- [x] **CLEAN-01** Maintainer can remove migration-only commands and helpers that exist only for legacy installs, storage transitions, or obsolete local-state upgrades.
- [x] **CLEAN-02** Maintainer can remove planning and config normalization paths that only support superseded file shapes while current canonical `.planning/` artifacts still parse and validate.
- [x] **CLEAN-03** Users see docs, templates, and help text that match the supported JJ/workspace-first model rather than stale worktree-era or compatibility-era guidance.

### CLI - Command-System Simplification

- [x] **CLI-01** Maintainer can change command dispatch, help, aliases, and discovery from a clearer canonical definition instead of parallel registries that drift.
- [x] **CLI-02** Maintainer can change router parsing behavior without editing a god-object full of repeated hand-written flag scans and unrelated startup logic.
- [ ] **CLI-03** Maintainer can work within smaller command subdomains instead of multi-thousand-line bucket modules and ambient output globals.

### SAFE - Behavior Preservation & Hardening

- [ ] **SAFE-01** Users can run supported planning and settings workflows after cleanup with regression coverage proving canonical command routes still work.
- [ ] **SAFE-02** Maintainers can eliminate silent error swallowing, unnecessary async or control-flow indirection, and unguarded shared mutable state on touched cleanup paths before milestone close.
- [x] **SAFE-03** Users see help and workflow guidance that match the real supported command surface after cleanup, with stale aliases or contradictory guidance removed.

## Future Requirements

- Multi-user repo coordination with explicit ownership, lease, and handoff semantics.
- Bun-first migration for runtime, build, packaging, and test workflows.
- Workflow acceleration follow-up that is not directly required by cleanup or simplification work.
- Deeper per-agent ambient UX only if later signal quality justifies it.

## Out of Scope

- Shipping new end-user features beyond cleanup-driven clarity and reliability.
- Bun-first runtime replacement or package-manager migration.
- Multi-user repo coordination, GitHub ownership flows, or team lock semantics.
- Rewriting healthy runtime resilience fallbacks that still protect supported current environments.
- Broad OpenCode core UI or chat behavior changes.

## Traceability

| Requirement | Planned Phase | Source |
|-------------|---------------|--------|
| AUDIT-01 | Phase 173 | User simplification review prompt plus CLI simplification PRD |
| AUDIT-02 | Phase 173 | User simplification review prompt plus cleanup sequencing need |
| CLEAN-01 | Phase 174 | Greenfield cleanup PRD - migration-only commands and helpers |
| CLEAN-02 | Phase 174 | Greenfield cleanup PRD - legacy planning and config normalization |
| CLEAN-03 | Phase 175 | Greenfield cleanup PRD - stale guidance and worktree-era docs |
| CLI-01 | Phase 175 | CLI simplification PRD - canonical command definition |
| CLI-02 | Phase 175 | CLI simplification PRD - router simplification |
| CLI-03 | Phase 178 | CLI simplification PRD - smaller command subdomains and less ambient state |
| SAFE-01 | Phase 178 | Both PRDs - preserve supported behavior with regression proof |
| SAFE-02 | Phase 178 | User simplification review prompt - hardening touched cleanup paths |
| SAFE-03 | Phase 177 | Both PRDs - align help, workflows, and supported surface |
