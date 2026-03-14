# Pitfalls Research

**Domain:** Intent Archival System — integrating automated INTENT.md outcome/criteria archival into the milestone completion workflow
**Researched:** 2026-03-13
**Confidence:** HIGH (based on direct source code analysis of `src/commands/phase.js`, `src/commands/intent.js`, `src/lib/helpers.js`, `workflows/complete-milestone.md`, `workflows/new-milestone.md`)

<!-- section: compact -->
<pitfalls_compact>
**Top pitfalls:**
1. **Broken traceability after archival** — preserve outcome IDs in archived file and cross-reference from MILESTONES.md entry (Phase 1)
2. **History section grows unbounded** — archive history entries along with outcomes, not just the active sections (Phase 1)
3. **Partial archival on failure** — make INTENT.md archival atomic: snapshot before modification, restore on any error (Phase 1)
4. **Drift validation breaks post-archival** — `cmdIntentDrift` and `cmdIntentTrace` scan by `phaseRange`; archived outcomes no longer match active plans (Phase 2)
5. **`new-milestone` workflow expects stale outcomes** — Step 4.5 "Q2 — Outcomes review" asks about existing outcomes; if archival already removed them, the evolution questionnaire is empty (Phase 1)

**Tech debt traps:** storing archived intents inline in INTENT.md instead of a separate file, skipping history archival, hardcoding archive paths instead of reusing `archiveDir` pattern

**Security risks:** none domain-specific (intent data is non-sensitive planning metadata)

**"Looks done but isn't" checks:**
- Intent archival: verify that `plan:intent trace` still works for archived milestone plans (needs to check archived intent file)
- Intent archival: verify `getNextId()` doesn't collide with archived IDs when new milestone starts
- Complete-milestone: verify INTENT archive file appears in git commit alongside ROADMAP/REQUIREMENTS archives
</pitfalls_compact>
<!-- /section -->

<!-- section: critical_pitfalls -->
## Critical Pitfalls

### Pitfall 1: Broken Traceability — Plans Reference Archived Outcome IDs

**What goes wrong:**
PLAN.md files have YAML frontmatter with `intent.outcome_ids: [DO-72, DO-73]` tracing to INTENT.md outcomes. When outcomes are archived (removed from INTENT.md), `cmdIntentTrace()` (line 1087-1259 of `intent.js`) can't find those outcomes in the active INTENT.md, reporting 0% coverage for archived plans. The `cmdIntentDrift()` function (line 1262+) would flag phantom "feature creep" because outcome references in plans point to IDs no longer in the active file.

**Why it happens:**
The current intent trace/drift system assumes all valid outcome IDs live in INTENT.md. There's no concept of "retired but valid" IDs. The `validOutcomeIds` set at line 1349 of `intent.js` only contains current outcomes.

**How to avoid:**
1. Store archived INTENT data in `.planning/milestones/{version}-INTENT.md` (parallel to existing `-ROADMAP.md` and `-REQUIREMENTS.md` archive pattern)
2. Modify `cmdIntentTrace()` and `getIntentDriftData()` to also load archived intent files when scanning plans whose `phaseRange` falls within an archived milestone
3. Or: keep a `<retired_outcomes>` section in INTENT.md that trace/drift can reference without displaying as active

**Warning signs:**
- After archival, `plan:intent trace` reports 0% coverage
- `plan:intent drift` shows high drift score despite no actual deviation
- Plans in archived milestone directories have dangling outcome references

**Phase to address:**
Phase 1 — Core implementation. This is the fundamental design decision that determines the archival strategy.

---

### Pitfall 2: History Section Grows Without Bound

**What goes wrong:**
The current INTENT.md `<history>` section (lines 54-100 of current `.planning/INTENT.md`) already has 10 milestone entries tracking 44+ archived outcomes across v7.1 through v11.4. Each `intent update` call appends to history via the auto-logging at line 592-691 of `intent.js`. After 20+ milestones, the history section dominates INTENT.md, adding hundreds of lines that get injected into agent context windows via the plugin's `context-builder.js` (line 74-93), wasting tokens.

**Why it happens:**
History is append-only by design — the `generateIntentMd()` function (line 934-948 of `helpers.js`) writes all history entries sequentially. There's no pruning, archival, or truncation mechanism. The `<history>` tag is parsed as a flat list of milestone entries.

