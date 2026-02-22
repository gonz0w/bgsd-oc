# Roadmap: GSD Plugin Performance & Quality Improvement

## Milestones

- ✅ **v1.0 Performance & Quality** — Phases 1-5 (shipped 2026-02-22)
- 🔵 **v1.1 Context Reduction & Tech Debt** — Phases 6-9 (active)

## Phases

<details>
<summary>✅ v1.0 Performance & Quality (Phases 1-5) — SHIPPED 2026-02-22</summary>

- [x] Phase 1: Foundation & Safety Nets (4/4 plans) — completed 2026-02-22
- [x] Phase 2: Error Handling & Hardening (2/2 plans) — completed 2026-02-22
- [x] Phase 3: Developer Experience & Discoverability (3/3 plans) — completed 2026-02-22
- [x] Phase 4: Build System & Module Split (3/3 plans) — completed 2026-02-22
- [x] Phase 5: Performance & Polish (2/2 plans) — completed 2026-02-22

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🔵 v1.1 Context Reduction & Tech Debt (In Progress)

**Milestone Goal:** Reduce token/context consumption across all GSD layers (workflows, CLI output, planning docs, research files) by 30%+ while resolving remaining tech debt.

- [x] **Phase 6: Token Measurement & Output Infrastructure** (3 plans) - Accurate token counting, workflow baselines, and `--fields` flag for all commands — completed 2026-02-22
- [ ] **Phase 7: Init Command Compaction** - `--compact` flag for init commands and context manifests for agent loading
- [ ] **Phase 8: Workflow & Reference Compression** - Rewrite workflows for 30%+ reduction, deduplicate shared content, add selective section loading
- [ ] **Phase 9: Tech Debt Cleanup** - Fix broken test, complete --help coverage, create plan templates

## Phase Details

### Phase 6: Token Measurement & Output Infrastructure
**Goal**: Developers can accurately measure token consumption across all GSD layers and selectively filter CLI output fields
**Depends on**: Phase 5 (v1.0 complete)
**Requirements**: MEAS-01, MEAS-02, MEAS-03, CLIP-01
**Success Criteria** (what must be TRUE):
  1. Running `context-budget` on any workflow file returns accurate token estimates (within 10% of BPE ground truth) instead of the broken `lines * 4` heuristic
  2. User can run a baseline measurement command that reports token counts for all 32 workflow invocations
  3. User can run a before/after comparison showing token delta per workflow (enabling proof of 30% target)
  4. Any JSON-outputting command accepts `--fields name,status,phase` and returns only those fields
**Plans**:
  1. Plan 01 (Wave 1): Token estimation library + --fields flag [MEAS-01, CLIP-01]
  2. Plan 02 (Wave 2): Workflow baseline measurement [MEAS-02]
  3. Plan 03 (Wave 2): Before/after comparison [MEAS-03]

### Phase 7: Init Command Compaction
**Goal**: Init commands return significantly smaller payloads when agents don't need full data, with manifests guiding what to load
**Depends on**: Phase 6 (needs `--fields` infrastructure and baselines for measurement)
**Requirements**: CLIP-02, CLIP-03
**Success Criteria** (what must be TRUE):
  1. All 12 init commands accept `--compact` flag returning essential-only data (38-50% smaller than full output, measured by token count)
  2. Init commands in `--compact` mode include a context manifest telling agents which files and sections to load next
  3. Existing workflows continue to work identically without `--compact` flag (backward compatible)
**Plans**: TBD

### Phase 8: Workflow & Reference Compression
**Goal**: Workflow prompts and reference files consume significantly fewer tokens while preserving agent behavior quality
**Depends on**: Phase 7 (compressed workflows should use `--compact` init calls and `--fields` filtering)
**Requirements**: WKFL-01, WKFL-02, WKFL-03, WKFL-04
**Success Criteria** (what must be TRUE):
  1. Large reference files are split into loadable sections so agents only load what they need for the current task
  2. CLI supports `extractSections()` — selective markdown section extraction by header name from any file
  3. Repeated boilerplate across workflow files is consolidated into shared references (measurable line-count reduction across 43 workflow files)
  4. Research output files support summary/detail tiers — agents load compact summaries by default, full detail on demand
  5. Before/after token measurement shows 30%+ reduction averaged across the top 6 workflows by size
**Plans**: TBD

### Phase 9: Tech Debt Cleanup
**Goal**: Pre-existing tech debt items from v1.0 are resolved — broken test fixed, help coverage complete, plan templates created
**Depends on**: Nothing (independent of context reduction work; can execute in parallel with any phase)
**Requirements**: DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):
  1. `npm test` passes with zero failures (the `roadmap analyze` test that currently expects 50% but gets 33% is fixed)
  2. Running `--help` on any of the 79 commands produces usage text (all 36 remaining commands have help entries)
  3. Plan template files exist in `templates/plans/` for common patterns (at minimum: ash-resource, pulsar-function, go-service)
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Safety Nets | v1.0 | 4/4 | Complete | 2026-02-22 |
| 2. Error Handling & Hardening | v1.0 | 2/2 | Complete | 2026-02-22 |
| 3. Developer Experience & Discoverability | v1.0 | 3/3 | Complete | 2026-02-22 |
| 4. Build System & Module Split | v1.0 | 3/3 | Complete | 2026-02-22 |
| 5. Performance & Polish | v1.0 | 2/2 | Complete | 2026-02-22 |
| 6. Token Measurement & Output Infrastructure | v1.1 | 3/3 | Complete | 2026-02-22 |
| 7. Init Command Compaction | v1.1 | 0/? | Not started | - |
| 8. Workflow & Reference Compression | v1.1 | 0/? | Not started | - |
| 9. Tech Debt Cleanup | v1.1 | 0/? | Not started | - |
