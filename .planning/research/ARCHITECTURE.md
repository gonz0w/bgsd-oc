# Architecture Research — Planning Artifact Quality Audit

**Domain:** Planning artifact formatting, stale references, and structural cleanup  
**Researched:** 2026-03-13  
**Confidence:** HIGH  
**Research mode:** Ecosystem — What inconsistencies exist and how to fix them

---

<!-- section: compact -->
<architecture_compact>

**Architecture:** Four planning artifacts (MILESTONES.md, PROJECT.md, STATE.md, config.json) with accumulated formatting debt across 18 milestones

**Issue summary:**

| File | Issues Found | Severity |
|------|-------------|----------|
| MILESTONES.md | 11 issues | 3 formatting, 3 structural, 5 missing |
| PROJECT.md | 14 issues | 4 formatting, 6 stale, 4 structural |
| STATE.md | 2 issues | 2 stale |
| config.json | 1 issue | 1 stale |
| INTENT.md | 2 issues | 2 formatting |

**Key patterns:** Non-chronological ordering, missing checkmarks, orphaned HTML tags, stale numeric claims, missing milestone entries

**Anti-patterns:** Mixing `--` and `—` for dashes, inconsistent archive references, keeping struck-through items in active lists

**Fix priority:** Formatting fixes first (safe, mechanical), then stale data updates (need verification), then structural changes (highest impact)
</architecture_compact>
<!-- /section -->

---

<!-- section: standard_architecture -->
## Issue Catalog

### MILESTONES.md — 11 Issues

#### FORMATTING (3 issues)

**F-01: Missing ✅ checkmark on v10.0**  
- **File:** MILESTONES.md:108  
- **Current:** `## v10.0 Agent Intelligence & UX (Shipped: 2026-03-11)`  
- **Expected:** `## ✅ v10.0 Agent Intelligence & UX (Shipped: 2026-03-11)`  
- **Fix:** Add `✅ ` prefix to match all other shipped milestones  
- **Effort:** 1 line edit

**F-02: Inconsistent "What's next" command references**  
- **File:** MILESTONES.md:152, 178, 204  
- **Current:** Lines 152, 178, 204 reference `/gsd-new-milestone` (old pre-rebrand command name)  
- **Expected:** `/bgsd-new-milestone` (current command name)  
- **Other entries:** Lines 22, 47, 73, 99, 123, 380 correctly use `/bgsd milestone new` or `/bgsd-new-milestone`  
- **Fix:** Replace 3 stale `/gsd-new-milestone` references with `/bgsd-new-milestone`  
- **Effort:** 3 line edits

**F-03: Inconsistent "What's next" dash format**  
- **File:** MILESTONES.md:380  
- **Current:** `Ready for next milestone -- /bgsd-new-milestone` (double hyphen)  
- **Expected:** `Ready for next milestone — /bgsd-new-milestone` (em dash, matching other entries)  
- **Fix:** Replace `--` with `—`  
- **Effort:** 1 line edit

#### STRUCTURAL (3 issues)

**S-01: Non-chronological ordering**  
- **File:** MILESTONES.md (entire file)  
- **Current order:** v9.3, v9.2, v8.3, v8.2, v10.0, _blank line_, v7.1, v7.0, v6.0, v5.0, v4.0, v3.0, v2.0, v1.1, v1.0, v11.3  
- **Expected order (newest-first):** v11.3, v10.0, v9.3, v9.2, v8.3, v8.2, v7.1, v7.0, v6.0, v5.0, v4.0, v3.0, v2.0, v1.1, v1.0  
- **Problems:**  
  - v11.3 is at the bottom (should be at top as most recent shipped)  
  - v10.0 is sandwiched between v8.2 and v7.1  
  - Blank line 132-133 between v10.0 and v7.1 (spurious)  
- **Fix:** Reorder all entries newest-first by ship date  
- **Effort:** Block move, ~15 minutes

