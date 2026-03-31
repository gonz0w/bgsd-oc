# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-30)

**Core value:** Manage and deliver high-quality software with high-quality documentation, while continuously reducing token usage and improving performance.
**Current focus:** v17.1 shipped — ready to define the next milestone.

## Current Position

**Phase:** 167
**Current Plan:** Not started
**Total Plans in Phase:** 2
**Status:** Ready for next milestone
**Last Activity:** 2026-03-30

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 338 (through Phase 167 P02)
- Average duration: ~13 min/plan (stable across recent milestones)
- Total execution time: ~51.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 158 | 15 | 15 | 4.3 min |
| 159 | 12 | 12 | 7.0 min |
| 160 | 2 | 2 | 5.0 min |
| 161 | 1 | 1 | 6.0 min |
| 162 | 2 | 2 | 7.0 min |
| 163 | 1 | 1 | 3.0 min |
| 164 | 1 | 1 | 8.0 min |
| 165 | 1 | 1 | 13.0 min |
| 166 | 1 | 1 | 11.0 min |
| 167 | 2 | 2 | 9.5 min |

**Recent Trend:**
- Last shipped milestone: v17.1 completed 5 phases (163-167)
- Trend: Stable
| Phase 163 P02 | 9 min | 2 tasks | 4 files |
| Phase 163 P04 | 10 min | 2 tasks | 6 files |
| Phase 163 P05 | 13 min | 2 tasks | 6 files |
| Phase 163 P03 | 8 min | 2 tasks | 4 files |
| Phase 164 P01 | 8 min | 2 tasks | 5 files |
| Phase 164 P02 | 10 min | 2 tasks | 6 files |
| Phase 164-shared-planning-indexes-metadata-truthfulness P03 | 4 min | 2 tasks | 8 files |
| Phase 165 P01 | 13 min | 3 tasks | 6 files |
| Phase 165 P02 | 11 min | 3 tasks | 7 files |
| Phase 165 P03 | 10 min | 3 tasks | 9 files |
| Phase 166 P01 | 11 min | 3 tasks | 10 files |
| Phase 166 P02 | 8 min | 3 tasks | 10 files |
| Phase 167 P01 | 4 min | 3 tasks | 10 files |
| Phase 167 P02 | 15 min | 3 tasks | 10 files |

## Accumulated Context

### Decisions

