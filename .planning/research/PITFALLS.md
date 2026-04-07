# Pitfalls Research

**Domain:** Workflow Acceleration II + TDD Reliability Hardening (v19.4)
**Researched:** 2026-04-06
**Confidence:** HIGH

<!-- section: compact -->
<pitfalls_compact>
<!-- Compact view for planners. Keep under 25 lines. -->

**Top pitfalls:**
1. **Stubbed TDD validators stall executor flow** — implement execute:tdd validate-red/green/refactor or fail closed before routing plans to TDD type (Phase 210)
2. **TDD audit sidecar continuity breaks in handoff** — wire durable proof source before parallel/fast-path handoff refreshes (Phase 211)
3. **Bundle parity regressions (recurring)** — run `npm run build` + smoke after every src/ change, not just at milestone end (All phases)
4. **JJ proof gates bypassed by acceleration** — `workspace prove` remains mandatory even on accelerated/fast paths (Phase 202)
5. **Cache invalidation races in parallel TDD stages** — mutex per cache key before parallel fan-out of TDD verification (Phase 212)

**Tech debt traps:** Skipping workflow:baseline measurement, hardcoding hot-path routing without invalidation, batching sacred TDD data writes

**Security risks:** Faster routing skips permission guards; parallel TDD stages write shared state without locks; cache poisoning via stale TDD proof entries

**"Looks done but isn't" checks:**
- TDD validators: verify execute:tdd validate-red/green/refactor returns structured proof (not "not yet implemented")
- TDD summary rendering: verify TDD proof audit trail is human-legible in generated SUMMARY.md
- Fast-mode TDD: verify --fast routes still enforce TDD proof gates, not just CLI throughput
- Bundle parity: verify `npm run build` + `util:validate-commands --raw` green after any src/ change
</pitfalls_compact>
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

### Pitfall 1: Stubbed TDD Validators Stall Executor Workflow

**What goes wrong:**
The executor TDD workflow instructs agents to run `execute:tdd validate-red/green/refactor`, but the command returns "TDD command not yet implemented", forcing executors to improvise manual proof capture mid-plan. This has been a recurring failure across 8+ lessons (cde03562, 95c5d10a, 583c4a0e, 727b3d1f, 9e58f2c3, 7c8d4a1b, a21f3b5c, 0b4e6d8f) and blocks the v19.4 TDD reliability hardening goal.

**Why it happens:**
The TDD execution skill and executor workflow were written assuming `execute:tdd validate-*` subcommands existed, but the CLI implementation was deferred. The placeholder response lets the command pass without error, so the gap is only discovered mid-execution when TDD runs produce no structured proof.

**How to avoid:**
1. Before routing any plan as `type:tdd`, run `execute:tdd validate-red` and confirm it returns structured JSON with a `proof` field — not "not yet implemented"
2. If the subcommands are unimplemented, make them `exit 1` with explicit guidance rather than returning a false-positive 200 OK with placeholder text
3. Add a contract test in the test suite: `execute:tdd validate-red` must return non-zero OR structured proof payload — never a placeholder string
4. Wire this check into `verify:state validate` so TDD routing is gated on actual validator availability

**Warning signs:**
- `execute:tdd` output contains "not yet implemented"
- TDD runs produce no `tdd_audit` sidecar in the plan directory
- Executor logs show "manual proof capture" entries during TDD phases
- Lesson pattern: same "TDD validator commands should fail hard or work" title appearing across multiple milestones

**Phase to address:** Phase 210 — TDD Validator Shipping

---

### Pitfall 2: TDD Audit Sidecar Continuity Breaks in Handoff Refreshes

**What goes wrong:**
TDD proof audit sidecars (`.tdd_audit.json`) are created during execute-phase but do not survive resumable handoff refreshes. When a session resumes or inspects a completed TDD plan, the audit trail is absent from the summary, breaking the v16.1 contract that "production-created TDD audit sidecars now survive resumable handoff refreshes, surface in resume inspection, and re-render in downstream summaries."

**Why it happens:**
The handoff refresh logic re-renders summary context from on-disk artifacts, but TDD audit sidecars are not included in the handoff artifact inventory. Accelerated handoff paths (fast-mode, batch verify) may skip the sidecar copy step.

**How to avoid:**
1. Add `tdd_audit` to the handoff artifact inventory in `phase-handoff.js` — it must be listed alongside `phase.md`, `plan.md`, `intent.md`
2. Verify that `verify:state complete-plan` and `verify:state validate` both include TDD audit sidecar checks
3. Test the full handoff cycle: execute TDD plan → kill session → resume → inspect summary → confirm audit trail visible
4. Do not allow fast-path or batch acceleration to skip the sidecar persistence step