**How to avoid:**
Archive history entries alongside outcomes during milestone completion:
1. Move history entries for the completed milestone into the archive file (e.g., `{version}-INTENT.md`)
2. Keep only the last 2-3 milestone history entries in the active INTENT.md for continuity
3. Add a `--keep-history N` option to control retention depth

**Warning signs:**
- INTENT.md exceeds 200 lines (current is 102, already growing)
- `plan:intent show` compact summary reports high change counts
- Context builder injects large `<intent>` blocks

**Phase to address:**
Phase 1 — must be part of the archival design, not retrofitted later.

---

### Pitfall 3: Partial Archival on Failure — Inconsistent State

**What goes wrong:**
The current `cmdMilestoneComplete()` (line 848-1241 of `phase.js`) performs multiple sequential operations: archive ROADMAP, archive REQUIREMENTS, update MILESTONES.md, update STATE.md, move phase directories, reorganize ROADMAP, generate DOCS, create git tag, and commit. If any step fails (e.g., git tag already exists, disk write error), the subsequent steps still proceed via `try/catch` with `debugLog`. Adding intent archival as another step introduces another failure point. If intent archival succeeds but the git commit fails, INTENT.md is modified but not committed, leaving the working tree dirty.

**Why it happens:**
`cmdMilestoneComplete()` uses a "best-effort" pattern — each step is independently try/caught and logged, not transactional. This is intentional for resilience (line 992: `debugLog('milestone.complete', 'readdir failed', e)`) but means partial completion is possible.

**How to avoid:**
1. **Snapshot before modify:** Read INTENT.md into memory before any archival writes. If any step fails, restore the snapshot.
2. **Archive first, modify last:** Write the archive file (`{version}-INTENT.md`) before modifying the active INTENT.md. The archive file is additive (no data loss risk).
3. **Add intent files to the existing commit file list:** At line 1193-1200, the `commitFiles` array lists files to `git add`. Add `.planning/INTENT.md` and `.planning/milestones/{version}-INTENT.md` to this list.

**Warning signs:**
- After `milestone complete`, `git status` shows unstaged changes to INTENT.md
- Archive file exists but active INTENT.md still has old outcomes
- Active INTENT.md was cleared but archive file wasn't written

**Phase to address:**
Phase 1 — core implementation must follow the existing resilience pattern.

---

### Pitfall 4: ID Collision After Archival Reset

**What goes wrong:**
When outcomes DO-72 through DO-78 are archived and INTENT.md is reset for the new milestone, `getNextId()` (line 726-738 of `intent.js`) scans only the current `data.outcomes` array to find the max ID number. If the new milestone starts with an empty outcomes list, `getNextId([], 'DO')` returns `DO-01`, potentially colliding with historically-used IDs. Plans referencing `DO-01` from milestone v1.0 could be confused with a new `DO-01` from milestone v12.0.

**Why it happens:**
`getNextId()` has no awareness of historical ID usage — it only looks at the current items array (line 729-737). The function finds max, increments, and returns. This works when IDs accumulate monotonically but breaks when the list is periodically cleared.

**How to avoid:**
1. **Continue sequence across milestones:** Never reset ID counters. After archiving DO-72 through DO-78, the next outcome should be DO-79, not DO-01. Modify `getNextId()` to also scan archived intent files, or store a `last_id` counter in config.json.
2. **Milestone-prefixed IDs:** Change format to `DO-{milestone}-{num}` (e.g., `DO-11.4-01`). This is a larger change and may break existing regex patterns.
3. **Simplest:** When archiving, don't remove outcomes from the `data` structure used by `getNextId()` — instead mark them with a status field and filter them from display/trace.

**Warning signs:**
- `plan:intent validate` reports duplicate IDs across milestones
- `plan:intent trace` maps a new plan to an archived outcome with the same ID
- ID gaps or resets visible in history entries

**Phase to address:**
Phase 1 — ID continuity must be a design constraint before implementing archival.

---

### Pitfall 5: `new-milestone` Workflow Assumes Active Outcomes Exist

**What goes wrong:**
The `new-milestone.md` workflow Step 4.5 "Q2 — Outcomes review" (line 76-80) iterates over existing outcomes asking "which are now complete, which still apply, and are there new ones?" If milestone completion already archived all outcomes, this review step finds nothing to iterate. The workflow becomes: "Looking at your desired outcomes... (none found)." The guided evolution questionnaire loses its value.