- [Phase 147]: security:scan emits one normalized finding contract with confidence bands and verification metadata — Later engines and /bgsd-security can share one deterministic schema instead of inventing engine-specific output.
- [Phase 147]: security exclusions require exact rule_id plus normalized path and optional fingerprint with reason and expiry — Narrow suppressions stay auditable and expired exclusions surface as warnings instead of silently hiding findings.
- [Phase 147]: OWASP SEC-01 coverage is tracked through explicit category metadata with direct-rule vs delegated-family notes. — This keeps Phase 147 claims honest while dependency-backed A06 coverage lands in the next plan.
- [Phase 147-security-audit-workflow]: Secrets now use finding fingerprints plus redacted evidence for auditable, narrow suppressions
- [Phase 147-security-audit-workflow]: Dependency findings now grade confidence by evidence quality and use advisory-backed remediation guidance
- [Phase 147-security-audit-workflow]: `/bgsd-security` now bootstraps through `init:security` so workflow model selection and active phase metadata come from CLI context.
- [Phase 147-security-audit-workflow]: The security workflow treats `security:scan` JSON as the deterministic source of findings and keeps medium-confidence results explicitly labeled after verifier assessment.
- [Phase 148-review-readiness-release-pipeline]: Readiness reports missing scripts or artifacts as explicit skip results and only marks executed failing checks as fail
- [Phase 148-review-readiness-release-pipeline]: review:readiness evaluates TODOs and changelog freshness from the current git diff while staying advisory-only
- [Phase 148-review-readiness-release-pipeline]: Release analysis now uses the latest semver tag as the primary baseline and falls back to package.json only when no prior tag exists
- [Phase 148-review-readiness-release-pipeline]: Ambiguous release history now returns an explicit patch fallback with advisory reasons instead of guessing a larger bump
- [Phase 148-review-readiness-release-pipeline]: release:changelog previews grouped notes from summaries plus conventional commits without mutating CHANGELOG.md at runtime
- [Phase 148-review-readiness-release-pipeline]: Release mutations now persist `.planning/release-state.json` step-by-step instead of attempting magical rollback.
- [Phase 148-review-readiness-release-pipeline]: `release:pr` preflights gh usability and authentication before any PR-specific mutation so GitHub access failures stop with explicit resume guidance.
- [Phase 148-review-readiness-release-pipeline]: Automatic release cleanup is limited to obviously safe local artifacts like an unpushed tag; meaningful version and changelog edits are preserved for resume.
- [Phase 148-review-readiness-release-pipeline]: `/bgsd-release` now bootstraps through `init:release` so workflow metadata and resume paths come from CLI state.
- [Phase 148-review-readiness-release-pipeline]: The release workflow stays dry-run-first with one explicit confirmation gate before `release:tag` or `release:pr`.
- [Phase 149]: TDD contract authority now lives in skills/tdd-execution/SKILL.md so workflows, templates, and help defer to one canonical source
- [Phase 149]: Phase 149 TDD wording stops at contract alignment; semantic-gate depth and end-to-end proof remain deferred to Phase 150
- [Phase 149]: Planner and readers now normalize TDD decisions deterministically and persist the canonical contract on read — Omitted or legacy TDD metadata should no longer leave plan selection to silent discretion or in-memory-only normalization
- [Phase 149]: Omitted TDD hints now surface explicit informational checker output instead of silent skips
- [Phase 149]: Required, recommended, and omitted TDD hints now share one blocker-warning-info ladder across checker, workflow, and roadmap guidance
- [Phase 149]: Phase 149 TDD guidance remains limited to selection and rationale severity; execute:tdd semantic enforcement stays deferred to Phase 150
- [Phase 150-tdd-execution-semantics-proof]: `execute:tdd` now validates the exact declared target command for each TDD phase — RED must prove missing behavior without accepting missing commands, while GREEN and REFACTOR stay targeted-only by default
- [Phase 150-tdd-execution-semantics-proof]: TDD validators now emit structured proof payloads — Exact target command, exit code, and matched evidence snippets provide stable audit data without brittle root-cause matching
- [Phase 150-tdd-execution-semantics-proof]: Summary generation now audits TDD stages from GSD-Phase trailers plus optional proof sidecars — This gives reviewers one stable path for commit-level and validator-level TDD evidence without breaking non-TDD summaries
- [Phase 150-tdd-execution-semantics-proof]: TDD summaries now require explicit REFACTOR proof when a refactor commit exists — Phase 150 needs REFACTOR to be auditable instead of an optional afterthought
- [Phase 150-tdd-execution-semantics-proof]: End-to-end TDD proof uses temp repos with real validator gates plugin commits and generated summaries — Fixture-backed execution catches audit-chain regressions that isolated validator tests would miss
- [Phase 151]: phase:snapshot now returns roadmap metadata, artifact paths, and plan inventory in one additive payload — Shared snapshot data removes repeated discovery calls for common phase reads
- [Phase 151]: phase:snapshot falls back to roadmap-backed metadata when the phase directory does not exist yet — Roadmap-only phases must degrade gracefully instead of forcing a second discovery path
- [Phase 151]: Hot init commands now derive shared phase metadata and artifact paths from phase:snapshot instead of rescanning phase directories
- [Phase 151]: phase:snapshot now carries UAT artifact paths so snapshot-backed init flows preserve additive-safe file outputs
- [Phase 151]: verify:state complete-plan now batches durable plan finalization with explicit tail recovery warnings — One command keeps progress, position, and decision writes together while leaving metrics and continuity recoverable
- [Phase 151]: Default discuss acceleration now uses low-risk defaults in the main workflow instead of a separate fast-mode UX
- [Phase 151]: verify-work keeps one-at-a-time as default and only uses grouped summaries for opt-in clean-path batches with exact failing-group drill-down
- [Phase 152 P01]: `util:phase-plan-index` now validates fresh PlanningCache plan rows before use and rebuilds stale or unavailable entries from markdown through write-through fallback.
- [Phase 152]: Phase handoff resume state now derives from versioned per-step artifacts instead of a pointer file — Latest-valid selection keeps same-phase replacement deterministic and fail-closed
- [Phase 152]: Init entrypoints now expose one shared resume summary contract with exact resume inspect restart options — Downstream workflows can consume artifact-derived resume metadata without reconstructing continuation state from STATE.md or partial markdown artifacts.
- [Phase 152]: Downstream continuation now uses resume_summary and latest-valid handoff state while keeping standalone entrypoints additive. — This keeps research, plan, execute, and verify fail-closed for invalid chains without breaking one-off command use.
- [Phase 152]: Discuss owns clean-start restart while transition keeps auto-advance additive through explicit resume summaries. — FLOW-08 needs fresh-context chaining without silent resume or a second orchestration model.
- [Phase 153]: Production workflow steps now persist their own durable phase handoffs through shared payload defaults — Fresh-context chaining no longer depends on manual run_id/source_fingerprint seeding
- [Phase 153]: Resume freshness now hashes canonical phase inputs at init entrypoints — Real stale-source blocking now compares production handoffs to stable roadmap and phase-planning artifacts while ignoring unrelated STATE churn
- [Phase 153]: Repairing stale handoffs now requires refreshing artifacts against current planning inputs — Latest-valid inspection and restart guidance remain available, but resume stays fail-closed until handoffs are rewritten with the current expected fingerprint
- [Phase 153-production-handoff-persistence-resume-freshness]: Locked the production handoff chain with one composed regression and aligned workflow wording to current expected-fingerprint freshness semantics. — Phase 153 needed a final proof of real production behavior plus narrow wording cleanup that matches the shipped runtime contract.
- [Phase 154]: Production TDD execution now writes canonical TDD-AUDIT sidecars from validator proof — One shared write path lets real type:tdd runs self-produce durable audit artifacts for summary generation
- [Phase 154]: Phase handoff writes now preserve discovered TDD audit metadata across same-run refreshes — Execute and verify handoffs keep deterministic proof references without making proof mandatory for non-TDD flows
- [Phase 154]: Locked end-to-end fresh-context proof delivery with additive resume-summary proof metadata. — Phase 154 needed one production-style regression plus narrow inspection and wording updates to close TDD-06 and FLOW-08 without reopening earlier TDD or freshness semantics.
- [v17.0 Roadmap]: Split milestone into 6 phases (155-160): JJ execution gate, JJ workspace recovery, planning context cascade, command family consolidation, help/reference integrity, and phase intent alignment verification
- [v17.0 Roadmap]: Grouped JJ planner awareness with milestone/effective-intent injection because both change planning context for roadmap and plan design rather than the execution backend itself
- [v17.0 Roadmap]: Dynamic model configuration (DO-117) remains deferred and outside v17.0 scope while JJ-first execution, command simplification, and intent cascade ship together
- [Phase 155]: Execution init is now JJ-gated and workspace-first, and legacy worktree config fails with explicit migration guidance.
- [Phase 155-jj-execution-gate-workspace-lifecycle]: Promoted execution isolation to a top-level workspace command family and removed execute:worktree as a supported surface.
- [Phase 155-jj-execution-gate-workspace-lifecycle]: Kept workspace reconcile validation-only in Phase 155 so stale recovery and op-log UX stay deferred to Phase 156.
- [Phase 155-jj-execution-gate-workspace-lifecycle]: Execution-init regression fixtures now initialize JJ explicitly so broad verification exercises the supported gate path.
- [Phase 156-jj-parallel-waves-recovery-coverage P01]: Workspace commands now classify healthy, stale, and divergent JJ workspaces with op-log diagnostics and preview-first recovery metadata.
- [Phase 156-jj-parallel-waves-recovery-coverage P01]: Cleanup retains recovery-needed workspaces instead of deleting stale or conflicted breadcrumbs during inspection and recovery work.
- [Phase 156 P03]: Shipped config templates now expose only supported workspace settings and locked recovery-first JJ workspace guidance with contract tests
- [Phase 156-jj-parallel-waves-recovery-coverage]: Execute init now exposes live managed workspace inventory with per-plan tracked metadata.
- [Phase 156-jj-parallel-waves-recovery-coverage]: Execute-phase parallel waves now report healthy versus recovery-needed workspaces explicitly so unaffected plans can reconcile independently.
- [Phase 157 P01]: `effective_intent` now layers project intent with optional milestone and phase signals while warning explicitly when lower layers are missing.
- [Phase 157 P01]: Phase-local intent is extracted from existing `*-CONTEXT.md` artifacts instead of adding a separate top-level phase intent file.
- [Phase 157]: Planning init surfaces now inject layered effective_intent and capability-only JJ workspace guidance. — Roadmapper, planner, and verify-work consumers need compact purpose plus safe parallelism context without live workspace inventory or automatic routing.
- [Phase 157]: Scoped planning and alignment agents now keep effective_intent, and cached agent contexts mirror the same phase-aware contract. — Phase 157 needed scoped agent payloads and cached manifests to stay aligned so compact intent survives agent filtering without verifier workspace leakage.
- [Phase 157]: Locked milestone intent ownership and effective_intent-first planning workflows — Keeps project intent stable while planning surfaces use compact context and advisory JJ capability guidance
- [Phase 157]: Added the active v17.0 milestone intent artifact and normalized Phase 157 must_haves metadata to verifier-readable YAML. — Phase 157 verification required a real milestone strategy layer and parseable artifact/key-link metadata so effective_intent and must_haves checks reflect the shipped work.
- [Phase 158]: Established canonical quick, plan, and inspect wrapper baseline with manifest-backed parity coverage. — Phase 158 needs canonical wrapper entrypoints and shared inventory before legacy command repointing can proceed safely.
- [Phase 158]: Locked /bgsd-inspect as the canonical read-only diagnostics hub and recast covered legacy commands as compatibility aliases. — This keeps canonical and legacy inspect entrypoints behaviorally aligned while preserving the strict read-only family boundary for follow-on migration slices.
- [Phase 158]: Centralized planning-family routing under /bgsd-plan and converted legacy planning entrypoints into compatibility shims. — One canonical planning contract keeps alias behavior aligned now while leaving roadmap gap and todo expansion for later Phase 158 slices.
- [Phase 158]: Planning-family parity coverage stays focused on alias routing and normalization contracts — Phase 158 needed direct CMD-03 regression proof for roadmap gaps and todo aliases without expanding into Phase 159 help-surface auditing
- [Phase 158]: Kept settings as a separate canonical family and taught touched surfaces to prefer canonical family names — Preserves the locked plan-versus-inspect-versus-settings boundaries while deferring the broader reference audit to Phase 159
- [Phase 158]: Canonical workflow follow-ups now prefer /bgsd-plan phase and /bgsd-plan gaps. — Keeps the locked planning-family map intact while removing legacy-preferred next-step guidance from touched workflow surfaces.
- [Phase 158]: Canonical docs now teach /bgsd-plan subcommands and /bgsd-settings profile first. — Phase 158 needed user-facing docs to prefer the canonical command families while keeping legacy names as compatibility-only notes.
- [Phase 158]: Plugin runtime guidance now prefers /bgsd-plan phase in missing-plan and next-phase notices, and plugin.js is rebuilt immediately after source wording changes to keep shipped runtime text aligned. — Closes the plugin-runtime slice of CMD-03 without changing alias compatibility wiring.
- [Phase 158]: Canonical planning-family guidance now drives research and resume-summary next-command text — Kept handoff behavior unchanged while removing stale legacy guidance from surfaced next steps
- [Phase 158]: Locked plugin runtime guidance regressions on both canonical planning-family surfaces. — Focused plugin tests now protect the missing-plan tool message and idle-validator next-step wording introduced in Plan 11.
- [Phase 158]: Canonical command-family guidance now covers the remaining Phase 158 docs, workflow, and plugin advisory surfaces — Closed the last CMD-03 guidance gap by making canonical planning and settings commands primary everywhere touched in this plan
- [Phase 158]: Canonical docs now cover the remaining architecture, planning-system, agents, expert-guide, configuration, and troubleshooting evidence surfaces. — Plan 14 finished the previously cited docs gap with focused regression proof.
- [Phase 158]: Canonical workflow next steps now cover the remaining transition, resume, debug, audit, and phase-management evidence surfaces. — Plan 15 finished the previously cited workflow gap with focused regression proof.
- [Phase 158]: Re-verification found the remaining blocker has shifted to planning-prep aliases like `/bgsd-plan discuss|research|assumptions`. — Phase 158 cannot close until those still-shipped surfaces stop preferring `/bgsd-discuss-phase`, `/bgsd-research-phase`, and `/bgsd-list-assumptions`.
- [Phase 159-help-surface-command-integrity]: Top-level help now uses a compact core path plus advanced families with canonical runnable examples. — Phase 159 needs a small trustworthy front door that includes /bgsd-review and removes legacy or ambiguous help guidance.
- [Phase 159]: Validator now audits surfaced guidance against shipped command inventories with grouped semantic issue output — Phase 159 needs one auditable gate before the remaining docs, workflow, and runtime cleanup plans can repair surfaced guidance safely
- [Phase 159]: Locked template and runtime guidance to canonical planning-family commands with concrete phase arguments on known flows — Phase 159 requires executable surfaced guidance, so both generated templates and runtime notices now prefer canonical commands with the required phase number when that context is known.
- [Phase 159]: Canonicalized touched agent and skill guidance to canonical planning/settings commands with validator-backed regression coverage. — Phase 159 support surfaces should teach only executable canonical commands, while focused validator fixtures prove command shape without waiting for unrelated pending cleanup plans.
- [Phase 159]: Canonical workflow and handoff guidance now uses /bgsd-plan discuss|research|assumptions with concrete phase arguments when known — This keeps planning-prep next steps executable as written and prevents touched workflow surfaces from drifting back to legacy aliases
- [Phase 159-help-surface-command-integrity]: High-risk docs now teach canonical /bgsd-plan and /bgsd-settings routes with concrete examples — Phase 159 help surfaces must be canonical-only and executable without users guessing phase arguments or family names
- [Phase 159]: Command validation now distinguishes reference-style placeholders from runnable guidance and ignores slash-like config path fragments. — Phase 159 needs repo-wide validation to isolate real stale guidance instead of blocking on placeholder tables or /bgsd-oc path fragments.
- [Phase 159]: Canonicalized remaining help/docs/skill guidance to inspect routes and labeled reference-style family indexes explicitly — Keeps surfaced next steps executable while allowing concise reference-style command matrices to remain validator-clean
- [Phase 159-help-surface-command-integrity]: Command reference guidance is now canonical-only and inspect-owned diagnostics are documented through /bgsd-inspect. — Users should see executable canonical routes instead of alias-heavy runnable guidance, while the docs regression still needs explicit inspect-route callouts visible in the shipped file.
- [Phase 159]: Canonicalized planning-system and troubleshooting command guidance to inspect-family routes and current bgsd-tools CLI forms — These narrative docs were the remaining shipped blocker surfaces named by verification, so their examples needed to match the canonical command surface exactly
- [Phase 159-help-surface-command-integrity]: Doc guidance regression now validates the full shipped contents of docs/commands.md, docs/planning-system.md, and docs/troubleshooting.md instead of snippet-only fixtures.
- [Phase 159-help-surface-command-integrity]: Phase 159 doc blockers are now enforced with explicit canonical-only assertions for planning-family shorthand and cited legacy inspect aliases.
- [Phase 159]: Canonical surfaced guidance now uses phase-aware /bgsd-plan and /bgsd-inspect routes, with direct CLI help aligned to real util:/execute: commands. — Phase 159 verifier failures were caused by runnable docs and runtime help advertising stale aliases, missing arguments, and xistent direct CLI examples.
- [Phase 159]: Canonicalized the remaining Phase 159 gap-closure guidance and limited validator exceptions to reference-only frontmatter descriptions. — Users should see only executable canonical commands on touched support surfaces, while descriptive metadata should not block repo validation.
- [Phase 159]: Discuss-phase guidance now uses canonical inspect progress fallback and reference-only phase-aware discuss wording — Close the cited blocker slice with executable canonical next steps and no bare discuss command.
- [Phase 159]: Canonicalized check-todos and new-project guidance to executable /bgsd-plan and /bgsd-inspect routes, then locked the slice with direct-file regression coverage. — Phase 159 still had this workflow-prep blocker slice in re-verification, so these two files now surface only canonical runnable guidance and stay protected by focused validator-backed tests.
- [Phase 159]: Canonicalized add-phase and add-todo workflow guidance to /bgsd-plan roadmap add and /bgsd-plan todo routes with direct-file regression coverage. — This workflow-prep slice still surfaced legacy aliases and stale follow-up commands, so the guidance needed canonical executable commands with focused validator-backed proof.
- [Phase 159]: Canonicalized the remaining skill-tail command guidance and locked it with direct validator-backed regression coverage — Phase 159 verification isolated the last skill-content failures to planner-dependency-graph and skill-index, so the plan stayed surgical and updated only those two surfaces plus a focused regression.
- [Phase 159]: Canonicalized new-milestone workflow guidance to treat the milestone-context note as reference-only metadata and locked it with a direct-file validator regression. — The remaining blocker was a single user-followable stale command reference, so the safest fix was to relabel the note rather than broaden workflow guidance changes.
- [Phase 159]: Runtime diagnostics now route through /bgsd-inspect health and missing-plan fallback uses /bgsd-inspect progress when phase context is unavailable. — Phase 159 still had runtime next steps that were stale or incomplete when no phase number could be inferred, so inspect-family guidance is the safe canonical fallback.
- [Phase 159]: Locked repo-wide command validation to explicit reference-only contexts while preserving strict runnable guidance enforcement. — Phase 159 needed util:validate-commands to pass on real shipped surfaces without masking stale aliases, missing arguments, or xistent commands in runnable text.
- [Phase 160-phase-intent-alignment-verification]: Phase intent now requires an explicit Local Purpose / Expected User Change / Non-Goals block in CONTEXT.md, and legacy contexts remain partial instead of guessed.
- [Phase 160-phase-intent-alignment-verification]: Verification and UAT now report intent alignment as a separate verdict before or alongside requirement coverage.
- [Phase 160-phase-intent-alignment-verification]: Core expected-user-change misses now force a misaligned verdict, while legacy phases without explicit intent stay not assessed instead of guessed.
- [Phase 161]: Canonicalized runtime handoff guidance to /bgsd-plan discuss|research with phase-aware arguments — Generated resume and repair commands now match the canonical planning-family contract and close the remaining Phase 158 blocker path.
- [v16.0 Init]: Competitive analysis of gstack and hermes-agent identified 15 improvement opportunities
- [v16.0 Init]: Scoped to 6 features: code review, security audit, review dashboard, release pipeline, agent memory, destructive command detection
- [v16.0 Init]: Deferred 9 features to v16.1/v17.0 (test coverage, monitoring, skill auto-creation, lesson feedback, session search, prompt injection scanning, cross-model validation, retro, changelog)
- [v16.0 Roadmap]: Split safety + memory into separate phases for better scoping (research suggested combined)
- [v16.0 Roadmap]: 5 phases (144-148): Safety → Memory → Review → Security → Readiness+Release
- [Phase 144 P01]: All GARD-04 notifications use severity 'info' for context-only routing — logical severity in message text
- [Phase 144 P02]: Adjusted rm -rf tests to allow multi-match (fs-rm-recursive + fs-rm-force overlap on -rf flags)
- [Phase 145 P01]: `.planning/MEMORY.md` is the canonical structured memory store, with stable `MEM-###` IDs and deterministic metadata ordering
- [Phase 145 P01]: `memory:prune` is preview-first and protects `Active / Recent` plus `Keep: always` entries from automatic cleanup
- [Phase 145-structured-agent-memory]: Freeze MEMORY.md on first prompt injection and keep later disk edits as stale notices until session refresh
- [Phase 145-structured-agent-memory]: Screen MEMORY.md entries individually with normalized blocker matching so safe entries still inject
- [Phase 146 P01]: `review:scan` defaults to staged diff and returns explicit commit-range fallback metadata when nothing is staged
- [Phase 146 P01]: Review exclusions match exact normalized `rule_id + path` pairs and require a reason for auditability
- [Phase 146]: Review rules now emit raw findings first and route them centrally for AUTO-FIX, ASK, INFO, or suppression
- [Phase 146]: Mechanical review fixes validate exact current lines and downgrade failures to ASK instead of aborting the scan
- [Phase 146 P03]: `/bgsd-review` now bootstraps through `init:review` so workflow model and active phase metadata come from CLI context instead of markdown guesswork
- [Phase 146 P03]: Review orchestration is scan-first, batches ASK findings by theme with per-finding decisions, leaves unanswered items unresolved, and reports results in severity-led structured output
- [Phase 147]: security:scan emits one normalized finding contract with confidence bands and verification metadata — Later engines and /bgsd-security can share one deterministic schema instead of inventing engine-specific output.
- [Phase 147]: security exclusions require exact rule_id plus normalized path and optional fingerprint with reason and expiry — Narrow suppressions stay auditable and expired exclusions surface as warnings instead of silently hiding findings.
- [Phase 147]: OWASP SEC-01 coverage is tracked through explicit category metadata with direct-rule vs delegated-family notes. — This keeps Phase 147 claims honest while dependency-backed A06 coverage lands in the next plan.
- [Phase 147-security-audit-workflow]: Secrets now use finding fingerprints plus redacted evidence for auditable, narrow suppressions
- [Phase 147-security-audit-workflow]: Dependency findings now grade confidence by evidence quality and use advisory-backed remediation guidance
- [Phase 147-security-audit-workflow]: `/bgsd-security` now bootstraps through `init:security` so workflow model selection and active phase metadata come from CLI context.
- [Phase 147-security-audit-workflow]: The security workflow treats `security:scan` JSON as the deterministic source of findings and keeps medium-confidence results explicitly labeled after verifier assessment.
- [Phase 148-review-readiness-release-pipeline]: Readiness reports missing scripts or artifacts as explicit skip results and only marks executed failing checks as fail
- [Phase 148-review-readiness-release-pipeline]: review:readiness evaluates TODOs and changelog freshness from the current git diff while staying advisory-only
- [Phase 148-review-readiness-release-pipeline]: Release analysis now uses the latest semver tag as the primary baseline and falls back to package.json only when no prior tag exists
- [Phase 148-review-readiness-release-pipeline]: Ambiguous release history now returns an explicit patch fallback with advisory reasons instead of guessing a larger bump
- [Phase 148-review-readiness-release-pipeline]: release:changelog previews grouped notes from summaries plus conventional commits without mutating CHANGELOG.md at runtime
- [Phase 148-review-readiness-release-pipeline]: Release mutations now persist `.planning/release-state.json` step-by-step instead of attempting magical rollback.
- [Phase 148-review-readiness-release-pipeline]: `release:pr` preflights gh usability and authentication before any PR-specific mutation so GitHub access failures stop with explicit resume guidance.
- [Phase 148-review-readiness-release-pipeline]: Automatic release cleanup is limited to obviously safe local artifacts like an unpushed tag; meaningful version and changelog edits are preserved for resume.
- [Phase 148-review-readiness-release-pipeline]: `/bgsd-release` now bootstraps through `init:release` so workflow metadata and resume paths come from CLI state.
- [Phase 148-review-readiness-release-pipeline]: The release workflow stays dry-run-first with one explicit confirmation gate before `release:tag` or `release:pr`.
- [Phase 149]: TDD contract authority now lives in skills/tdd-execution/SKILL.md so workflows, templates, and help defer to one canonical source
- [Phase 149]: Phase 149 TDD wording stops at contract alignment; semantic-gate depth and end-to-end proof remain deferred to Phase 150
- [Phase 149]: Planner and readers now normalize TDD decisions deterministically and persist the canonical contract on read — Omitted or legacy TDD metadata should no longer leave plan selection to silent discretion or in-memory-only normalization
- [Phase 149]: Omitted TDD hints now surface explicit informational checker output instead of silent skips
- [Phase 149]: Required, recommended, and omitted TDD hints now share one blocker-warning-info ladder across checker, workflow, and roadmap guidance
- [Phase 149]: Phase 149 TDD guidance remains limited to selection and rationale severity; execute:tdd semantic enforcement stays deferred to Phase 150
- [Phase 150-tdd-execution-semantics-proof]: `execute:tdd` now validates the exact declared target command for each TDD phase — RED must prove missing behavior without accepting missing commands, while GREEN and REFACTOR stay targeted-only by default
- [Phase 150-tdd-execution-semantics-proof]: TDD validators now emit structured proof payloads — Exact target command, exit code, and matched evidence snippets provide stable audit data without brittle root-cause matching
- [Phase 150-tdd-execution-semantics-proof]: Summary generation now audits TDD stages from GSD-Phase trailers plus optional proof sidecars — This gives reviewers one stable path for commit-level and validator-level TDD evidence without breaking non-TDD summaries
- [Phase 150-tdd-execution-semantics-proof]: TDD summaries now require explicit REFACTOR proof when a refactor commit exists — Phase 150 needs REFACTOR to be auditable instead of an optional afterthought
- [Phase 150-tdd-execution-semantics-proof]: End-to-end TDD proof uses temp repos with real validator gates plugin commits and generated summaries — Fixture-backed execution catches audit-chain regressions that isolated validator tests would miss
- [Phase 151]: phase:snapshot now returns roadmap metadata, artifact paths, and plan inventory in one additive payload — Shared snapshot data removes repeated discovery calls for common phase reads
- [Phase 151]: phase:snapshot falls back to roadmap-backed metadata when the phase directory does not exist yet — Roadmap-only phases must degrade gracefully instead of forcing a second discovery path
- [Phase 151]: Hot init commands now derive shared phase metadata and artifact paths from phase:snapshot instead of rescanning phase directories
- [Phase 151]: phase:snapshot now carries UAT artifact paths so snapshot-backed init flows preserve additive-safe file outputs
- [Phase 151]: verify:state complete-plan now batches durable plan finalization with explicit tail recovery warnings — One command keeps progress, position, and decision writes together while leaving metrics and continuity recoverable
- [Phase 151]: Default discuss acceleration now uses low-risk defaults in the main workflow instead of a separate fast-mode UX
- [Phase 151]: verify-work keeps one-at-a-time as default and only uses grouped summaries for opt-in clean-path batches with exact failing-group drill-down
- [Phase 152 P01]: `util:phase-plan-index` now validates fresh PlanningCache plan rows before use and rebuilds stale or unavailable entries from markdown through write-through fallback.
- [Phase 152]: Phase handoff resume state now derives from versioned per-step artifacts instead of a pointer file — Latest-valid selection keeps same-phase replacement deterministic and fail-closed
- [Phase 152]: Init entrypoints now expose one shared resume summary contract with exact resume inspect restart options — Downstream workflows can consume artifact-derived resume metadata without reconstructing continuation state from STATE.md or partial markdown artifacts.
- [Phase 152]: Downstream continuation now uses resume_summary and latest-valid handoff state while keeping standalone entrypoints additive. — This keeps research, plan, execute, and verify fail-closed for invalid chains without breaking one-off command use.
- [Phase 152]: Discuss owns clean-start restart while transition keeps auto-advance additive through explicit resume summaries. — FLOW-08 needs fresh-context chaining without silent resume or a second orchestration model.
- [Phase 153]: Production workflow steps now persist their own durable phase handoffs through shared payload defaults — Fresh-context chaining no longer depends on manual run_id/source_fingerprint seeding
- [Phase 153]: Resume freshness now hashes canonical phase inputs at init entrypoints — Real stale-source blocking now compares production handoffs to stable roadmap and phase-planning artifacts while ignoring unrelated STATE churn
- [Phase 153]: Repairing stale handoffs now requires refreshing artifacts against current planning inputs — Latest-valid inspection and restart guidance remain available, but resume stays fail-closed until handoffs are rewritten with the current expected fingerprint
- [Phase 153-production-handoff-persistence-resume-freshness]: Locked the production handoff chain with one composed regression and aligned workflow wording to current expected-fingerprint freshness semantics. — Phase 153 needed a final proof of real production behavior plus narrow wording cleanup that matches the shipped runtime contract.
- [Phase 154]: Production TDD execution now writes canonical TDD-AUDIT sidecars from validator proof — One shared write path lets real type:tdd runs self-produce durable audit artifacts for summary generation
- [Phase 154]: Phase handoff writes now preserve discovered TDD audit metadata across same-run refreshes — Execute and verify handoffs keep deterministic proof references without making proof mandatory for non-TDD flows
- [Phase 154]: Locked end-to-end fresh-context proof delivery with additive resume-summary proof metadata. — Phase 154 needed one production-style regression plus narrow inspection and wording updates to close TDD-06 and FLOW-08 without reopening earlier TDD or freshness semantics.
- [v17.0 Roadmap]: Split milestone into 6 phases (155-160): JJ execution gate, JJ workspace recovery, planning context cascade, command family consolidation, help/reference integrity, and phase intent alignment verification
- [v17.0 Roadmap]: Grouped JJ planner awareness with milestone/effective-intent injection because both change planning context for roadmap and plan design rather than the execution backend itself
- [v17.0 Roadmap]: Dynamic model configuration (DO-117) remains deferred and outside v17.0 scope while JJ-first execution, command simplification, and intent cascade ship together
- [Phase 155]: Execution init is now JJ-gated and workspace-first, and legacy worktree config fails with explicit migration guidance.
- [Phase 155-jj-execution-gate-workspace-lifecycle]: Promoted execution isolation to a top-level workspace command family and removed execute:worktree as a supported surface.
- [Phase 155-jj-execution-gate-workspace-lifecycle]: Kept workspace reconcile validation-only in Phase 155 so stale recovery and op-log UX stay deferred to Phase 156.
- [Phase 155-jj-execution-gate-workspace-lifecycle]: Execution-init regression fixtures now initialize JJ explicitly so broad verification exercises the supported gate path.
- [Phase 156-jj-parallel-waves-recovery-coverage P01]: Workspace commands now classify healthy, stale, and divergent JJ workspaces with op-log diagnostics and preview-first recovery metadata.
- [Phase 156-jj-parallel-waves-recovery-coverage P01]: Cleanup retains recovery-needed workspaces instead of deleting stale or conflicted breadcrumbs during inspection and recovery work.
- [Phase 156 P03]: Shipped config templates now expose only supported workspace settings and locked recovery-first JJ workspace guidance with contract tests
- [Phase 156-jj-parallel-waves-recovery-coverage]: Execute init now exposes live managed workspace inventory with per-plan tracked metadata.
- [Phase 156-jj-parallel-waves-recovery-coverage]: Execute-phase parallel waves now report healthy versus recovery-needed workspaces explicitly so unaffected plans can reconcile independently.
- [Phase 157 P01]: `effective_intent` now layers project intent with optional milestone and phase signals while warning explicitly when lower layers are missing.
- [Phase 157 P01]: Phase-local intent is extracted from existing `*-CONTEXT.md` artifacts instead of adding a separate top-level phase intent file.
- [Phase 157]: Planning init surfaces now inject layered effective_intent and capability-only JJ workspace guidance. — Roadmapper, planner, and verify-work consumers need compact purpose plus safe parallelism context without live workspace inventory or automatic routing.
- [Phase 157]: Scoped planning and alignment agents now keep effective_intent, and cached agent contexts mirror the same phase-aware contract. — Phase 157 needed scoped agent payloads and cached manifests to stay aligned so compact intent survives agent filtering without verifier workspace leakage.
- [Phase 157]: Locked milestone intent ownership and effective_intent-first planning workflows — Keeps project intent stable while planning surfaces use compact context and advisory JJ capability guidance
- [Phase 157]: Added the active v17.0 milestone intent artifact and normalized Phase 157 must_haves metadata to verifier-readable YAML. — Phase 157 verification required a real milestone strategy layer and parseable artifact/key-link metadata so effective_intent and must_haves checks reflect the shipped work.
- [Phase 158]: Established canonical quick, plan, and inspect wrapper baseline with manifest-backed parity coverage. — Phase 158 needs canonical wrapper entrypoints and shared inventory before legacy command repointing can proceed safely.
- [Phase 158]: Locked /bgsd-inspect as the canonical read-only diagnostics hub and recast covered legacy commands as compatibility aliases. — This keeps canonical and legacy inspect entrypoints behaviorally aligned while preserving the strict read-only family boundary for follow-on migration slices.
- [Phase 158]: Centralized planning-family routing under /bgsd-plan and converted legacy planning entrypoints into compatibility shims. — One canonical planning contract keeps alias behavior aligned now while leaving roadmap gap and todo expansion for later Phase 158 slices.
- [Phase 158]: Planning-family parity coverage stays focused on alias routing and normalization contracts — Phase 158 needed direct CMD-03 regression proof for roadmap gaps and todo aliases without expanding into Phase 159 help-surface auditing
- [Phase 158]: Kept settings as a separate canonical family and taught touched surfaces to prefer canonical family names — Preserves the locked plan-versus-inspect-versus-settings boundaries while deferring the broader reference audit to Phase 159
- [Phase 158]: Canonical workflow follow-ups now prefer /bgsd-plan phase and /bgsd-plan gaps. — Keeps the locked planning-family map intact while removing legacy-preferred next-step guidance from touched workflow surfaces.
- [Phase 158]: Canonical docs now teach /bgsd-plan subcommands and /bgsd-settings profile first. — Phase 158 needed user-facing docs to prefer the canonical command families while keeping legacy names as compatibility-only notes.
- [Phase 158]: Plugin runtime guidance now prefers /bgsd-plan phase in missing-plan and next-phase notices, and plugin.js is rebuilt immediately after source wording changes to keep shipped runtime text aligned. — Closes the plugin-runtime slice of CMD-03 without changing alias compatibility wiring.
- [Phase 158]: Canonical planning-family guidance now drives research and resume-summary next-command text — Kept handoff behavior unchanged while removing stale legacy guidance from surfaced next steps
- [Phase 158]: Locked plugin runtime guidance regressions on both canonical planning-family surfaces. — Focused plugin tests now protect the missing-plan tool message and idle-validator next-step wording introduced in Plan 11.
- [Phase 158]: Canonical command-family guidance now covers the remaining Phase 158 docs, workflow, and plugin advisory surfaces — Closed the last CMD-03 guidance gap by making canonical planning and settings commands primary everywhere touched in this plan
- [Phase 158]: Canonical docs now cover the remaining architecture, planning-system, agents, expert-guide, configuration, and troubleshooting evidence surfaces. — Plan 14 finished the previously cited docs gap with focused regression proof.
- [Phase 158]: Canonical workflow next steps now cover the remaining transition, resume, debug, audit, and phase-management evidence surfaces. — Plan 15 finished the previously cited workflow gap with focused regression proof.
- [Phase 158]: Re-verification found the remaining blocker has shifted to planning-prep aliases like `/bgsd-plan discuss|research|assumptions`. — Phase 158 cannot close until those still-shipped surfaces stop preferring `/bgsd-discuss-phase`, `/bgsd-research-phase`, and `/bgsd-list-assumptions`.
- [Phase 159-help-surface-command-integrity]: Top-level help now uses a compact core path plus advanced families with canonical runnable examples. — Phase 159 needs a small trustworthy front door that includes /bgsd-review and removes legacy or ambiguous help guidance.
- [Phase 159]: Validator now audits surfaced guidance against shipped command inventories with grouped semantic issue output — Phase 159 needs one auditable gate before the remaining docs, workflow, and runtime cleanup plans can repair surfaced guidance safely
- [Phase 159]: Locked template and runtime guidance to canonical planning-family commands with concrete phase arguments on known flows — Phase 159 requires executable surfaced guidance, so both generated templates and runtime notices now prefer canonical commands with the required phase number when that context is known.
- [Phase 159]: Canonicalized touched agent and skill guidance to canonical planning/settings commands with validator-backed regression coverage. — Phase 159 support surfaces should teach only executable canonical commands, while focused validator fixtures prove command shape without waiting for unrelated pending cleanup plans.
- [Phase 159]: Canonical workflow and handoff guidance now uses /bgsd-plan discuss|research|assumptions with concrete phase arguments when known — This keeps planning-prep next steps executable as written and prevents touched workflow surfaces from drifting back to legacy aliases
- [Phase 159-help-surface-command-integrity]: High-risk docs now teach canonical /bgsd-plan and /bgsd-settings routes with concrete examples — Phase 159 help surfaces must be canonical-only and executable without users guessing phase arguments or family names
- [Phase 159]: Command validation now distinguishes reference-style placeholders from runnable guidance and ignores slash-like config path fragments. — Phase 159 needs repo-wide validation to isolate real stale guidance instead of blocking on placeholder tables or /bgsd-oc path fragments.
- [Phase 159]: Canonicalized remaining help/docs/skill guidance to inspect routes and labeled reference-style family indexes explicitly — Keeps surfaced next steps executable while allowing concise reference-style command matrices to remain validator-clean
- [Phase 159-help-surface-command-integrity]: Command reference guidance is now canonical-only and inspect-owned diagnostics are documented through /bgsd-inspect. — Users should see executable canonical routes instead of alias-heavy runnable guidance, while the docs regression still needs explicit inspect-route callouts visible in the shipped file.
- [Phase 159]: Canonicalized planning-system and troubleshooting command guidance to inspect-family routes and current bgsd-tools CLI forms — These narrative docs were the remaining shipped blocker surfaces named by verification, so their examples needed to match the canonical command surface exactly
- [Phase 159-help-surface-command-integrity]: Doc guidance regression now validates the full shipped contents of docs/commands.md, docs/planning-system.md, and docs/troubleshooting.md instead of snippet-only fixtures.
- [Phase 159-help-surface-command-integrity]: Phase 159 doc blockers are now enforced with explicit canonical-only assertions for planning-family shorthand and cited legacy inspect aliases.
- [Phase 159]: Canonical surfaced guidance now uses phase-aware /bgsd-plan and /bgsd-inspect routes, with direct CLI help aligned to real util:/execute: commands. — Phase 159 verifier failures were caused by runnable docs and runtime help advertising stale aliases, missing arguments, and xistent direct CLI examples.
- [Phase 159]: Canonicalized the remaining Phase 159 gap-closure guidance and limited validator exceptions to reference-only frontmatter descriptions. — Users should see only executable canonical commands on touched support surfaces, while descriptive metadata should not block repo validation.
- [Phase 159]: Discuss-phase guidance now uses canonical inspect progress fallback and reference-only phase-aware discuss wording — Close the cited blocker slice with executable canonical next steps and no bare discuss command.
- [Phase 159]: Canonicalized check-todos and new-project guidance to executable /bgsd-plan and /bgsd-inspect routes, then locked the slice with direct-file regression coverage. — Phase 159 still had this workflow-prep blocker slice in re-verification, so these two files now surface only canonical runnable guidance and stay protected by focused validator-backed tests.
- [Phase 159]: Canonicalized add-phase and add-todo workflow guidance to /bgsd-plan roadmap add and /bgsd-plan todo routes with direct-file regression coverage. — This workflow-prep slice still surfaced legacy aliases and stale follow-up commands, so the guidance needed canonical executable commands with focused validator-backed proof.
- [Phase 159]: Canonicalized the remaining skill-tail command guidance and locked it with direct validator-backed regression coverage — Phase 159 verification isolated the last skill-content failures to planner-dependency-graph and skill-index, so the plan stayed surgical and updated only those two surfaces plus a focused regression.
- [Phase 159]: Canonicalized new-milestone workflow guidance to treat the milestone-context note as reference-only metadata and locked it with a direct-file validator regression. — The remaining blocker was a single user-followable stale command reference, so the safest fix was to relabel the note rather than broaden workflow guidance changes.
- [Phase 159]: Runtime diagnostics now route through /bgsd-inspect health and missing-plan fallback uses /bgsd-inspect progress when phase context is unavailable. — Phase 159 still had runtime next steps that were stale or incomplete when no phase number could be inferred, so inspect-family guidance is the safe canonical fallback.
- [Phase 159]: Locked repo-wide command validation to explicit reference-only contexts while preserving strict runnable guidance enforcement. — Phase 159 needed util:validate-commands to pass on real shipped surfaces without masking stale aliases, missing arguments, or xistent commands in runnable text.
- [Phase 160-phase-intent-alignment-verification]: Phase intent now requires an explicit Local Purpose / Expected User Change / Non-Goals block in CONTEXT.md, and legacy contexts remain partial instead of guessed.
- [Phase 160-phase-intent-alignment-verification]: Verification and UAT now report intent alignment as a separate verdict before or alongside requirement coverage.
- [Phase 160-phase-intent-alignment-verification]: Core expected-user-change misses now force a misaligned verdict, while legacy phases without explicit intent stay not assessed instead of guessed.
- [Phase 161]: Canonicalized runtime handoff guidance to /bgsd-plan discuss|research with phase-aware arguments — Generated resume and repair commands now match the canonical planning-family contract and close the remaining Phase 158 blocker path.
- [Phase 162]: Legacy contexts without an explicit Phase Intent block now return shared fallback metadata and keep phase-local intent absent instead of inferred.
- [Phase 162]: Runtime-facing intent warnings now come from the shared phase-context fallback contract, and the CLI bundle is rebuilt in the same slice to preserve source/runtime parity.
- [v16.0 Init]: Competitive analysis of gstack and hermes-agent identified 15 improvement opportunities
- [v16.0 Init]: Scoped to 6 features: code review, security audit, review dashboard, release pipeline, agent memory, destructive command detection
- [v16.0 Init]: Deferred 9 features to v16.1/v17.0 (test coverage, monitoring, skill auto-creation, lesson feedback, session search, prompt injection scanning, cross-model validation, retro, changelog)
- [v16.0 Roadmap]: Split safety + memory into separate phases for better scoping (research suggested combined)
- [v16.0 Roadmap]: 5 phases (144-148): Safety → Memory → Review → Security → Readiness+Release
- [Phase 144 P01]: All GARD-04 notifications use severity 'info' for context-only routing — logical severity in message text
- [Phase 144 P02]: Adjusted rm -rf tests to allow multi-match (fs-rm-recursive + fs-rm-force overlap on -rf flags)
- [Phase 145 P01]: `.planning/MEMORY.md` is the canonical structured memory store, with stable `MEM-###` IDs and deterministic metadata ordering
- [Phase 145 P01]: `memory:prune` is preview-first and protects `Active / Recent` plus `Keep: always` entries from automatic cleanup
- [Phase 145-structured-agent-memory]: Freeze MEMORY.md on first prompt injection and keep later disk edits as stale notices until session refresh
- [Phase 145-structured-agent-memory]: Screen MEMORY.md entries individually with normalized blocker matching so safe entries still inject
- [Phase 146 P01]: `review:scan` defaults to staged diff and returns explicit commit-range fallback metadata when nothing is staged
- [Phase 146 P01]: Review exclusions match exact normalized `rule_id + path` pairs and require a reason for auditability
- [Phase 146]: Review rules now emit raw findings first and route them centrally for AUTO-FIX, ASK, INFO, or suppression
- [Phase 146]: Mechanical review fixes validate exact current lines and downgrade failures to ASK instead of aborting the scan
- [Phase 146 P03]: `/bgsd-review` now bootstraps through `init:review` so workflow model and active phase metadata come from CLI context instead of markdown guesswork
- [Phase 146 P03]: Review orchestration is scan-first, batches ASK findings by theme with per-finding decisions, leaves unanswered items unresolved, and reports results in severity-led structured output
- [Phase 147]: security:scan emits one normalized finding contract with confidence bands and verification metadata — Later engines and /bgsd-security can share one deterministic schema instead of inventing engine-specific output.
- [Phase 147]: security exclusions require exact rule_id plus normalized path and optional fingerprint with reason and expiry — Narrow suppressions stay auditable and expired exclusions surface as warnings instead of silently hiding findings.
- [Phase 147]: OWASP SEC-01 coverage is tracked through explicit category metadata with direct-rule vs delegated-family notes. — This keeps Phase 147 claims honest while dependency-backed A06 coverage lands in the next plan.
- [Phase 147-security-audit-workflow]: Secrets now use finding fingerprints plus redacted evidence for auditable, narrow suppressions
- [Phase 147-security-audit-workflow]: Dependency findings now grade confidence by evidence quality and use advisory-backed remediation guidance
- [Phase 147-security-audit-workflow]: `/bgsd-security` now bootstraps through `init:security` so workflow model selection and active phase metadata come from CLI context.
- [Phase 147-security-audit-workflow]: The security workflow treats `security:scan` JSON as the deterministic source of findings and keeps medium-confidence results explicitly labeled after verifier assessment.
- [Phase 148-review-readiness-release-pipeline]: Readiness reports missing scripts or artifacts as explicit skip results and only marks executed failing checks as fail
- [Phase 148-review-readiness-release-pipeline]: review:readiness evaluates TODOs and changelog freshness from the current git diff while staying advisory-only
- [Phase 148-review-readiness-release-pipeline]: Release analysis now uses the latest semver tag as the primary baseline and falls back to package.json only when no prior tag exists
- [Phase 148-review-readiness-release-pipeline]: Ambiguous release history now returns an explicit patch fallback with advisory reasons instead of guessing a larger bump
- [Phase 148-review-readiness-release-pipeline]: release:changelog previews grouped notes from summaries plus conventional commits without mutating CHANGELOG.md at runtime
- [Phase 148-review-readiness-release-pipeline]: Release mutations now persist `.planning/release-state.json` step-by-step instead of attempting magical rollback.
- [Phase 148-review-readiness-release-pipeline]: `release:pr` preflights gh usability and authentication before any PR-specific mutation so GitHub access failures stop with explicit resume guidance.
- [Phase 148-review-readiness-release-pipeline]: Automatic release cleanup is limited to obviously safe local artifacts like an unpushed tag; meaningful version and changelog edits are preserved for resume.
- [Phase 148-review-readiness-release-pipeline]: `/bgsd-release` now bootstraps through `init:release` so workflow metadata and resume paths come from CLI state.
- [Phase 148-review-readiness-release-pipeline]: The release workflow stays dry-run-first with one explicit confirmation gate before `release:tag` or `release:pr`.
- [Phase 149]: TDD contract authority now lives in skills/tdd-execution/SKILL.md so workflows, templates, and help defer to one canonical source
- [Phase 149]: Phase 149 TDD wording stops at contract alignment; semantic-gate depth and end-to-end proof remain deferred to Phase 150
- [Phase 149]: Planner and readers now normalize TDD decisions deterministically and persist the canonical contract on read — Omitted or legacy TDD metadata should no longer leave plan selection to silent discretion or in-memory-only normalization
- [Phase 149]: Omitted TDD hints now surface explicit informational checker output instead of silent skips
- [Phase 149]: Required, recommended, and omitted TDD hints now share one blocker-warning-info ladder across checker, workflow, and roadmap guidance
- [Phase 149]: Phase 149 TDD guidance remains limited to selection and rationale severity; execute:tdd semantic enforcement stays deferred to Phase 150
- [Phase 150-tdd-execution-semantics-proof]: `execute:tdd` now validates the exact declared target command for each TDD phase — RED must prove missing behavior without accepting missing commands, while GREEN and REFACTOR stay targeted-only by default
- [Phase 150-tdd-execution-semantics-proof]: TDD validators now emit structured proof payloads — Exact target command, exit code, and matched evidence snippets provide stable audit data without brittle root-cause matching
- [Phase 150-tdd-execution-semantics-proof]: Summary generation now audits TDD stages from GSD-Phase trailers plus optional proof sidecars — This gives reviewers one stable path for commit-level and validator-level TDD evidence without breaking non-TDD summaries
- [Phase 150-tdd-execution-semantics-proof]: TDD summaries now require explicit REFACTOR proof when a refactor commit exists — Phase 150 needs REFACTOR to be auditable instead of an optional afterthought
- [Phase 150-tdd-execution-semantics-proof]: End-to-end TDD proof uses temp repos with real validator gates plugin commits and generated summaries — Fixture-backed execution catches audit-chain regressions that isolated validator tests would miss
- [Phase 151]: phase:snapshot now returns roadmap metadata, artifact paths, and plan inventory in one additive payload — Shared snapshot data removes repeated discovery calls for common phase reads
- [Phase 151]: phase:snapshot falls back to roadmap-backed metadata when the phase directory does not exist yet — Roadmap-only phases must degrade gracefully instead of forcing a second discovery path
- [Phase 151]: Hot init commands now derive shared phase metadata and artifact paths from phase:snapshot instead of rescanning phase directories
- [Phase 151]: phase:snapshot now carries UAT artifact paths so snapshot-backed init flows preserve additive-safe file outputs
- [Phase 151]: verify:state complete-plan now batches durable plan finalization with explicit tail recovery warnings — One command keeps progress, position, and decision writes together while leaving metrics and continuity recoverable
- [Phase 151]: Default discuss acceleration now uses low-risk defaults in the main workflow instead of a separate fast-mode UX
- [Phase 151]: verify-work keeps one-at-a-time as default and only uses grouped summaries for opt-in clean-path batches with exact failing-group drill-down
- [Phase 152 P01]: `util:phase-plan-index` now validates fresh PlanningCache plan rows before use and rebuilds stale or unavailable entries from markdown through write-through fallback.
- [Phase 152]: Phase handoff resume state now derives from versioned per-step artifacts instead of a pointer file — Latest-valid selection keeps same-phase replacement deterministic and fail-closed
- [Phase 152]: Init entrypoints now expose one shared resume summary contract with exact resume inspect restart options — Downstream workflows can consume artifact-derived resume metadata without reconstructing continuation state from STATE.md or partial markdown artifacts.
- [Phase 152]: Downstream continuation now uses resume_summary and latest-valid handoff state while keeping standalone entrypoints additive. — This keeps research, plan, execute, and verify fail-closed for invalid chains without breaking one-off command use.
- [Phase 152]: Discuss owns clean-start restart while transition keeps auto-advance additive through explicit resume summaries. — FLOW-08 needs fresh-context chaining without silent resume or a second orchestration model.
- [Phase 153]: Production workflow steps now persist their own durable phase handoffs through shared payload defaults — Fresh-context chaining no longer depends on manual run_id/source_fingerprint seeding
- [Phase 153]: Resume freshness now hashes canonical phase inputs at init entrypoints — Real stale-source blocking now compares production handoffs to stable roadmap and phase-planning artifacts while ignoring unrelated STATE churn
- [Phase 153]: Repairing stale handoffs now requires refreshing artifacts against current planning inputs — Latest-valid inspection and restart guidance remain available, but resume stays fail-closed until handoffs are rewritten with the current expected fingerprint
- [Phase 153-production-handoff-persistence-resume-freshness]: Locked the production handoff chain with one composed regression and aligned workflow wording to current expected-fingerprint freshness semantics. — Phase 153 needed a final proof of real production behavior plus narrow wording cleanup that matches the shipped runtime contract.
- [Phase 154]: Production TDD execution now writes canonical TDD-AUDIT sidecars from validator proof — One shared write path lets real type:tdd runs self-produce durable audit artifacts for summary generation
- [Phase 154]: Phase handoff writes now preserve discovered TDD audit metadata across same-run refreshes — Execute and verify handoffs keep deterministic proof references without making proof mandatory for non-TDD flows
- [Phase 154]: Locked end-to-end fresh-context proof delivery with additive resume-summary proof metadata. — Phase 154 needed one production-style regression plus narrow inspection and wording updates to close TDD-06 and FLOW-08 without reopening earlier TDD or freshness semantics.
- [v17.0 Roadmap]: Split milestone into 6 phases (155-160): JJ execution gate, JJ workspace recovery, planning context cascade, command family consolidation, help/reference integrity, and phase intent alignment verification
- [v17.0 Roadmap]: Grouped JJ planner awareness with milestone/effective-intent injection because both change planning context for roadmap and plan design rather than the execution backend itself
- [v17.0 Roadmap]: Dynamic model configuration (DO-117) remains deferred and outside v17.0 scope while JJ-first execution, command simplification, and intent cascade ship together
- [Phase 155]: Execution init is now JJ-gated and workspace-first, and legacy worktree config fails with explicit migration guidance.
- [Phase 155-jj-execution-gate-workspace-lifecycle]: Promoted execution isolation to a top-level workspace command family and removed execute:worktree as a supported surface.
- [Phase 155-jj-execution-gate-workspace-lifecycle]: Kept workspace reconcile validation-only in Phase 155 so stale recovery and op-log UX stay deferred to Phase 156.
- [Phase 155-jj-execution-gate-workspace-lifecycle]: Execution-init regression fixtures now initialize JJ explicitly so broad verification exercises the supported gate path.
- [Phase 156-jj-parallel-waves-recovery-coverage P01]: Workspace commands now classify healthy, stale, and divergent JJ workspaces with op-log diagnostics and preview-first recovery metadata.
- [Phase 156-jj-parallel-waves-recovery-coverage P01]: Cleanup retains recovery-needed workspaces instead of deleting stale or conflicted breadcrumbs during inspection and recovery work.
- [Phase 156 P03]: Shipped config templates now expose only supported workspace settings and locked recovery-first JJ workspace guidance with contract tests
- [Phase 156-jj-parallel-waves-recovery-coverage]: Execute init now exposes live managed workspace inventory with per-plan tracked metadata.
- [Phase 156-jj-parallel-waves-recovery-coverage]: Execute-phase parallel waves now report healthy versus recovery-needed workspaces explicitly so unaffected plans can reconcile independently.
- [Phase 157 P01]: `effective_intent` now layers project intent with optional milestone and phase signals while warning explicitly when lower layers are missing.
- [Phase 157 P01]: Phase-local intent is extracted from existing `*-CONTEXT.md` artifacts instead of adding a separate top-level phase intent file.
- [Phase 157]: Planning init surfaces now inject layered effective_intent and capability-only JJ workspace guidance. — Roadmapper, planner, and verify-work consumers need compact purpose plus safe parallelism context without live workspace inventory or automatic routing.
- [Phase 157]: Scoped planning and alignment agents now keep effective_intent, and cached agent contexts mirror the same phase-aware contract. — Phase 157 needed scoped agent payloads and cached manifests to stay aligned so compact intent survives agent filtering without verifier workspace leakage.
- [Phase 157]: Locked milestone intent ownership and effective_intent-first planning workflows — Keeps project intent stable while planning surfaces use compact context and advisory JJ capability guidance
- [Phase 157]: Added the active v17.0 milestone intent artifact and normalized Phase 157 must_haves metadata to verifier-readable YAML. — Phase 157 verification required a real milestone strategy layer and parseable artifact/key-link metadata so effective_intent and must_haves checks reflect the shipped work.
- [Phase 158]: Established canonical quick, plan, and inspect wrapper baseline with manifest-backed parity coverage. — Phase 158 needs canonical wrapper entrypoints and shared inventory before legacy command repointing can proceed safely.
- [Phase 158]: Locked /bgsd-inspect as the canonical read-only diagnostics hub and recast covered legacy commands as compatibility aliases. — This keeps canonical and legacy inspect entrypoints behaviorally aligned while preserving the strict read-only family boundary for follow-on migration slices.
- [Phase 158]: Centralized planning-family routing under /bgsd-plan and converted legacy planning entrypoints into compatibility shims. — One canonical planning contract keeps alias behavior aligned now while leaving roadmap gap and todo expansion for later Phase 158 slices.
- [Phase 158]: Planning-family parity coverage stays focused on alias routing and normalization contracts — Phase 158 needed direct CMD-03 regression proof for roadmap gaps and todo aliases without expanding into Phase 159 help-surface auditing
- [Phase 158]: Kept settings as a separate canonical family and taught touched surfaces to prefer canonical family names — Preserves the locked plan-versus-inspect-versus-settings boundaries while deferring the broader reference audit to Phase 159
- [Phase 158]: Canonical workflow follow-ups now prefer /bgsd-plan phase and /bgsd-plan gaps. — Keeps the locked planning-family map intact while removing legacy-preferred next-step guidance from touched workflow surfaces.
- [Phase 158]: Canonical docs now teach /bgsd-plan subcommands and /bgsd-settings profile first. — Phase 158 needed user-facing docs to prefer the canonical command families while keeping legacy names as compatibility-only notes.
- [Phase 158]: Plugin runtime guidance now prefers /bgsd-plan phase in missing-plan and next-phase notices, and plugin.js is rebuilt immediately after source wording changes to keep shipped runtime text aligned. — Closes the plugin-runtime slice of CMD-03 without changing alias compatibility wiring.
- [Phase 158]: Canonical planning-family guidance now drives research and resume-summary next-command text — Kept handoff behavior unchanged while removing stale legacy guidance from surfaced next steps
- [Phase 158]: Locked plugin runtime guidance regressions on both canonical planning-family surfaces. — Focused plugin tests now protect the missing-plan tool message and idle-validator next-step wording introduced in Plan 11.
- [Phase 158]: Canonical command-family guidance now covers the remaining Phase 158 docs, workflow, and plugin advisory surfaces — Closed the last CMD-03 guidance gap by making canonical planning and settings commands primary everywhere touched in this plan
- [Phase 158]: Canonical docs now cover the remaining architecture, planning-system, agents, expert-guide, configuration, and troubleshooting evidence surfaces. — Plan 14 finished the previously cited docs gap with focused regression proof.
- [Phase 158]: Canonical workflow next steps now cover the remaining transition, resume, debug, audit, and phase-management evidence surfaces. — Plan 15 finished the previously cited workflow gap with focused regression proof.
- [Phase 158]: Re-verification found the remaining blocker has shifted to planning-prep aliases like `/bgsd-plan discuss|research|assumptions`. — Phase 158 cannot close until those still-shipped surfaces stop preferring `/bgsd-discuss-phase`, `/bgsd-research-phase`, and `/bgsd-list-assumptions`.
- [Phase 159-help-surface-command-integrity]: Top-level help now uses a compact core path plus advanced families with canonical runnable examples. — Phase 159 needs a small trustworthy front door that includes /bgsd-review and removes legacy or ambiguous help guidance.
- [Phase 159]: Validator now audits surfaced guidance against shipped command inventories with grouped semantic issue output — Phase 159 needs one auditable gate before the remaining docs, workflow, and runtime cleanup plans can repair surfaced guidance safely
- [Phase 159]: Locked template and runtime guidance to canonical planning-family commands with concrete phase arguments on known flows — Phase 159 requires executable surfaced guidance, so both generated templates and runtime notices now prefer canonical commands with the required phase number when that context is known.
- [Phase 159]: Canonicalized touched agent and skill guidance to canonical planning/settings commands with validator-backed regression coverage. — Phase 159 support surfaces should teach only executable canonical commands, while focused validator fixtures prove command shape without waiting for unrelated pending cleanup plans.
- [Phase 159]: Canonical workflow and handoff guidance now uses /bgsd-plan discuss|research|assumptions with concrete phase arguments when known — This keeps planning-prep next steps executable as written and prevents touched workflow surfaces from drifting back to legacy aliases
- [Phase 159-help-surface-command-integrity]: High-risk docs now teach canonical /bgsd-plan and /bgsd-settings routes with concrete examples — Phase 159 help surfaces must be canonical-only and executable without users guessing phase arguments or family names
- [Phase 159]: Command validation now distinguishes reference-style placeholders from runnable guidance and ignores slash-like config path fragments. — Phase 159 needs repo-wide validation to isolate real stale guidance instead of blocking on placeholder tables or /bgsd-oc path fragments.
- [Phase 159]: Canonicalized remaining help/docs/skill guidance to inspect routes and labeled reference-style family indexes explicitly — Keeps surfaced next steps executable while allowing concise reference-style command matrices to remain validator-clean
- [Phase 159-help-surface-command-integrity]: Command reference guidance is now canonical-only and inspect-owned diagnostics are documented through /bgsd-inspect. — Users should see executable canonical routes instead of alias-heavy runnable guidance, while the docs regression still needs explicit inspect-route callouts visible in the shipped file.
- [Phase 159]: Canonicalized planning-system and troubleshooting command guidance to inspect-family routes and current bgsd-tools CLI forms — These narrative docs were the remaining shipped blocker surfaces named by verification, so their examples needed to match the canonical command surface exactly
- [Phase 159-help-surface-command-integrity]: Doc guidance regression now validates the full shipped contents of docs/commands.md, docs/planning-system.md, and docs/troubleshooting.md instead of snippet-only fixtures.
- [Phase 159-help-surface-command-integrity]: Phase 159 doc blockers are now enforced with explicit canonical-only assertions for planning-family shorthand and cited legacy inspect aliases.
- [Phase 159]: Canonical surfaced guidance now uses phase-aware /bgsd-plan and /bgsd-inspect routes, with direct CLI help aligned to real util:/execute: commands. — Phase 159 verifier failures were caused by runnable docs and runtime help advertising stale aliases, missing arguments, and xistent direct CLI examples.
- [Phase 159]: Canonicalized the remaining Phase 159 gap-closure guidance and limited validator exceptions to reference-only frontmatter descriptions. — Users should see only executable canonical commands on touched support surfaces, while descriptive metadata should not block repo validation.
- [Phase 159]: Discuss-phase guidance now uses canonical inspect progress fallback and reference-only phase-aware discuss wording — Close the cited blocker slice with executable canonical next steps and no bare discuss command.
- [Phase 159]: Canonicalized check-todos and new-project guidance to executable /bgsd-plan and /bgsd-inspect routes, then locked the slice with direct-file regression coverage. — Phase 159 still had this workflow-prep blocker slice in re-verification, so these two files now surface only canonical runnable guidance and stay protected by focused validator-backed tests.
- [Phase 159]: Canonicalized add-phase and add-todo workflow guidance to /bgsd-plan roadmap add and /bgsd-plan todo routes with direct-file regression coverage. — This workflow-prep slice still surfaced legacy aliases and stale follow-up commands, so the guidance needed canonical executable commands with focused validator-backed proof.
- [Phase 159]: Canonicalized the remaining skill-tail command guidance and locked it with direct validator-backed regression coverage — Phase 159 verification isolated the last skill-content failures to planner-dependency-graph and skill-index, so the plan stayed surgical and updated only those two surfaces plus a focused regression.
- [Phase 159]: Canonicalized new-milestone workflow guidance to treat the milestone-context note as reference-only metadata and locked it with a direct-file validator regression. — The remaining blocker was a single user-followable stale command reference, so the safest fix was to relabel the note rather than broaden workflow guidance changes.
- [Phase 159]: Runtime diagnostics now route through /bgsd-inspect health and missing-plan fallback uses /bgsd-inspect progress when phase context is unavailable. — Phase 159 still had runtime next steps that were stale or incomplete when no phase number could be inferred, so inspect-family guidance is the safe canonical fallback.
- [Phase 159]: Locked repo-wide command validation to explicit reference-only contexts while preserving strict runnable guidance enforcement. — Phase 159 needed util:validate-commands to pass on real shipped surfaces without masking stale aliases, missing arguments, or xistent commands in runnable text.
- [Phase 160-phase-intent-alignment-verification]: Phase intent now requires an explicit Local Purpose / Expected User Change / Non-Goals block in CONTEXT.md, and legacy contexts remain partial instead of guessed.
- [Phase 160-phase-intent-alignment-verification]: Verification and UAT now report intent alignment as a separate verdict before or alongside requirement coverage.
- [Phase 160-phase-intent-alignment-verification]: Core expected-user-change misses now force a misaligned verdict, while legacy phases without explicit intent stay not assessed instead of guessed.
- [Phase 161]: Canonicalized runtime handoff guidance to /bgsd-plan discuss|research with phase-aware arguments — Generated resume and repair commands now match the canonical planning-family contract and close the remaining Phase 158 blocker path.
- [Phase 162]: Legacy contexts without an explicit Phase Intent block now return shared fallback metadata and keep phase-local intent absent instead of inferred.
- [Phase 162]: Runtime-facing intent warnings now come from the shared phase-context fallback contract, and the CLI bundle is rebuilt in the same slice to preserve source/runtime parity.
- [Phase 162]: Locked real-artifact regressions across source, init, and live runtime parity checks for the legacy Phase 160 fallback. — Phase 162 needed direct proof on the audit-cited legacy context so rebuilds cannot silently change not-assessed intent behavior.
- [Phase 162]: Locked real-artifact regressions across source, init, and live runtime parity checks for the legacy Phase 160 fallback. — Phase 162 needed direct proof on the audit-cited legacy context so rebuilds cannot silently change not-assessed intent behavior.
- [v16.0 Init]: Competitive analysis of gstack and hermes-agent identified 15 improvement opportunities
- [v16.0 Init]: Scoped to 6 features: code review, security audit, review dashboard, release pipeline, agent memory, destructive command detection
- [v16.0 Init]: Deferred 9 features to v16.1/v17.0 (test coverage, monitoring, skill auto-creation, lesson feedback, session search, prompt injection scanning, cross-model validation, retro, changelog)
- [v16.0 Roadmap]: Split safety + memory into separate phases for better scoping (research suggested combined)
- [v16.0 Roadmap]: 5 phases (144-148): Safety → Memory → Review → Security → Readiness+Release
- [Phase 144 P01]: All GARD-04 notifications use severity 'info' for context-only routing — logical severity in message text
- [Phase 144 P02]: Adjusted rm -rf tests to allow multi-match (fs-rm-recursive + fs-rm-force overlap on -rf flags)
- [Phase 145 P01]: `.planning/MEMORY.md` is the canonical structured memory store, with stable `MEM-###` IDs and deterministic metadata ordering
- [Phase 145 P01]: `memory:prune` is preview-first and protects `Active / Recent` plus `Keep: always` entries from automatic cleanup
- [Phase 145-structured-agent-memory]: Freeze MEMORY.md on first prompt injection and keep later disk edits as stale notices until session refresh
- [Phase 145-structured-agent-memory]: Screen MEMORY.md entries individually with normalized blocker matching so safe entries still inject
- [Phase 146 P01]: `review:scan` defaults to staged diff and returns explicit commit-range fallback metadata when nothing is staged
- [Phase 146 P01]: Review exclusions match exact normalized `rule_id + path` pairs and require a reason for auditability
- [Phase 146]: Review rules now emit raw findings first and route them centrally for AUTO-FIX, ASK, INFO, or suppression
- [Phase 146]: Mechanical review fixes validate exact current lines and downgrade failures to ASK instead of aborting the scan
- [Phase 146 P03]: `/bgsd-review` now bootstraps through `init:review` so workflow model and active phase metadata come from CLI context instead of markdown guesswork
- [Phase 146 P03]: Review orchestration is scan-first, batches ASK findings by theme with per-finding decisions, leaves unanswered items unresolved, and reports results in severity-led structured output
- [Phase 147]: security:scan emits one normalized finding contract with confidence bands and verification metadata — Later engines and /bgsd-security can share one deterministic schema instead of inventing engine-specific output.
- [Phase 147]: security exclusions require exact rule_id plus normalized path and optional fingerprint with reason and expiry — Narrow suppressions stay auditable and expired exclusions surface as warnings instead of silently hiding findings.
- [Phase 147]: OWASP SEC-01 coverage is tracked through explicit category metadata with direct-rule vs delegated-family notes. — This keeps Phase 147 claims honest while dependency-backed A06 coverage lands in the next plan.
- [Phase 147-security-audit-workflow]: Secrets now use finding fingerprints plus redacted evidence for auditable, narrow suppressions
- [Phase 147-security-audit-workflow]: Dependency findings now grade confidence by evidence quality and use advisory-backed remediation guidance
- [Phase 147-security-audit-workflow]: `/bgsd-security` now bootstraps through `init:security` so workflow model selection and active phase metadata come from CLI context.
- [Phase 147-security-audit-workflow]: The security workflow treats `security:scan` JSON as the deterministic source of findings and keeps medium-confidence results explicitly labeled after verifier assessment.
- [Phase 148-review-readiness-release-pipeline]: Readiness reports missing scripts or artifacts as explicit skip results and only marks executed failing checks as fail
- [Phase 148-review-readiness-release-pipeline]: review:readiness evaluates TODOs and changelog freshness from the current git diff while staying advisory-only
- [Phase 148-review-readiness-release-pipeline]: Release analysis now uses the latest semver tag as the primary baseline and falls back to package.json only when no prior tag exists
- [Phase 148-review-readiness-release-pipeline]: Ambiguous release history now returns an explicit patch fallback with advisory reasons instead of guessing a larger bump
- [Phase 148-review-readiness-release-pipeline]: release:changelog previews grouped notes from summaries plus conventional commits without mutating CHANGELOG.md at runtime
- [Phase 148-review-readiness-release-pipeline]: Release mutations now persist `.planning/release-state.json` step-by-step instead of attempting magical rollback.
- [Phase 148-review-readiness-release-pipeline]: `release:pr` preflights gh usability and authentication before any PR-specific mutation so GitHub access failures stop with explicit resume guidance.
- [Phase 148-review-readiness-release-pipeline]: Automatic release cleanup is limited to obviously safe local artifacts like an unpushed tag; meaningful version and changelog edits are preserved for resume.
- [Phase 148-review-readiness-release-pipeline]: `/bgsd-release` now bootstraps through `init:release` so workflow metadata and resume paths come from CLI state.
- [Phase 148-review-readiness-release-pipeline]: The release workflow stays dry-run-first with one explicit confirmation gate before `release:tag` or `release:pr`.
- [Phase 149]: TDD contract authority now lives in skills/tdd-execution/SKILL.md so workflows, templates, and help defer to one canonical source
- [Phase 149]: Phase 149 TDD wording stops at contract alignment; semantic-gate depth and end-to-end proof remain deferred to Phase 150
- [Phase 149]: Planner and readers now normalize TDD decisions deterministically and persist the canonical contract on read — Omitted or legacy TDD metadata should no longer leave plan selection to silent discretion or in-memory-only normalization
- [Phase 149]: Omitted TDD hints now surface explicit informational checker output instead of silent skips
- [Phase 149]: Required, recommended, and omitted TDD hints now share one blocker-warning-info ladder across checker, workflow, and roadmap guidance
- [Phase 149]: Phase 149 TDD guidance remains limited to selection and rationale severity; execute:tdd semantic enforcement stays deferred to Phase 150
- [Phase 150-tdd-execution-semantics-proof]: `execute:tdd` now validates the exact declared target command for each TDD phase — RED must prove missing behavior without accepting missing commands, while GREEN and REFACTOR stay targeted-only by default
- [Phase 150-tdd-execution-semantics-proof]: TDD validators now emit structured proof payloads — Exact target command, exit code, and matched evidence snippets provide stable audit data without brittle root-cause matching
- [Phase 150-tdd-execution-semantics-proof]: Summary generation now audits TDD stages from GSD-Phase trailers plus optional proof sidecars — This gives reviewers one stable path for commit-level and validator-level TDD evidence without breaking non-TDD summaries
- [Phase 150-tdd-execution-semantics-proof]: TDD summaries now require explicit REFACTOR proof when a refactor commit exists — Phase 150 needs REFACTOR to be auditable instead of an optional afterthought
- [Phase 150-tdd-execution-semantics-proof]: End-to-end TDD proof uses temp repos with real validator gates plugin commits and generated summaries — Fixture-backed execution catches audit-chain regressions that isolated validator tests would miss
- [Phase 151]: phase:snapshot now returns roadmap metadata, artifact paths, and plan inventory in one additive payload — Shared snapshot data removes repeated discovery calls for common phase reads
- [Phase 151]: phase:snapshot falls back to roadmap-backed metadata when the phase directory does not exist yet — Roadmap-only phases must degrade gracefully instead of forcing a second discovery path
- [Phase 151]: Hot init commands now derive shared phase metadata and artifact paths from phase:snapshot instead of rescanning phase directories
- [Phase 151]: phase:snapshot now carries UAT artifact paths so snapshot-backed init flows preserve additive-safe file outputs
- [Phase 151]: verify:state complete-plan now batches durable plan finalization with explicit tail recovery warnings — One command keeps progress, position, and decision writes together while leaving metrics and continuity recoverable
- [Phase 151]: Default discuss acceleration now uses low-risk defaults in the main workflow instead of a separate fast-mode UX
- [Phase 151]: verify-work keeps one-at-a-time as default and only uses grouped summaries for opt-in clean-path batches with exact failing-group drill-down
- [Phase 152 P01]: `util:phase-plan-index` now validates fresh PlanningCache plan rows before use and rebuilds stale or unavailable entries from markdown through write-through fallback.
- [Phase 152]: Phase handoff resume state now derives from versioned per-step artifacts instead of a pointer file — Latest-valid selection keeps same-phase replacement deterministic and fail-closed
- [Phase 152]: Init entrypoints now expose one shared resume summary contract with exact resume inspect restart options — Downstream workflows can consume artifact-derived resume metadata without reconstructing continuation state from STATE.md or partial markdown artifacts.
- [Phase 152]: Downstream continuation now uses resume_summary and latest-valid handoff state while keeping standalone entrypoints additive. — This keeps research, plan, execute, and verify fail-closed for invalid chains without breaking one-off command use.
- [Phase 152]: Discuss owns clean-start restart while transition keeps auto-advance additive through explicit resume summaries. — FLOW-08 needs fresh-context chaining without silent resume or a second orchestration model.
- [Phase 153]: Production workflow steps now persist their own durable phase handoffs through shared payload defaults — Fresh-context chaining no longer depends on manual run_id/source_fingerprint seeding
- [Phase 153]: Resume freshness now hashes canonical phase inputs at init entrypoints — Real stale-source blocking now compares production handoffs to stable roadmap and phase-planning artifacts while ignoring unrelated STATE churn
- [Phase 153]: Repairing stale handoffs now requires refreshing artifacts against current planning inputs — Latest-valid inspection and restart guidance remain available, but resume stays fail-closed until handoffs are rewritten with the current expected fingerprint
- [Phase 153-production-handoff-persistence-resume-freshness]: Locked the production handoff chain with one composed regression and aligned workflow wording to current expected-fingerprint freshness semantics. — Phase 153 needed a final proof of real production behavior plus narrow wording cleanup that matches the shipped runtime contract.
- [Phase 154]: Production TDD execution now writes canonical TDD-AUDIT sidecars from validator proof — One shared write path lets real type:tdd runs self-produce durable audit artifacts for summary generation
- [Phase 154]: Phase handoff writes now preserve discovered TDD audit metadata across same-run refreshes — Execute and verify handoffs keep deterministic proof references without making proof mandatory for non-TDD flows
- [Phase 154]: Locked end-to-end fresh-context proof delivery with additive resume-summary proof metadata. — Phase 154 needed one production-style regression plus narrow inspection and wording updates to close TDD-06 and FLOW-08 without reopening earlier TDD or freshness semantics.
- [v17.0 Roadmap]: Split milestone into 6 phases (155-160): JJ execution gate, JJ workspace recovery, planning context cascade, command family consolidation, help/reference integrity, and phase intent alignment verification
- [v17.0 Roadmap]: Grouped JJ planner awareness with milestone/effective-intent injection because both change planning context for roadmap and plan design rather than the execution backend itself
- [v17.0 Roadmap]: Dynamic model configuration (DO-117) remains deferred and outside v17.0 scope while JJ-first execution, command simplification, and intent cascade ship together
- [Phase 155]: Execution init is now JJ-gated and workspace-first, and legacy worktree config fails with explicit migration guidance.
- [Phase 155-jj-execution-gate-workspace-lifecycle]: Promoted execution isolation to a top-level workspace command family and removed execute:worktree as a supported surface.
- [Phase 155-jj-execution-gate-workspace-lifecycle]: Kept workspace reconcile validation-only in Phase 155 so stale recovery and op-log UX stay deferred to Phase 156.
- [Phase 155-jj-execution-gate-workspace-lifecycle]: Execution-init regression fixtures now initialize JJ explicitly so broad verification exercises the supported gate path.
- [Phase 156-jj-parallel-waves-recovery-coverage P01]: Workspace commands now classify healthy, stale, and divergent JJ workspaces with op-log diagnostics and preview-first recovery metadata.
- [Phase 156-jj-parallel-waves-recovery-coverage P01]: Cleanup retains recovery-needed workspaces instead of deleting stale or conflicted breadcrumbs during inspection and recovery work.
- [Phase 156 P03]: Shipped config templates now expose only supported workspace settings and locked recovery-first JJ workspace guidance with contract tests
- [Phase 156-jj-parallel-waves-recovery-coverage]: Execute init now exposes live managed workspace inventory with per-plan tracked metadata.
- [Phase 156-jj-parallel-waves-recovery-coverage]: Execute-phase parallel waves now report healthy versus recovery-needed workspaces explicitly so unaffected plans can reconcile independently.
- [Phase 157 P01]: `effective_intent` now layers project intent with optional milestone and phase signals while warning explicitly when lower layers are missing.
- [Phase 157 P01]: Phase-local intent is extracted from existing `*-CONTEXT.md` artifacts instead of adding a separate top-level phase intent file.
- [Phase 157]: Planning init surfaces now inject layered effective_intent and capability-only JJ workspace guidance. — Roadmapper, planner, and verify-work consumers need compact purpose plus safe parallelism context without live workspace inventory or automatic routing.
- [Phase 157]: Scoped planning and alignment agents now keep effective_intent, and cached agent contexts mirror the same phase-aware contract. — Phase 157 needed scoped agent payloads and cached manifests to stay aligned so compact intent survives agent filtering without verifier workspace leakage.
- [Phase 157]: Locked milestone intent ownership and effective_intent-first planning workflows — Keeps project intent stable while planning surfaces use compact context and advisory JJ capability guidance
- [Phase 157]: Added the active v17.0 milestone intent artifact and normalized Phase 157 must_haves metadata to verifier-readable YAML. — Phase 157 verification required a real milestone strategy layer and parseable artifact/key-link metadata so effective_intent and must_haves checks reflect the shipped work.
- [Phase 158]: Established canonical quick, plan, and inspect wrapper baseline with manifest-backed parity coverage. — Phase 158 needs canonical wrapper entrypoints and shared inventory before legacy command repointing can proceed safely.
- [Phase 158]: Locked /bgsd-inspect as the canonical read-only diagnostics hub and recast covered legacy commands as compatibility aliases. — This keeps canonical and legacy inspect entrypoints behaviorally aligned while preserving the strict read-only family boundary for follow-on migration slices.
- [Phase 158]: Centralized planning-family routing under /bgsd-plan and converted legacy planning entrypoints into compatibility shims. — One canonical planning contract keeps alias behavior aligned now while leaving roadmap gap and todo expansion for later Phase 158 slices.
- [Phase 158]: Planning-family parity coverage stays focused on alias routing and normalization contracts — Phase 158 needed direct CMD-03 regression proof for roadmap gaps and todo aliases without expanding into Phase 159 help-surface auditing
- [Phase 158]: Kept settings as a separate canonical family and taught touched surfaces to prefer canonical family names — Preserves the locked plan-versus-inspect-versus-settings boundaries while deferring the broader reference audit to Phase 159
- [Phase 158]: Canonical workflow follow-ups now prefer /bgsd-plan phase and /bgsd-plan gaps. — Keeps the locked planning-family map intact while removing legacy-preferred next-step guidance from touched workflow surfaces.
- [Phase 158]: Canonical docs now teach /bgsd-plan subcommands and /bgsd-settings profile first. — Phase 158 needed user-facing docs to prefer the canonical command families while keeping legacy names as compatibility-only notes.
- [Phase 158]: Plugin runtime guidance now prefers /bgsd-plan phase in missing-plan and next-phase notices, and plugin.js is rebuilt immediately after source wording changes to keep shipped runtime text aligned. — Closes the plugin-runtime slice of CMD-03 without changing alias compatibility wiring.
- [Phase 158]: Canonical planning-family guidance now drives research and resume-summary next-command text — Kept handoff behavior unchanged while removing stale legacy guidance from surfaced next steps
- [Phase 158]: Locked plugin runtime guidance regressions on both canonical planning-family surfaces. — Focused plugin tests now protect the missing-plan tool message and idle-validator next-step wording introduced in Plan 11.
- [Phase 158]: Canonical command-family guidance now covers the remaining Phase 158 docs, workflow, and plugin advisory surfaces — Closed the last CMD-03 guidance gap by making canonical planning and settings commands primary everywhere touched in this plan
- [Phase 158]: Canonical docs now cover the remaining architecture, planning-system, agents, expert-guide, configuration, and troubleshooting evidence surfaces. — Plan 14 finished the previously cited docs gap with focused regression proof.
- [Phase 158]: Canonical workflow next steps now cover the remaining transition, resume, debug, audit, and phase-management evidence surfaces. — Plan 15 finished the previously cited workflow gap with focused regression proof.
- [Phase 158]: Re-verification found the remaining blocker has shifted to planning-prep aliases like `/bgsd-plan discuss|research|assumptions`. — Phase 158 cannot close until those still-shipped surfaces stop preferring `/bgsd-discuss-phase`, `/bgsd-research-phase`, and `/bgsd-list-assumptions`.
- [Phase 159-help-surface-command-integrity]: Top-level help now uses a compact core path plus advanced families with canonical runnable examples. — Phase 159 needs a small trustworthy front door that includes /bgsd-review and removes legacy or ambiguous help guidance.
- [Phase 159]: Validator now audits surfaced guidance against shipped command inventories with grouped semantic issue output — Phase 159 needs one auditable gate before the remaining docs, workflow, and runtime cleanup plans can repair surfaced guidance safely
- [Phase 159]: Locked template and runtime guidance to canonical planning-family commands with concrete phase arguments on known flows — Phase 159 requires executable surfaced guidance, so both generated templates and runtime notices now prefer canonical commands with the required phase number when that context is known.
- [Phase 159]: Canonicalized touched agent and skill guidance to canonical planning/settings commands with validator-backed regression coverage. — Phase 159 support surfaces should teach only executable canonical commands, while focused validator fixtures prove command shape without waiting for unrelated pending cleanup plans.
- [Phase 159]: Canonical workflow and handoff guidance now uses /bgsd-plan discuss|research|assumptions with concrete phase arguments when known — This keeps planning-prep next steps executable as written and prevents touched workflow surfaces from drifting back to legacy aliases
- [Phase 159-help-surface-command-integrity]: High-risk docs now teach canonical /bgsd-plan and /bgsd-settings routes with concrete examples — Phase 159 help surfaces must be canonical-only and executable without users guessing phase arguments or family names
- [Phase 159]: Command validation now distinguishes reference-style placeholders from runnable guidance and ignores slash-like config path fragments. — Phase 159 needs repo-wide validation to isolate real stale guidance instead of blocking on placeholder tables or /bgsd-oc path fragments.
- [Phase 159]: Canonicalized remaining help/docs/skill guidance to inspect routes and labeled reference-style family indexes explicitly — Keeps surfaced next steps executable while allowing concise reference-style command matrices to remain validator-clean
- [Phase 159-help-surface-command-integrity]: Command reference guidance is now canonical-only and inspect-owned diagnostics are documented through /bgsd-inspect. — Users should see executable canonical routes instead of alias-heavy runnable guidance, while the docs regression still needs explicit inspect-route callouts visible in the shipped file.
- [Phase 159]: Canonicalized planning-system and troubleshooting command guidance to inspect-family routes and current bgsd-tools CLI forms — These narrative docs were the remaining shipped blocker surfaces named by verification, so their examples needed to match the canonical command surface exactly
- [Phase 159-help-surface-command-integrity]: Doc guidance regression now validates the full shipped contents of docs/commands.md, docs/planning-system.md, and docs/troubleshooting.md instead of snippet-only fixtures.
- [Phase 159-help-surface-command-integrity]: Phase 159 doc blockers are now enforced with explicit canonical-only assertions for planning-family shorthand and cited legacy inspect aliases.
- [Phase 159]: Canonical surfaced guidance now uses phase-aware /bgsd-plan and /bgsd-inspect routes, with direct CLI help aligned to real util:/execute: commands. — Phase 159 verifier failures were caused by runnable docs and runtime help advertising stale aliases, missing arguments, and xistent direct CLI examples.
- [Phase 159]: Canonicalized the remaining Phase 159 gap-closure guidance and limited validator exceptions to reference-only frontmatter descriptions. — Users should see only executable canonical commands on touched support surfaces, while descriptive metadata should not block repo validation.
- [Phase 159]: Discuss-phase guidance now uses canonical inspect progress fallback and reference-only phase-aware discuss wording — Close the cited blocker slice with executable canonical next steps and no bare discuss command.
- [Phase 159]: Canonicalized check-todos and new-project guidance to executable /bgsd-plan and /bgsd-inspect routes, then locked the slice with direct-file regression coverage. — Phase 159 still had this workflow-prep blocker slice in re-verification, so these two files now surface only canonical runnable guidance and stay protected by focused validator-backed tests.
- [Phase 159]: Canonicalized add-phase and add-todo workflow guidance to /bgsd-plan roadmap add and /bgsd-plan todo routes with direct-file regression coverage. — This workflow-prep slice still surfaced legacy aliases and stale follow-up commands, so the guidance needed canonical executable commands with focused validator-backed proof.
- [Phase 159]: Canonicalized the remaining skill-tail command guidance and locked it with direct validator-backed regression coverage — Phase 159 verification isolated the last skill-content failures to planner-dependency-graph and skill-index, so the plan stayed surgical and updated only those two surfaces plus a focused regression.
- [Phase 159]: Canonicalized new-milestone workflow guidance to treat the milestone-context note as reference-only metadata and locked it with a direct-file validator regression. — The remaining blocker was a single user-followable stale command reference, so the safest fix was to relabel the note rather than broaden workflow guidance changes.
- [Phase 159]: Runtime diagnostics now route through /bgsd-inspect health and missing-plan fallback uses /bgsd-inspect progress when phase context is unavailable. — Phase 159 still had runtime next steps that were stale or incomplete when no phase number could be inferred, so inspect-family guidance is the safe canonical fallback.
- [Phase 159]: Locked repo-wide command validation to explicit reference-only contexts while preserving strict runnable guidance enforcement. — Phase 159 needed util:validate-commands to pass on real shipped surfaces without masking stale aliases, missing arguments, or xistent commands in runnable text.
- [Phase 160-phase-intent-alignment-verification]: Phase intent now requires an explicit Local Purpose / Expected User Change / Non-Goals block in CONTEXT.md, and legacy contexts remain partial instead of guessed.
- [Phase 160-phase-intent-alignment-verification]: Verification and UAT now report intent alignment as a separate verdict before or alongside requirement coverage.
- [Phase 160-phase-intent-alignment-verification]: Core expected-user-change misses now force a misaligned verdict, while legacy phases without explicit intent stay not assessed instead of guessed.
- [Phase 161]: Canonicalized runtime handoff guidance to /bgsd-plan discuss|research with phase-aware arguments — Generated resume and repair commands now match the canonical planning-family contract and close the remaining Phase 158 blocker path.
- [Phase 162]: Legacy contexts without an explicit Phase Intent block now return shared fallback metadata and keep phase-local intent absent instead of inferred.
- [Phase 162]: Runtime-facing intent warnings now come from the shared phase-context fallback contract, and the CLI bundle is rebuilt in the same slice to preserve source/runtime parity.
- [Phase 162]: Locked real-artifact regressions across source, init, and live runtime parity checks for the legacy Phase 160 fallback. — Phase 162 needed direct proof on the audit-cited legacy context so rebuilds cannot silently change not-assessed intent behavior.
- [v18.0 Roadmap]: Start at Phase 163 because v17.0 ended at Phase 162.
- [v18.0 Roadmap]: Keep milestone scope bounded to the fixed `.planning/memory/lessons.json` snapshot; post-snapshot lessons stay out unless they are direct regressions.
- [v18.0 Roadmap]: Use five vertical-slice phases: snapshot foundation, JJ-safe commits, verification trustworthiness, plan finalization correctness, and workflow/reporting integrity.
- [v18.0 Roadmap]: Interpret the user's `#3` scope addition as workflow acceleration tied to repeated reliability pain, not a broad workflow rewrite.
- [Roadmap]: Start milestone v17.1 at Phase 163 and sequence work from shared contracts into execution/verification hardening, then completion accuracy, then logging polish.
- [Roadmap]: Keep shared planning indexes and verifier metadata truthfulness together so planner/checker and verifier consume one early contract.
- [Roadmap]: Start milestone v17.1 at Phase 163 and sequence work from shared contracts into execution/verification hardening, then completion accuracy, then logging polish.
- [Roadmap]: Keep shared planning indexes and verifier metadata truthfulness together so planner/checker and verifier consume one early contract.
- [Phase 163]: Shared project locking and atomic publish now define the reusable mutation substrate for later state, memory, handoff, and config migrations.
- [Phase 163]: Canonicalized touched CLI state/session writes behind one semantic mutator — Keep Markdown and SQLite derived from one payload with rollback coverage
- [Phase 163]: Canonicalized touched CLI state/session writes behind one semantic mutator — Keep Markdown and SQLite derived from one payload with rollback coverage
- [Phase 163]: Shared JSON-backed stores now mutate through one locked publish contract with rollback-safe memory and lessons writes. — One helper removes stale whole-file rewrite paths from the touched memory and handoff flows while keeping concurrency handling reusable.
- [Phase 163]: Shared config normalization now lives in one contract — Touched CLI and plugin config flows now read, migrate, and repair through one schema-driven implementation instead of duplicated defaults and coercion logic.
- [Phase 163]: Plugin progress now delegates writes through verify:state and clears all related session caches on invalidation — Reuse the canonical CLI mutation contract so plugin progress can no longer drift from shared state/session semantics
- [Phase 164]: Verifier must_haves evaluation now uses one normalized plan metadata context with explicit missing versus inconclusive outcomes — Verifier artifact, key-link, and quality checks needed one truthful reusable contract instead of mixed parsing paths and neutral empty results
- [Phase 164-shared-planning-indexes-metadata-truthfulness]: Plan approval now reuses verify:verify plan-structure as the semantic gate for verifier-consumable must_haves metadata — Planner and checker approval now shares the verifier-facing metadata contract, so malformed or truths-only metadata is blocked before execution.
- [Phase 165]: execute:commit now falls back to path-scoped jj commit only for JJ-backed detached or dirty states blocked by Git-first guards
- [Phase 165]: JJ fallback rebuilds Agent-Type and GSD-Phase trailers in the commit message so downstream summary flows keep one commit metadata contract
- [Phase 165]: Deliverables verification now checks active-checkout artifact and key-link content, not file existence alone.
- [Phase 165]: Execute init now exposes additive runtime freshness metadata derived from plan files_modified so downstream verify flows can detect stale local runtime artifacts.
- [Phase 165]: Execute and verify workflows now require repo-local current-checkout proof plus rebuilt local runtime validation when generated artifacts are involved.
- [Phase 165]: Runtime freshness now prefers the most-specific source-to-artifact mapping so src/plugin changes validate against plugin.js instead of unrelated CLI bundles.
- [Phase 166]: Completion metadata now refreshes from plan-scoped disk truth — Keep summary, STATE, and ROADMAP outputs aligned to the active plan instead of ambient workspace noise
- [Phase 167]: Touched CLI and plugin diagnostics now share BGSD_DEBUG with CLI --verbose support, and plugin debug gating uses an ESM-safe helper so bundled runtime behavior matches source. — Phase 167 needed one predictable investigation contract before quieter default-noise cleanup can proceed without reintroducing env drift or plugin import failures.
- [Phase 167]: Quiet touched plugin and runtime diagnostics by default while keeping BGSD_DEBUG investigation output explicit and non-duplicative — Default runs should stay machine-readable and quiet; richer hook and compile-cache diagnostics remain available through the shared verbosity contract without duplicate operator messages.

### Pending Todos

None yet.

### Blockers/Concerns

None

## Session Continuity

Last session: 2026-03-30T23:07:16.025Z
Stopped at: Completed 167-02-PLAN.md
Resume file: None