**Warning signs:**
- TDD plan completes but `.tdd_audit.json` absent from plan directory on resume
- Summary renders without TDD proof section despite successful TDD execution
- Handoff artifact list does not mention `tdd_audit`
- `lessons.json` contains entries about TDD proof not surviving handoff

**Phase to address:** Phase 211 — TDD Audit Continuity

---

### Pitfall 3: Bundle Parity Regressions (Recurring Pattern)

**What goes wrong:**
Source code changes work correctly when run via `node bin/bgsd-tools.cjs` but crash or misbehave after `npm run build` due to esbuild bundling issues (missing require targets, incompatible syntax, __require wrapper failures in ESM contexts). This has been a recurring failure across v17–v19 (lessons 7bd4451d, 17c2bb71, 0f3a2c9e).

**Why it happens:**
esbuild bundling can introduce incompatibilities that are invisible in the source/module environment: `node:sqlite` `createTagStore()` requires Node 22.5+ but esbuild may bundle for lower targets; CJS/ESM boundary issues; require calls to optional dependencies that are not bundled. Developers test against source and ship without bundle verification.

**How to avoid:**
1. After every meaningful `src/` change, run `npm run build` AND `util:validate-commands --raw` before considering the change complete
2. Never merge a PR without both source tests green AND bundle smoke test green
3. Add a contract test that imports the bundled `bin/bgsd-tools.cjs` and exercises the changed command paths
4. Track bundle parity failures in lessons with the `type:environment` sentinel so future research catches recurring patterns

**Warning signs:**
- Discussion of "works when I run it directly but fails after build"
- `npm run build` succeeds but `util:validate-commands --raw` reports failures
- New `node:sqlite` or `node:fs` usage without verifying bundle compatibility
- Lesson entries tagged `bundle parity` or `plugin.js`

**Phase to address:** All phases — bundle smoke is a per-phase gate, not a milestone-end check

---

### Pitfall 4: JJ Workspace Proof Gates Bypassed by Acceleration