**Why it happens:**
The `new-milestone` and `complete-milestone` workflows are separate, sequential operations. Currently, `complete-milestone` archives ROADMAP and REQUIREMENTS but leaves INTENT.md untouched. The `new-milestone` workflow (Step 4.5) handles intent evolution interactively. If automated intent archival runs during `complete-milestone`, it preempts the interactive evolution step in `new-milestone`.

**How to avoid:**
1. **Archive timing matters:** Intent archival should happen during `new-milestone` Step 4.5, not during `complete-milestone`. The sequence should be: `complete-milestone` snapshots INTENT.md to archive → `new-milestone` Step 4.5 reviews outcomes, marks completed, adds new → then INTENT.md is written with only active outcomes.
2. **Alternative:** If archival happens during `complete-milestone`, the `new-milestone` workflow must be updated to load the archived intent file for the evolution questionnaire.
3. **Recommended:** Follow the existing pattern — `complete-milestone` creates the archive file as a snapshot, `new-milestone` cleans up the active INTENT.md during evolution.

**Warning signs:**
- After `complete-milestone` + `new-milestone`, INTENT.md has no history of what was delivered
- User is never asked about completed vs ongoing outcomes
- New milestone starts with blank intent instead of evolved intent

**Phase to address:**
Phase 1 — workflow integration design. This is a sequencing decision, not a code complexity issue.

---

### Pitfall 6: Plugin Context Builder Serves Stale Intent Data

**What goes wrong:**
The plugin's `context-builder.js` (line 81-93) builds a `<sacred>` block from intent data, including `intent.objective` and up to 3 key outcomes. The `parseIntent` plugin parser (`src/plugin/parsers/intent.js`, line 16-40) caches parsed intent per-CWD with no TTL. After archival modifies INTENT.md, the cached intent data still reflects pre-archival state until the cache is invalidated. The `.planning/` file watcher (mentioned in v9.2 accomplishments) should catch this, but only if it fires before the next context injection.

**Why it happens:**
Module-level cache at line 12-13 of `src/plugin/parsers/intent.js` stores parsed intent as frozen objects. The `invalidateIntent()` function (line 73) exists but must be explicitly called. The milestone complete CLI command doesn't import or call plugin-layer invalidation.

**How to avoid:**
1. The file watcher already invalidates on `.planning/` changes (v9.2 feature) — verify this covers INTENT.md modifications made by CLI commands run via `execSync`.
2. After writing INTENT.md in the archival step, call `invalidateFileCache(intentPath)` (the helpers.js cache) — the plugin cache invalidation should follow via the file watcher.
3. Add INTENT.md to the `cmdMilestoneComplete` cache invalidation list alongside STATE.md (line 942-943, 964 of `phase.js`).

**Warning signs:**
- After milestone completion, system prompt still shows old objective/outcomes
- `plan:intent show` returns different data than what context builder injects
- Agent makes decisions based on completed-milestone outcomes instead of new ones

**Phase to address:**
Phase 2 — integration testing. Core archival (Phase 1) should use the existing `invalidateFileCache()` pattern.

---

### Pitfall 7: Advisory Guardrails Block Legitimate INTENT.md Modifications

