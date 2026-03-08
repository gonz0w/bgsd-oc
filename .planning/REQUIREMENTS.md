# Requirements: bGSD Plugin v8.3

**Defined:** 2026-03-08
**Core Value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance

## v8.3 Requirements

Requirements for v8.3 Agent Quality & Skills milestone. Each maps to roadmap phases.

### GitHub CI Agent Quality

- [ ] **GHCI-01**: GitHub CI agent has `<structured_returns>` section with CHECKPOINT REACHED and CI COMPLETE formats matching executor/planner patterns
- [ ] **GHCI-02**: GitHub CI agent has `<project_context>` discovery block (AGENTS.md + project skills check)
- [ ] **GHCI-03**: GitHub CI agent has `<deviation_rules>` framework for auto-fix vs escalate decisions on check failures
- [ ] **GHCI-04**: GitHub CI agent records state updates (metrics, decisions, session info) via gsd-tools commands
- [ ] **GHCI-05**: GitHub CI agent uses TodoWrite for step-by-step progress tracking during execution
- [ ] **GHCI-06**: GitHub CI workflow (`/bgsd-github-ci`) updated with proper orchestration gates and structured spawning

### Agent Consistency

- [ ] **ACON-01**: All 10 agents have `<project_context>` discovery block (add to 6 missing: verifier, debugger, roadmapper, project-researcher, codebase-mapper, github-ci)
- [ ] **ACON-02**: All 10 agents have PATH SETUP block (add to codebase-mapper)
- [ ] **ACON-03**: codebase-mapper agent has proper `<structured_returns>` section matching other agent patterns

### Skills Architecture

- [ ] **SKIL-01**: OpenCode skills created from shared reference content (checkpoints, goal-backward, research patterns, commit protocol, deviation rules, state updates)
- [ ] **SKIL-02**: Agent definitions slimmed by replacing duplicated inline content with skill load instructions
- [ ] **SKIL-03**: deploy.sh updated to include skills/ directory in deployment manifest
- [ ] **SKIL-04**: Skill descriptions tuned for accurate agent loading (tested for false positive/negative load rates)

### Test Health

- [ ] **TEST-01**: config-migrate test failures resolved
- [ ] **TEST-02**: compact test failures resolved
- [ ] **TEST-03**: codebase-impact test failures resolved
- [ ] **TEST-04**: codebase ast CLI handler test failures resolved

## Future Requirements

### Agent Quality Enhancements

- **AQEN-01**: Unified checkpoint protocol shared across all applicable agents via standardized reference
- **AQEN-02**: Agent manifest validation CLI command (verify frontmatter completeness)
- **AQEN-03**: Token budget measurement for skills (empirical validation of savings)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Agent consolidation (reduce agent count) | v8.0 achieved 11→9; current 9 is clean per RACI audit |
| New agent creation | Cap at 9 roles; intelligence = data, not agents |
| PATH SETUP extraction to skill | Bootstrap sequence — must execute before tool calls (pitfall research) |
| Mandatory Initial Read extraction | Same bootstrap timing concern as PATH SETUP |
| Agent behavioral changes | This milestone is structural quality, not behavioral changes |
| Skills for project-local use | Global skills only; project-local skills are out of scope |

## Traceability

| Requirement | Phase | Status | Test Command |
|-------------|-------|--------|--------------|
| GHCI-01 | TBD | Pending | grep structured_returns agents/gsd-github-ci.md |
| GHCI-02 | TBD | Pending | grep project_context agents/gsd-github-ci.md |
| GHCI-03 | TBD | Pending | grep deviation_rules agents/gsd-github-ci.md |
| GHCI-04 | TBD | Pending | grep verify:state agents/gsd-github-ci.md |
| GHCI-05 | TBD | Pending | grep TodoWrite agents/gsd-github-ci.md |
| GHCI-06 | TBD | Pending | cat commands/bgsd-github-ci.md |
| ACON-01 | TBD | Pending | grep -l project_context agents/gsd-*.md \| wc -l |
| ACON-02 | TBD | Pending | grep PATH.SETUP agents/gsd-codebase-mapper.md |
| ACON-03 | TBD | Pending | grep structured_returns agents/gsd-codebase-mapper.md |
| SKIL-01 | TBD | Pending | ls skills/gsd-*/SKILL.md |
| SKIL-02 | TBD | Pending | wc -l agents/gsd-*.md (reduced line counts) |
| SKIL-03 | TBD | Pending | grep skills deploy.sh |
| SKIL-04 | TBD | Pending | grep description skills/gsd-*/SKILL.md |
| TEST-01 | TBD | Pending | npm test -- --grep config-migrate |
| TEST-02 | TBD | Pending | npm test -- --grep compact |
| TEST-03 | TBD | Pending | npm test -- --grep codebase-impact |
| TEST-04 | TBD | Pending | npm test -- --grep "codebase ast" |

**Coverage:**
- v8.3 requirements: 17 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 17

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after initial definition*