**What goes wrong:**
Workflow acceleration (continuing from v19.3's parallel stage work) creates pressure to short-circuit `workspace prove` gates on accelerated paths, or to use fallback logic that doesn't require proof. This breaks the v19.0 contract that all execution flows through trusted finalize paths with proof verification.

**Why it happens:**
Proof gates add latency. Accelerated/fast-mode/batch paths are measured in milliseconds, and the `workspace prove` triple-match check feels like overhead to eliminate when throughput is the goal.

**How to avoid:**
1. Never remove or short-circuit the `workspace prove` gate on any execution path — including accelerated, fast-mode, and batch paths
2. If the proof check itself is slow, optimize the proof check (cache results with TTL, batch the three match checks) — not the bypassing of it
3. Any "fallback to sequential" acceleration must use proof failure as the triggering condition, not proof absence as a shortcut
4. Document that JJ workspace proof preservation is a hard constraint, not a soft recommendation

**Warning signs:**
- Discussion of "skipping workspace prove for acceleration"
- New execution paths that bypass JJ workspace mode even when JJ workspace is available
- Fallback logic that doesn't call `workspace prove`
- Accelerated commands that work in non-JJ workspaces but fail silently in JJ workspaces

**Phase to address:** Phase 202 (reinforcement from v19.3 PITFALLS.md) — JJ proof gates are already identified as critical, this is continuing enforcement

---

### Pitfall 5: Cache Invalidation Races in Parallel TDD Stages

**What goes wrong:**
When TDD verification stages (parallel `verify-work --batch N` or parallel phase execution) share a cache layer, simultaneous invalidation of the same cache entry can return stale TDD proof data, crash with "undefined helper" errors, or corrupt the shared cache state. The existing mutex infrastructure from v19.3 must be extended to cover TDD-specific cache keys.

**Why it happens:**
TDD verification writes create and update `.tdd_audit.json` files and SQLite entries. Parallel TDD stages that write to the same plan's audit cache key simultaneously will race — one will write stale data, the other will read it as fresh.

**How to avoid:**
1. Extend mutex protection to all TDD-related cache keys: `tdd_audit:${plan_path}`, `tdd_proof:${plan_path}`, `tdd_summary:${plan_path}`
2. Before parallel TDD fan-out, call `workspace prove` to ensure cache state is fresh for this workspace
3. Wire one serial cache-warm call before any parallel TDD cache-dependent operations
4. Always retry TDD cache-dependent operations once on transient crash before escalating

**Warning signs:**
- Parallel verify-work batches hit the same TDD audit cache key simultaneously
- `tdd_audit.json` appears truncated or with interleaved JSON after parallel verify
- "undefined helper" errors in parallel TDD paths (same root cause as v19.3 cache races)
- TDD proof present in summary but absent from plan directory (partial write race)

**Phase to address:** Phase 212 — Parallel TDD Safety

---

### Pitfall 6: TDD Summary Rendering Unclear for Humans

**What goes wrong:**
Even when TDD proof audit sidecars are correctly created and preserved, the generated SUMMARY.md renders TDD proof in a way that is unclear to human readers — proof is shown as raw tokens or backtick-wrapped strings rather than a human-legible summary of what was tested and verified.

**Why it happens:**
The `summary:generate` command pulls from `tdd_audit` sidecar data but renders it using the same token-extraction logic used for file paths, producing a list of backtick-wrapped test identifiers instead of a readable narrative.

**How to avoid:**
1. Define a human-legible TDD proof rendering format: "Phase N: 3 RED tests (test/calc.test.js:12,18,24), 3 GREEN tests, 1 REFACTOR cleanup"
2. Add a rendering contract test: generated summary must contain human-legible TDD proof description, not just raw audit tokens
3. Test the full render pipeline: execute TDD plan → generate summary → verify human can understand what was proven

**Warning signs:**
- SUMMARY.md contains backtick-wrapped tokens in the TDD section that look like file paths
- No narrative description of what the RED/GREEN/REFACTOR phases accomplished
- `lessons.json` contains entries about "TDD summary rendering unclear for humans"

**Phase to address:** Phase 211 — TDD Summary Rendering

---

### Pitfall 7: Fast-Mode Routes Bypass TDD Validation Gates

**What goes wrong:**
`--fast` mode added in v19.3 for `discuss-phase` and `verify-work --batch N` routes plans through accelerated CLI paths. If TDD plans (`type:tdd`) are routed through fast-mode without TDD-specific handling, the `execute:tdd validate-red/green/refactor` gates may be skipped, producing TDD runs without structured proof.

**Why it happens:**
Fast-mode accelerates by skipping advisory steps and batching low-risk operations. TDD proof validation is not an advisory step — it is the mechanism that makes TDD trustworthy. Fast-mode logic that bypasses proof validation defeats the purpose of TDD routing.

**How to avoid:**
1. TDD proof gates (`execute:tdd validate-*`) are mandatory and must never be skipped by `--fast` or `--batch` flags
2. Add an explicit routing check: if `plan.type === 'tdd'`, execute:tdd validate gates are non-negotiable regardless of acceleration flags
3. `verify-work --batch N` for TDD plans must still run `execute:tdd validate-*` for each batch item — batch the test execution, not the proof validation
4. Document the TDD non-bypassable gate in the `--fast` and `--batch` implementation

**Warning signs:**
- `type:tdd` plans running with `--fast` flag and producing no `tdd_audit` sidecar
- Batch verify output shows all TDD plans passing without individual proof validation calls
- Fast-mode discussion of "skipping proof validation for routine TDD runs"

**Phase to address:** Phase 210 — Fast-Mode TDD Gate Preservation
<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skipping `workflow:baseline` measurement | Faster to start coding | No way to verify improvement or detect regression | Never — baseline is mandatory |
| Hardcoding hot-path routing without invalidation | Simpler code | Breaks when usage patterns shift | Only for Phase 201 prototyping, must be adaptive in production |
| Batch all state writes including sacred TDD data | Fewer I/O operations | Single batch failure corrupts TDD audit trail; harder to debug | Only for non-sacred cache data; TDD audit sidecars always synchronous |
| Parallelize TDD without dependency sort | Easier fan-out | Race conditions on shared TDD cache keys, corrupted proof state | Never without mutex protection on TDD cache keys |
| Stubbing `execute:tdd validate-*` with placeholder text | Ships feature without implementation | Executor workflows stall mid-plan, forcing manual proof | Never — fail closed (exit 1) until implemented |
| Fast-mode skip of TDD proof gates | Faster throughput | TDD runs without structured proof are not TDD | TDD proof gates are non-negotiable regardless of mode |
| Bundle smoke test only at milestone end | Faster development | Source works but bundle crashes discovered late | Never — smoke test after every meaningful src/ change |
| Skipping TDD audit sidecar in handoff refresh | Simpler handoff code | Proof lost on resume, breaking downstream summary rendering | Never — TDD audit is a first-class handoff artifact |
| Using inline `require()` in TDD verify for cross-plan deps | Simpler verify script | Triggers unavailable-validation-step false positives | Write temp test script to disk instead |
<!-- /section -->

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| JJ workspace execution | Parallel TDD stages bypass `workspace prove` | All parallel TDD fan-out still requires fresh proof before dispatch |
| SQLite L2 cache | Concurrent TDD writes during parallel stages cause WAL contention | Add mutex per TDD cache key (`tdd_audit:${plan_path}`); serialize writes to same entry |
| Bundle vs source parity | Source changes work but bundle crashes (recurring lesson pattern) | Always run `npm run build` + `util:validate-commands --raw` after any src/ change |
| State mutation batching | Batch writes drift from canonical STATE.md format | Run `verify:state validate` after every batch operation |
| TDD validator stub | Placeholder "not yet implemented" response instead of hard error | Implement validators or `exit 1` with explicit unsupported guidance |
| Handoff artifact inventory | TDD audit sidecar not listed as a first-class artifact | Explicitly include `tdd_audit` alongside `phase.md`, `plan.md`, `intent.md` |
| execute:tdd in ESM plugin | `__require` wrapper fails for `bin/bgsd-tools.cjs` in ESM context | Use `db-cache.js` ESM-native module pattern alongside CJS `db.js` |
<!-- /section -->

<!-- section: performance -->
## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cache stampede on TDD audit keys | All parallel workers invalidate same TDD audit key, hammering slow path | Implement mutex or lease per TDD cache key before invalidation | More than 2 parallel TDD verifiers hitting the same plan |
| TDD proof cache without TTL | Cached TDD proof used after plan file changes | Add mtime-gated invalidation for TDD proof cache entries | Long-running phases or multi-session TDD execution |
| Batching TDD proof validation | Batch overhead exceeds parallelization gain for small N | Profile actual TDD batch sizes; batch only 3+ parallel verifications | Batching fewer than ~3 contiguous TDD operations |
| Fast-mode without TDD gate check | `--fast` routes TDD plans without proof gates, producing unverifiable runs | Explicit `type === tdd` check in fast-mode routing | Any `--fast` TDD plan execution |
| Aggressive TDD cache without invalidation | Stale TDD audit data after plan format changes | Invalidate TDD cache on lifecycle hook recompute from disk | Any PLAN.md or STATE.md format change affecting TDD |
<!-- /section -->

<!-- section: security -->
## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Faster routing bypassing permission checks | Acceleration layer skips authorization guards embedded in slow paths | Ensure all fast-path routes go through the same permission checks as slow paths |
| Parallel TDD stages writing shared state without locks | Race condition corrupts TDD audit sidecar (sacred proof data) | Mutex per TDD cache key; TDD audit writes always single-writer |
| Cache poisoning via stale TDD proof entries | Fast path returns invalidated TDD proof data | Use git-hash + mtime hybrid invalidation for TDD cache entries |
| Unbounded parallel fan-out for TDD verify | Resource exhaustion from unlimited concurrent TDD stages | Always use bounded parallelism with explicit max-concurrency for TDD batch |
| execute:tdd command injection | Malformed plan.type could bypass TDD routing | Validate plan type against known enum before routing to TDD flow |
<!-- /section -->

<!-- section: ux -->
## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| TDD summary proof rendered as raw tokens | User cannot understand what was proven — sees backtick-wrapped strings instead of narrative | Render as "3 RED tests in test/calc.test.js (lines 12,18,24), 3 GREEN, 1 REFACTOR" |
| Fast-mode TDD silently skipped | User thinks TDD ran with proof but no proof exists | Log explicitly: "TDD proof gates enforced even in fast-mode" |
| Batch verify N speedup without visibility | Commands complete faster but give no signal on which TDD proofs passed | Preserve per-item diagnostic output in batch mode |
| Silent fallback to sequential TDD | User thinks parallel TDD is active but system fell back silently | Log when fallback occurs: "Parallel TDD unavailable, using sequential" |
| TDD validator unimplemented with false-positive 200 | Executor continues thinking proof was captured when it wasn't | Fail closed: non-zero exit or structured error until validators ship |
<!-- /section -->

<!-- section: looks_done -->
## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **execute:tdd validators:** Often returns "not yet implemented" — verify `execute:tdd validate-red` returns structured JSON with `proof` field, not a placeholder string
- [ ] **TDD audit sidecar continuity:** Often lost during handoff refresh — verify `.tdd_audit.json` present after session resume
- [ ] **TDD summary rendering:** Often unclear — verify generated SUMMARY.md contains human-legible TDD proof narrative
- [ ] **Bundle parity:** Often source-works/bundle-broken — verify `npm run build` + `util:validate-commands --raw` green after any src/ change
- [ ] **Fast-mode TDD gates:** Often bypassed — verify `type:tdd` plans with `--fast` flag still produce `tdd_audit` sidecar
- [ ] **Parallel TDD mutex:** Often missing for TDD cache keys — verify parallel `verify-work --batch` for TDD plans uses mutex-protected cache writes
- [ ] **JJ proof gate preservation:** Often bypassed in acceleration discussion — verify `workspace prove` remains required on all execution paths
- [ ] **Handoff artifact inventory:** Often omits TDD audit — verify `tdd_audit` is listed as a first-class artifact in phase-handoff.js artifact inventory
<!-- /section -->

<!-- section: recovery -->
## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| TDD validator stub still returning placeholder | LOW | Make `execute:tdd validate-*` exit 1 with explicit unsupported message until implemented; executor workflows will fail visibly instead of silently producing no proof |
| TDD audit sidecar lost on resume | MEDIUM | Re-run `execute:tdd` with the original RED/GREEN/REFACTOR commands to regenerate the sidecar; verify it appears in the handoff artifact list |
| Bundle parity regression | LOW | Run `npm run build` + `util:validate-commands --raw`; fix bundling issue; do not claim feature complete until both green |
| Parallel TDD cache race corruption | HIGH | Disable parallel TDD fan-out, revert to sequential, fix mutex logic on TDD cache keys, re-enable incrementally |
| TDD summary renders as raw tokens | MEDIUM | Fix `summary:generate` TDD rendering to use human-legible format; re-run summary generation on affected plans |
| Fast-mode bypassed TDD gates | MEDIUM | Add explicit `type === 'tdd'` guard in fast-mode routing; re-run affected TDD plans with proof validation re-enabled |
| JJ proof gate bypassed by acceleration | HIGH | Re-add proof gate; do not allow acceleration discussion to remove or short-circuit `workspace prove` |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stubbed TDD validators stall executor | Phase 210 | `execute:tdd validate-red` returns structured proof or exits non-zero; contract test added |
| TDD audit sidecar continuity breaks | Phase 211 | Resume session after TDD plan; `.tdd_audit.json` present and readable |
| Bundle parity regressions | All phases | `npm run build` + `util:validate-commands --raw` green after every src/ change |
| JJ proof gate bypassed | Phase 202 (reinforcement) | Accelerated paths still trigger `workspace prove`; proof failures block execution |
| Cache invalidation races in parallel TDD | Phase 212 | Parallel TDD verify uses mutex-protected cache; no crash on concurrent invalidation |
| TDD summary rendering unclear | Phase 211 | Generated SUMMARY.md contains human-legible TDD proof narrative |
| Fast-mode bypasses TDD gates | Phase 210 | `type:tdd` plans with `--fast` still produce `tdd_audit` sidecar |
| Handoff omits TDD audit | Phase 211 | `tdd_audit` listed as first-class artifact in phase-handoff artifact inventory |
| Bundle parity (recurring) | All phases | Bundle smoke test after every meaningful src/ change |
<!-- /section -->

<!-- section: sources -->
## Sources

- Project lessons: `.planning/memory/lessons.json` (8+ recurring TDD validator stub failures across v16–v19)
- v19.3 PITFALLS.md: `.planning/research/PITFALLS.md` (existing coverage of cache races, JJ proof gates, bundle parity — v19.4 builds on this)
- v19.3 Architecture: `.planning/research/ARCHITECTURE.md` (parallel stage execution patterns, mutex infrastructure)
- JJ workspace execution: v19.0 milestone deliverables (workspace proof triple-match gate)
- TDD execution skill: existing `src/skills/tdd-execution/SKILL.md` (RED/GREEN/REFACTOR contract)
- Workflow measurement: `workflow:baseline`, `workflow:compare` (v14.0, mandatory for acceleration)
- SQLite caching: v12.0 DataStore schema, hybrid git-hash + mtime invalidation
- Bundle parity: lessons 7bd4451d, 17c2bb71, 0f3a2c9e (recurring source/bundle divergence)

---
*Pitfalls research for: workflow-acceleration-ii-TDD-reliability-v19.4*
*Researched: 2026-04-06*