**What goes wrong:**
The `advisory-guardrails.js` (line 109) lists INTENT.md as a file whose modifications should be suggested through specific commands: `'/bgsd-new-project'` and `'/bgsd-new-milestone'`. If intent archival modifies INTENT.md during `complete-milestone` (which isn't in the allowlist), the guardrail would flag it as an unexpected modification, potentially confusing the agent.

**Why it happens:**
The guardrail was designed when INTENT.md was only modified during project creation and milestone start. Adding a third modification point (milestone completion) isn't covered by the current allowlist.

**How to avoid:**
Add `/bgsd-complete-milestone` to the INTENT.md guardrail allowlist in `advisory-guardrails.js` line 109.

**Warning signs:**
- Agent receives advisory warning during milestone completion about INTENT.md being modified outside expected commands
- Warning is benign but adds noise to milestone completion output

**Phase to address:**
Phase 1 — trivial fix, include in the archival implementation.
<!-- /section -->

<!-- section: tech_debt -->
## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store archived intents inline in INTENT.md (e.g., `<archived_outcomes>` section) | No new files, simpler implementation | INTENT.md grows without bound, token waste in context injection, violates the separate-archive-file pattern used by ROADMAP and REQUIREMENTS | Never — breaks the established `.planning/milestones/{version}-FILE.md` pattern |
| Skip archiving the `<history>` section | Simpler archival logic (only outcomes/criteria) | History becomes a permanent append-only log that inflates INTENT.md across milestones; defeats the purpose of "keeping planning clean and fast" | Never — history archival is part of the user's stated goal |
| Reset outcome IDs to DO-01 after archival | Cleaner-looking IDs for new milestones | ID collision risk across milestone boundaries; breaks traceability if anyone references historical IDs | Never — monotonic IDs are a correctness requirement |
| Hardcode archive filename pattern instead of reusing `archiveDir` variable | Faster to implement | Diverges from `phase.js` pattern (line 857); archive directory could change; breaks if milestones dir is renamed | Never — reuse the existing `archiveDir` pattern at line 857 of `phase.js` |
| Archive only during `complete-milestone`, not during `new-milestone` | Single integration point | Preempts the interactive evolution questionnaire in `new-milestone` Step 4.5; user never reviews what was completed vs what carries forward | Only if `new-milestone` workflow is updated to load archived intent for review |

## Integration Gotchas

Common mistakes when connecting the archival system to existing components.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `cmdMilestoneComplete()` in `phase.js` | Adding intent archival after the git commit step (line 1193-1212), so the archive isn't committed | Insert intent archival before the commit step; add both files to the `commitFiles` array at line 1193 |
| `generateIntentMd()` in `helpers.js` | Calling it with stale `data` that still includes archived outcomes (passing old parsed data back) | Re-parse after removing archived outcomes; or build new data object from scratch for the post-archival INTENT.md |
| `cmdIntentTrace()` in `intent.js` | Not updating `validOutcomeIds` set to include archived outcomes from milestone files | Add a fallback: if `phaseRange` for a plan falls within an archived milestone, load that milestone's intent archive for validation |
| `new-milestone.md` workflow | Not updating Step 4.5 to handle the case where outcomes were already archived | Add conditional: "If archived intents exist for previous milestone, load them for review before evolving" |
| Plugin `parseIntent` parser | Not invalidating cache after archival modifies INTENT.md | Call `invalidateIntent()` from `src/plugin/parsers/intent.js` after writing INTENT.md in the archival step, or rely on the file watcher (verify it catches CLI-driven writes) |
| Test suite (`intent.test.js` or similar) | Not testing the archive→new-milestone→trace round-trip | Add integration test: create intent → complete milestone → verify archive file → start new milestone → verify trace works for both archived and new outcomes |
<!-- /section -->

<!-- section: performance -->
## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Scanning all milestone archive files during `intent trace` | `plan:intent trace` becomes slow as milestone count grows | Only scan archived intents when the plan's `phaseRange` falls within that milestone; cache results per-session | >20 milestones with 50+ outcomes each |
| Loading full archived INTENT.md files for ID validation in `getNextId()` | Outcome add operation reads N archived files to find max ID | Store `last_outcome_id`, `last_criteria_id` counters in `config.json` or INTENT.md metadata; single read, no scanning | >30 milestones |
| History section parse time in `parseIntentMd()` | The regex-based history parser (line 775-807 of `helpers.js`) processes every line; large histories slow parsing | Archive history during milestone completion; keep ≤3 milestone entries in active INTENT.md | >500 history lines (approximately 15+ milestones without archival) |
<!-- /section -->

<!-- section: ux -->
## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silently archiving outcomes without confirmation | User doesn't know what was archived or where it went; feels like data loss | Show summary: "Archived 7 outcomes (DO-72 through DO-78) to `.planning/milestones/v11.4-INTENT.md`" — match existing milestone complete output pattern |
| Archiving outcomes that are still relevant to the next milestone | User has to manually re-add outcomes they wanted to carry forward | During archival, distinguish "completed" outcomes from "ongoing" ones; only archive completed outcomes |
| No way to recover archived intents | If archival was premature, user has to manually reconstruct from the archive file | Provide `plan:intent restore --from v11.4` command, or at minimum document the archive file location in the completion output |
| Archive file location not discoverable | User can't find historical intents | List archive file in the `milestone complete` output alongside ROADMAP/REQUIREMENTS archives; add to MILESTONES.md entry |
<!-- /section -->

<!-- section: looks_done -->
## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Intent archival:** Often missing `<history>` section archival — verify that history entries for the completed milestone are moved to the archive file, not just outcomes and criteria
- [ ] **Intent archival:** Often missing ID continuity — verify that `getNextId()` produces IDs that don't collide with any historically-used ID after archival resets the active outcomes list
- [ ] **Milestone complete output:** Often missing the intent archive file in the result JSON — verify `result.archived` object (line 1222-1228 of `phase.js`) includes `intent: true/false`
- [ ] **Git commit scope:** Often missing INTENT.md in the commit — verify `.planning/INTENT.md` and `.planning/milestones/{version}-INTENT.md` are both in the `commitFiles` array
- [ ] **Plugin invalidation:** Often missing cache clear — verify `invalidateFileCache(intentPath)` is called after INTENT.md is rewritten
- [ ] **Guardrail update:** Often missing allowlist entry — verify `advisory-guardrails.js` line 109 includes the milestone complete command
- [ ] **Drift validation post-archival:** Often missing validation — run `plan:intent drift` after archival and verify score is 0 (no false positives from archived outcomes)
- [ ] **New-milestone workflow update:** Often missing conditional logic — verify Step 4.5 handles the case where previous milestone's outcomes were already archived
<!-- /section -->

<!-- section: recovery -->
## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Broken traceability (plans reference archived IDs) | LOW | Load archived intent file, reconstruct `validOutcomeIds` set by merging active + archived IDs; or modify trace to auto-fallback to milestone archives |
| History grew unbounded | LOW | One-time script: parse INTENT.md, split history by milestone, write older entries to archive files, keep last 3 in active |
| Partial archival left inconsistent state | LOW | Check `git status` for unstaged INTENT.md changes; if archive file exists and active file is stale, re-run the archival step manually |
| ID collision after reset | MEDIUM | Audit all plans' `intent.outcome_ids` frontmatter; rename colliding IDs in the newer milestone; update `getNextId()` to check archives |
| `new-milestone` skipped evolution because outcomes were already archived | LOW | Run `plan:intent show` on the archive file, manually re-add any ongoing outcomes via `plan:intent update outcomes --add "..." --reason "Carried forward from vX.Y"` |
| Plugin serves stale intent data | LOW | Restart the host editor session (clears module-level cache); or call `invalidateIntent()` via plugin API |
| Advisory guardrail blocks archival | LOW | Add `/bgsd-complete-milestone` to allowlist in `advisory-guardrails.js`; redeploy |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Broken traceability | Phase 1 (archival design) | `plan:intent trace` returns valid coverage after archival for both active and archived milestone plans |
| History unbounded growth | Phase 1 (archive history with outcomes) | INTENT.md `<history>` section has ≤3 milestone entries after archival |
| Partial archival failure | Phase 1 (snapshot-before-modify) | Simulate failure mid-archival; verify INTENT.md is restored to pre-archival state |
| ID collision | Phase 1 (monotonic ID design) | After archival + new milestone, `getNextId()` returns DO-79 (not DO-01) |
| `new-milestone` workflow gap | Phase 1 (workflow update) | Complete milestone → start new milestone → verify evolution questionnaire references archived outcomes |
| Plugin stale cache | Phase 2 (integration test) | Modify INTENT.md via CLI → verify plugin context builder reflects changes within 1 second |
| Advisory guardrail | Phase 1 (allowlist update) | Complete milestone with intent archival → no advisory warnings about INTENT.md |
<!-- /section -->

<!-- section: sources -->
## Sources

- `src/commands/phase.js` lines 848-1241 — `cmdMilestoneComplete()` implementation (direct code analysis)
- `src/commands/intent.js` lines 1-1260 — all intent CRUD and trace/drift commands (direct code analysis)
- `src/lib/helpers.js` lines 655-999 — `parseIntentMd()`, `generateIntentMd()`, `parsePlanIntent()` (direct code analysis)
- `workflows/complete-milestone.md` — milestone completion workflow (direct file analysis)
- `workflows/new-milestone.md` lines 40-119 — intent evolution during milestone start (direct file analysis)
- `src/plugin/context-builder.js` lines 74-93, 237-353 — sacred block and intent context injection (direct code analysis)
- `src/plugin/parsers/intent.js` — plugin-layer intent parser with module-level caching (direct code analysis)
- `src/plugin/advisory-guardrails.js` line 109 — INTENT.md modification guardrail (direct code analysis)
- `.planning/INTENT.md` — current intent state showing 10 history entries across 7 milestones (direct file analysis)
- `.planning/milestones/` — archive directory pattern with 53 existing files across 18 milestones (directory listing)

---
*Pitfalls research for: Intent Archival System (v11.4 Housekeeping)*
*Researched: 2026-03-13*