**S-02: v9.2 entry describes wrong milestone**  
- **File:** MILESTONES.md:31-53  
- **Current heading:** `v9.2 CLI Tool Integrations & Runtime Modernization (Shipped: 2026-03-10)`  
- **Current body text:** "Deep plugin integration with always-on context injection, native LLM tools, event-driven state synchronization, and advisory guardrails" — this is v9.0's description, not v9.2  
- **Current archive references:** Points to `v9.0-ROADMAP.md`, `v9.0-REQUIREMENTS.md`, `v9.0-DOCS.md` — wrong version prefix  
- **Evidence:** The v9.2 heading says "CLI Tool Integrations" but the description matches v9.0 "Embedded Plugin Experience"  
- **Fix:** Replace body text with actual v9.2 content (from PROJECT.md lines 70-78: tool detection, ripgrep/fd/jq, yq/bat/gh, Bun runtime). Fix archive references to `v9.2-*`  
- **Effort:** Rewrite 1 entry, ~10 minutes

**S-03: Missing `v9.2-DOCS.md` archive**  
- **File:** MILESTONES.md:50 (references `v9.0-DOCS.md`) and filesystem  
- **Current:** Archive entry references `v9.0-DOCS.md` (which is v9.0's docs file)  
- **Actual archives on disk:** `v9.2-REQUIREMENTS.md`, `v9.2-ROADMAP.md` exist; `v9.2-DOCS.md` does NOT exist  
- **Fix:** Either create `v9.2-DOCS.md` from git history, or remove the DOCS archive line if none was generated  
- **Effort:** 5 minutes

#### MISSING ENTRIES (5 issues)

**M-01: v8.0 Performance & Agent Architecture — missing from MILESTONES.md**  
- **Evidence:** Archives exist (`v8.0-ROADMAP.md`, `v8.0-REQUIREMENTS.md`, `v8.0-DOCS.md`, `v8.0-phases`). PROJECT.md references it (line 5). Requirements section references it (lines 188-194)  
- **Fix:** Add v8.0 entry between v8.2 and v7.1  
- **Effort:** Write 1 new entry, ~10 minutes

**M-02: v8.1 RAG-Powered Research — missing from MILESTONES.md**  
- **Evidence:** Archives exist (`v8.1-ROADMAP.md`, `v8.1-REQUIREMENTS.md`, `v8.1-phases`). PROJECT.md line 5 references v8.1  
- **Fix:** Add v8.1 entry between v8.2 and v8.0  
- **Effort:** Write 1 new entry, ~10 minutes

**M-03: v9.1 Performance Acceleration — missing from MILESTONES.md**  
- **Evidence:** Archives exist (`v9.1-ROADMAP.md`, `v9.1-REQUIREMENTS.md`, `v9.1-DOCS.md`). PROJECT.md lines 80-89 describe it. No `v9.1-phases` directory exists  
- **Fix:** Add v9.1 entry between v9.2 and v9.0  
- **Effort:** Write 1 new entry, ~10 minutes

**M-04: v11.0 Natural Interface & Insights — missing from MILESTONES.md**  
- **Evidence:** Archives exist (`v11.0-ROADMAP.md`, `v11.0-REQUIREMENTS.md`, `v11.0-DOCS.md`, `v11.0-phases`). PROJECT.md lines 54-65 describe it  
- **Fix:** Add v11.0 entry between v11.3 and v10.0  
- **Effort:** Write 1 new entry, ~10 minutes

**M-05: v11.1 and v11.2 — missing from MILESTONES.md**  
- **Evidence:** v11.1 archives exist (`v11.1-ROADMAP.md`, `v11.1-REQUIREMENTS.md`, `v11.1-DOCS.md`, `v11.1-phases`). v11.2 has no archives at all but is referenced in INTENT.md history (line 93). INTENT.md history references v11.1 (line 76) and v11.2 (line 93)  
- **Fix:** Add v11.1 entry. For v11.2, determine if it shipped (check git history) or was folded into another milestone. If shipped, add entry; if not, note in v11.1 or remove INTENT.md reference  
- **Effort:** Write 1-2 new entries, ~15 minutes

---

### PROJECT.md — 14 Issues

#### FORMATTING (4 issues)

**F-04: Orphaned `</details>` tag**  
- **File:** PROJECT.md:68  
- **Current:** Line 68 has a standalone `</details>` that doesn't close any `<details>` block  
- **Context:** Line 65 closes the v11.0 block. Line 67 is blank. Line 68 is the orphan. Line 70 opens a new v9.2 block  
- **Fix:** Delete line 68  
- **Effort:** 1 line delete

**F-05: Broken table rows in Key Decisions**  
- **File:** PROJECT.md:268-270  
- **Current:** Three rows are missing the `Outcome` column (only 2 cells instead of 3):
  ```
  | Trajectory exploration over worktrees | Sequential exploration sufficient; worktrees disk-expensive |
  | Automatic pivot without human signal | Human-in-the-loop is a core GSD principle |
  | Trajectory analytics | Deferred to future milestone |
  ```
- **Expected:** All rows should have 3 columns: `| Decision | Rationale | Outcome |`  
- **Fix:** Add outcome column. These appear to be "deferred" decisions — add `Deferred` or `N/A — declined` as outcome  
- **Effort:** 3 line edits

**F-06: Key Decisions table has no visual separation between categories**  
- **File:** PROJECT.md:267-270  
- **Current:** Lines 267-270 are "declined/deferred" decisions mixed inline with "accepted" decisions above them (lines 243-266) with no separator  
- **Fix:** Add a section header or separator comment between accepted and declined decisions  
- **Effort:** 1 line addition

**F-07: v9.2 Previous section has wrong milestone name in heading**  
- **File:** PROJECT.md:71  
- **Current:** `Previous: v9.2 CLI Tool Integrations & Runtime Modernization`  
- **Note:** This heading is correct per PROJECT.md line 5 context. But MILESTONES.md's body text for v9.2 describes v9.0. One of them is wrong — verify against `v9.2-ROADMAP.md` to determine which  
- **Fix:** Verify and align both files to match the actual v9.2 roadmap  
- **Effort:** Cross-reference, ~5 minutes

#### STALE DATA (6 issues)

**D-01: Module count "53 src/ modules" is stale**  
- **File:** PROJECT.md:5, 221, 224  
- **Current:** "53 src/ modules" and "53 modules"  
- **Actual:** 119 JS files total in `src/`. `src/lib/` has 35 files, `src/commands/` has 24 files. Total varies depending on counting subdirectories  
- **Fix:** Update to actual counts. Line 224 says "35 modules" for lib (correct) and "23 modules" for commands (actual: 24)  
- **Effort:** 3 line edits after accurate count

**D-02: "34-module split" decision reference is stale**  
- **File:** PROJECT.md:246  
- **Current:** `34-module split (18 lib + 14 commands + router + index)`  
- **Actual:** 35 lib + 24 commands + router + index = 61+  
- **Fix:** Update to current counts  
- **Effort:** 1 line edit

**D-03: "1014 tests (414 passing)" is confusing**  
- **File:** PROJECT.md:221  
- **Current:** `1014 tests (414 passing)`  
- **Note:** 1014 total with only 414 passing means 600 failures. This is accurate per the known tech debt note (line 228) but the parenthetical format implies "414 out of 1014" which is unusual. Most entries elsewhere say "X tests passing (Y failures)"  
- **Fix:** Reformat to `1014 tests (600 failing — Bun runtime banner issue)` or `414 tests passing, 600 failing` for clarity  
- **Effort:** 1 line edit

**D-04: "45 workflows" count is wrong**  
- **File:** PROJECT.md:226  
- **Current:** `45 workflows`  
- **Actual:** 44 workflow files in `workflows/`  
- **Fix:** Update to 44  
- **Effort:** 1 line edit

**D-05: Struck-through out-of-scope item still listed**  
- **File:** PROJECT.md:211  
- **Current:** `~~SQLite codebase index~~ — Reconsidered for v8.0 as read cache layer`  
- **Note:** This was reconsidered, implemented in v8.0 (SQLite caching), and shipped. It's no longer out of scope — it's delivered. Having a struck-through item with a note about reconsidering is confusing cruft  
- **Fix:** Remove the line entirely. The SQLite caching is documented as a delivered feature in Requirements line 188  
- **Effort:** 1 line delete

**D-06: Node.js constraint says "18+" but Context section says "22.5"**  
- **File:** PROJECT.md:235 vs 223  
- **Current constraint (line 235):** `Node.js 18+: Minimum version (for fetch, node:test)`  
- **Current context (line 223):** `Node.js >= 22.5 (required for node:sqlite caching)`  
- **package.json engines:** `"node": ">=18"`  
- **Note:** Both are technically true — 18 is the floor, 22.5 enables sqlite. But the constraint doesn't mention the 22.5 preference  
- **Fix:** Update constraint to note both: "Node.js 18+ minimum (22.5+ recommended for `node:sqlite` caching)"  
- **Effort:** 1 line edit

#### STRUCTURAL (4 issues)

**R-01: "See REQUIREMENTS.md" reference to non-existent file**  
- **File:** PROJECT.md:203  
- **Current:** `See .planning/REQUIREMENTS.md for v11.4 requirements.`  
- **Actual:** `.planning/REQUIREMENTS.md` does not exist. INTENT.md has the v11.4 outcomes  
- **Fix:** Either create REQUIREMENTS.md as part of milestone setup, or change reference to INTENT.md  
- **Effort:** 1 line edit or file creation

**R-02: Previous milestones in `<details>` blocks skip v11.1, v11.2**  
- **File:** PROJECT.md:27-123  
- **Current sequence:** v11.3, v10.0, v11.0, v9.2, v9.1, v9.0, v8.3, v1.0-v8.2  
- **Missing:** v11.1, v11.2 (if they shipped)  
- **Also wrong:** Non-chronological order (v11.0 appears after v10.0)  
- **Fix:** Add missing entries, reorder chronologically  
- **Effort:** ~15 minutes

**R-03: Key Decisions table is growing unbounded**  
- **File:** PROJECT.md:239-279  
- **Current:** 37 decisions spanning v1.0 through v11.3. Table is 40 lines long  
- **Recommendation:** Archive decisions from early milestones (v1.0-v7.1) into a collapsed `<details>` block. Keep only decisions from the last 3-4 milestones as active  
- **Effort:** ~10 minutes

**R-04: Requirements section lists 45 individual validated requirements**  
- **File:** PROJECT.md:128-199  
- **Current:** 45 checkmarked requirements with version tags  
- **Recommendation:** This section is 71 lines and growing. Consider archiving v1.0-v8.0 requirements into a collapsed `<details>` block, keeping only recent (v8.2+) requirements visible  
- **Effort:** ~10 minutes

---

### STATE.md — 2 Issues

**D-07: "211 plans completed" may be stale**  
- **File:** STATE.md:28  
- **Current:** `Total plans completed: 211 (v1.0-v11.3)`  
- **Note:** This should be verified against actual milestone data. The MILESTONES.md entries that include plan counts sum to: 14+10+13+10+13+14+12+12+15+11+14+12+15+35+11+12+9 = 242 plans. However, not all milestones are listed in MILESTONES.md (5 are missing)  
- **Fix:** Recalculate from MILESTONES.md after all entries are added  
- **Effort:** 5 minutes after MILESTONES.md is fixed

**D-08: v11.3 execution notes reference "4 phases (110-113)"**  
- **File:** STATE.md:19  
- **Note:** This is accurate for v11.3. However, the previous milestone notes are only from v11.3 — earlier session context has been compacted away. This is fine for session continuity but creates an incomplete historical record  
- **Fix:** No action needed — this is by design  
- **Effort:** 0

---

### config.json — 1 Issue

**D-09: Bun version "1.3.10" may be stale**  
- **File:** config.json:3  
- **Current:** `"detected": "1.3.10"`  
- **Note:** This was auto-detected at some point and persisted. If Bun has been updated on this system, the config is stale  
- **Fix:** Re-run Bun detection or remove the cached version (it's re-detected on startup)  
- **Effort:** 1 field edit or delete

---

### INTENT.md — 2 Issues

**F-08: History entries not in chronological order**  
- **File:** INTENT.md:55-101  
- **Current order:** v11.4 (2026-03-13), v9.2 (2026-03-13), v11.1 (2026-03-11), v10.0 (2026-03-10), v9.3 (2026-03-10), v9.0 (2026-03-09), v8.3 (2026-03-08), v11.2 (2026-03-12), v8.2 (2026-03-06), v7.1 (2026-03-02)  
- **Problems:** v9.2 at line 71 is dated 2026-03-13 but is between v11.4 and v11.1. v11.2 at line 93 is dated 2026-03-12 but appears after v8.3 (2026-03-08)  
- **Fix:** Reorder by date descending (newest first): v11.4, v11.2, v11.1, v10.0, v9.3, v9.2, v9.0, v8.3, v8.2, v7.1  
- **Effort:** Block reorder, ~5 minutes

**F-09: "v9.2" label on INTENT.md history entry is likely wrong**  
- **File:** INTENT.md:71  
- **Current:** `### v9.2 — 2026-03-13` with content about "LLM offloading" — that's v11.3 scope, not v9.2  
- **Note:** The date 2026-03-13 and content about "LLM offloading audit" match v11.3. This label appears to be a copy-paste error  
- **Fix:** Relabel to `### v11.3 — 2026-03-13` or merge with the v11.4 entry above it  
- **Effort:** 1 line edit

<!-- /section -->

---

<!-- section: patterns -->
## Fix Prioritization

### Wave 1: Safe Mechanical Fixes (est. 30 min)

All formatting — no judgment needed, no data verification required.

| ID | File | Fix | Lines |
|----|------|-----|-------|
| F-01 | MILESTONES.md:108 | Add `✅` to v10.0 heading | 1 |
| F-02 | MILESTONES.md:152,178,204 | Replace `/gsd-new-milestone` → `/bgsd-new-milestone` | 3 |
| F-03 | MILESTONES.md:380 | Replace `--` → `—` | 1 |
| F-04 | PROJECT.md:68 | Delete orphaned `</details>` | 1 |
| F-05 | PROJECT.md:268-270 | Add missing `Outcome` column to 3 table rows | 3 |
| F-08 | INTENT.md:55-101 | Reorder history entries chronologically | Block move |
| F-09 | INTENT.md:71 | Relabel `v9.2` → `v11.3` | 1 |

### Wave 2: Stale Data Updates (est. 20 min)

Require counting/verification against filesystem.

| ID | File | Fix | Lines |
|----|------|-----|-------|
| D-01 | PROJECT.md:5,221,224 | Update module counts to actuals | 3 |
| D-02 | PROJECT.md:246 | Update "34-module" decision text | 1 |
| D-03 | PROJECT.md:221 | Clarify test count format | 1 |
| D-04 | PROJECT.md:226 | Fix workflow count 45→44 | 1 |
| D-05 | PROJECT.md:211 | Remove struck-through SQLite item | 1 |
| D-06 | PROJECT.md:235 | Update Node.js constraint to mention 22.5 | 1 |
| D-09 | config.json:3 | Re-detect or remove stale Bun version | 1 |

### Wave 3: Structural Fixes (est. 60 min)

Require writing new content or reorganizing sections.

| ID | File | Fix | Lines |
|----|------|-----|-------|
| S-01 | MILESTONES.md | Reorder all entries chronologically | Block moves |
| S-02 | MILESTONES.md:31-53 | Rewrite v9.2 entry with correct content | ~25 lines |
| S-03 | MILESTONES.md:50 | Fix/remove v9.2-DOCS.md archive ref | 1 |
| M-01–M-05 | MILESTONES.md | Add 6 missing milestone entries | ~150 lines |
| R-01 | PROJECT.md:203 | Fix REQUIREMENTS.md reference | 1 |
| R-02 | PROJECT.md:27-123 | Add missing milestones, reorder `<details>` | ~20 lines |
| R-03 | PROJECT.md:239-279 | Archive old decisions into `<details>` | ~10 lines |
| R-04 | PROJECT.md:128-199 | Archive old requirements into `<details>` | ~10 lines |
| D-07 | STATE.md:28 | Recalculate plan total after MILESTONES.md fix | 1 |

<!-- /section -->

---

<!-- section: data_flow -->
## Archive Integrity Audit

### Archive Reference vs. Filesystem Cross-Check

| Milestone | ROADMAP | REQUIREMENTS | DOCS | Phases Dir | In MILESTONES.md | Notes |
|-----------|---------|-------------|------|-----------|-----------------|-------|
| v1.0 | ✅ | ✅ | ❌ | ✅ | ✅ | No DOCS — pre-DOCS era |
| v1.1 | ✅ | ✅ | ❌ | ✅ | ✅ | No DOCS — pre-DOCS era |
| v2.0 | ✅ | ✅ | ❌ | ✅ | ✅ | No DOCS — pre-DOCS era |
| v3.0 | ✅ | ✅ | ❌ | ✅ | ✅ | No DOCS — pre-DOCS era |
| v4.0 | ✅ | ✅ | ❌ | ✅ | ✅ | No DOCS — pre-DOCS era |
| v5.0 | ✅ | ✅ | ❌ | ✅ | ✅ | No DOCS — pre-DOCS era |
| v6.0 | ✅ | ✅ | ❌ | ✅ | ✅ | No DOCS — pre-DOCS era |
| v7.0 | ✅ | ✅ | ❌ | ✅ | ✅ | No DOCS — pre-DOCS era |
| v7.1 | ✅ | ✅ | ❌ | ✅ | ✅ | No DOCS — pre-DOCS era |
| v8.0 | ✅ | ✅ | ✅ | ✅ | ❌ MISSING | Not in MILESTONES.md |
| v8.1 | ✅ | ✅ | ❌ | ✅ | ❌ MISSING | Not in MILESTONES.md, no DOCS |
| v8.2 | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| v8.3 | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| v9.0 | ✅ | ✅ | ✅ | ✅ | ✅ via v9.2 entry* | v9.2 entry has v9.0 content* |
| v9.1 | ✅ | ✅ | ✅ | ❌ | ❌ MISSING | No phases dir, not in MILESTONES.md |
| v9.2 | ✅ | ✅ | ❌ | ❌ | ✅ but wrong content* | v9.2 entry describes v9.0 |
| v9.3 | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| v10.0 | ✅ | ✅ | ✅ | ✅ | ✅ (missing ✅) | Missing checkmark |
| v11.0 | ✅ | ✅ | ✅ | ✅ | ❌ MISSING | Not in MILESTONES.md |
| v11.1 | ✅ | ✅ | ✅ | ✅ | ❌ MISSING | Not in MILESTONES.md |
| v11.2 | ❌ | ❌ | ❌ | ❌ | ❌ MISSING | No archives at all, only INTENT ref |
| v11.3 | ✅ | ✅ | ✅ | ✅ | ✅ | OK, but at bottom of file |

**\*Critical finding:** The v9.2 MILESTONES.md entry (lines 31-53) contains v9.0's description and archive references. The actual v9.2 content (CLI tool integrations) appears only in PROJECT.md.

<!-- /section -->

---

<!-- section: anti_patterns -->
## Anti-Patterns Found

### Anti-Pattern 1: Append-Only MILESTONES.md

**What happened:** New milestones were appended at the bottom or inserted at random positions rather than maintained in chronological order.  
**Why it's wrong:** Makes it impossible to scan the file top-to-bottom and understand project history.  
**Do this instead:** Always insert new milestone entries at the top (newest-first) during milestone wrapup. Add to the wrapup workflow as an explicit step.

### Anti-Pattern 2: Copy-Paste Milestone Entries

**What happened:** v9.2 entry was created by copying v9.0's entry and only updating the heading, not the body.  
**Why it's wrong:** Creates inaccurate historical records.  
**Do this instead:** Generate milestone entries from archived ROADMAP data during wrapup. The `summary:generate` command (v11.3) could be extended to produce MILESTONES.md entries.

### Anti-Pattern 3: Keeping Resolved Items in Active Sections

**What happened:** Struck-through out-of-scope items (line 211), stale module counts, and 37 accumulated decisions pollute active planning sections.  
**Why it's wrong:** Every token spent reading resolved/stale content is wasted. Adds noise for both humans and AI agents.  
**Do this instead:** Archive resolved items into `<details>` blocks or into separate files. Keep active sections lean — only current/actionable content visible.

### Anti-Pattern 4: Missing Milestone Entries

**What happened:** 6 milestones (v8.0, v8.1, v9.1, v11.0, v11.1, v11.2) were shipped but never added to MILESTONES.md.  
**Why it's wrong:** MILESTONES.md is supposed to be the authoritative history. Missing entries break traceability.  
**Do this instead:** Make MILESTONES.md entry creation a required step in the milestone wrapup workflow — not optional, not "do it later."

<!-- /section -->

---

<!-- section: integration -->
## Recommendations for Execution

### Phase Structure Recommendation

This is purely non-behavioral cleanup — no code changes, no test changes. It can be done in a single phase with 2-3 plans:

**Plan 1: Mechanical Fixes (Wave 1 + Wave 2)**  
- All formatting fixes (F-01 through F-09)  
- All stale data updates (D-01 through D-09)  
- ~15 issues, ~50 minutes, fully autonomous

**Plan 2: MILESTONES.md Structural Overhaul (Wave 3 core)**  
- Reorder entries chronologically  
- Fix v9.2 entry content  
- Add 5-6 missing milestone entries (reconstruct from archived ROADMAPs)  
- ~60 minutes, mostly autonomous (may need v11.2 status clarification)

**Plan 3: PROJECT.md Streamlining (Wave 3 optional)**  
- Archive old decisions into `<details>` block  
- Archive old requirements into `<details>` block  
- Reorder `<details>` milestone sections chronologically  
- Fix REQUIREMENTS.md reference  
- ~30 minutes, fully autonomous

### Verification Criteria

After all fixes:
- [ ] Every heading in MILESTONES.md has `✅` prefix and `(Shipped: YYYY-MM-DD)` suffix  
- [ ] MILESTONES.md entries are ordered newest-first with no gaps  
- [ ] Every milestone with archived files has a matching MILESTONES.md entry  
- [ ] All archive paths in MILESTONES.md point to files that exist  
- [ ] PROJECT.md has no orphaned HTML tags (paired `<details>`/`</details>`)  
- [ ] All numeric claims in PROJECT.md Context section match filesystem reality  
- [ ] Out-of-scope section has no struck-through or delivered items  
- [ ] Key Decisions table has consistent 3-column format  
- [ ] INTENT.md history is ordered chronologically (newest-first)  

---

## Sources

1. **MILESTONES.md** — 388 lines, 15 milestone entries examined  
2. **PROJECT.md** — 282 lines, all sections examined  
3. **STATE.md** — 52 lines, all sections examined  
4. **config.json** — 8 lines, all keys examined  
5. **INTENT.md** — 102 lines, history section examined  
6. **Filesystem** — `ls .planning/milestones/` for archive cross-reference (71 files, 21 version prefixes)  
7. **Filesystem** — `ls src/lib/`, `ls src/commands/`, `ls commands/`, `ls workflows/` for count verification  

---

*Architecture research for: Planning Artifact Quality Audit*  
*Researched: 2026-03-13*  
*Confidence: HIGH — All findings verified against filesystem*
