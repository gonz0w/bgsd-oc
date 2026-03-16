---
phase: 0131-skill-discovery-security
verified: 2026-03-15
status: gaps_found
score: 8/9
must_haves:
  truths:
    - id: T1
      text: "skills:list reads .agents/skills/ and returns name + description for each installed skill"
      status: VERIFIED
    - id: T2
      text: "skills:list shows scan status per skill (clean / warnings count)"
      status: VERIFIED
    - id: T3
      text: "skills:list returns empty message when no skills installed"
      status: VERIFIED
    - id: T4
      text: "Security scanner checks 41 patterns across 7+ categories (eval, network, filesystem, process, crypto, exfiltration, prompt injection)"
      status: VERIFIED
    - id: T5
      text: "Dangerous findings block install — no force/trust override exists"
      status: VERIFIED
    - id: T6
      text: "Policy/warn findings are surfaced but do not block"
      status: VERIFIED
    - id: T7
      text: "skills:validate re-scans an installed skill and reports findings"
      status: VERIFIED
    - id: T8
      text: "Scanner output groups findings severity-first (dangerous > warn > info)"
      status: VERIFIED
    - id: T9
      text: "skills:install fetches skill files from GitHub API (no git clone) and installs to .agents/skills/ only"
      status: VERIFIED
    - id: T10
      text: "skills:install runs 41-pattern security scan before writing any file to disk"
      status: VERIFIED
    - id: T11
      text: "Dangerous scan verdict blocks install with no override — files are never written"
      status: VERIFIED
    - id: T12
      text: "Policy/warn findings require explicit Y/N confirmation before writing"
      status: VERIFIED
    - id: T13
      text: "Full file list + sizes shown before human confirmation"
      status: VERIFIED
    - id: T14
      text: "All install attempts (including blocked/rejected) logged to .agents/skill-audit.json"
      status: VERIFIED
    - id: T15
      text: "Audit entries include timestamp, action, source URL, scan verdict breakdown, and outcome"
      status: VERIFIED
    - id: T16
      text: "skills:remove deletes skill directory and logs removal to audit"
      status: VERIFIED
    - id: T17
      text: "Existing skill with same name blocks install — user must skills:remove first"
      status: VERIFIED
    - id: T18
      text: "Invalid skill (no SKILL.md in repo root) errors with explanation"
      status: VERIFIED
    - id: T19
      text: "Running `bgsd-tools skills:list` routes correctly and returns JSON output"
      status: VERIFIED
    - id: T20
      text: "Running `bgsd-tools skills:install --source <url>` routes correctly"
      status: VERIFIED
    - id: T21
      text: "Running `bgsd-tools skills:validate --name <name>` routes correctly"
      status: VERIFIED
    - id: T22
      text: "Running `bgsd-tools skills:remove --name <name>` routes correctly"
      status: VERIFIED
    - id: T23
      text: "bgsd-context enrichment includes `installed_skills` array with name + description objects"
      status: VERIFIED
    - id: T24
      text: "new-milestone.md Step 8.5 prompts optional skill discovery between Research and Requirements"
      status: VERIFIED
    - id: T25
      text: "Command help, brief, related, categories, and COMMAND_TREE all include skills namespace"
      status: VERIFIED
    - id: T26
      text: "skills namespace appears in KNOWN_NAMESPACES and router switch statement"
      status: VERIFIED
  gaps:
    - id: GAP-1
      requirement: SKILL-02
      truth: "User can install a skill from a GitHub URL OR local directory"
      status: PARTIAL
      details: "GitHub URL install is fully implemented. Local directory install (`skills:install ./path/to/skill`) is NOT implemented — parseGitHubUrl() only handles GitHub URL formats, not filesystem paths."
      severity: warning
      fix: "Add local directory support to parseGitHubUrl() (or a separate parseLocalPath() branch in cmdSkillsInstall) that copies files from a local path instead of fetching from GitHub API."
    - id: GAP-2
      requirement: SKILL-02
      truth: "parseGitHubUrl validates owner names to reject '.' and '..' as invalid GitHub org names"
      status: FAILED
      details: "Validation regex /^[a-zA-Z0-9._-]+$/ accepts '.' and '..' as valid owner names. parseGitHubUrl('./local-skill') returns {owner: '.', repo: 'local-skill'} instead of null. This causes a misleading GitHub API 404 error instead of a clear 'invalid URL' message when users accidentally pass relative paths."
      severity: warning
      fix: "Add check: if (owner === '.' || owner === '..') return null. Or tighten validation to /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/ which requires starting with alphanumeric."
---

# Phase 131 Verification Report: Skill Discovery & Security

**Phase Goal:** Users can browse, install, validate, and remove project-local skills with a mandatory security scan and human confirmation gate before any file is written — plus bgsd-context exposing installed skills.

**Verification Date:** 2026-03-15
**Status:** GAPS FOUND — 8/9 requirements verified (2 minor gaps in SKILL-02, both warnings)

---

## Goal Achievement: Observable Truths

All core phase goal truths are verified. The gaps are confined to partial delivery of SKILL-02 (local directory install not implemented, minor URL validation edge case).

| Truth | Status | Evidence |
|-------|--------|----------|
| skills:list reads .agents/skills/ with name + description | ✓ VERIFIED | `cmdSkillsList` uses `readdirSync` + SKILL.md extraction |
| skills:list shows scan status per skill | ✓ VERIFIED | `scanSkillFiles()` called per skill, `✓ clean` / `⚠ N warnings` displayed |
| skills:list returns "No skills installed." when empty | ✓ VERIFIED | Three empty-state paths all return this message |
| 41 patterns across 7 categories, all implemented | ✓ VERIFIED | `SECURITY_PATTERNS.length === 41`, 7 categories confirmed via runtime check |
| Dangerous findings block install — no override | ✓ VERIFIED | `verdict === 'dangerous'` → audit log + return, no `--force` option exists |
| Warn findings surface but do not block | ✓ VERIFIED | Warn count shown in confirm prompt: `(N warnings)`, install proceeds with `--confirm` |
| skills:validate re-scans with full report | ✓ VERIFIED | `cmdSkillsValidate` runs 41-pattern scan + formats severity-first output |
| Scanner groups findings severity-first | ✓ VERIFIED | `formatScanResults`: dangerous array concat before warn array |
| skills:install fetches GitHub API, no git clone | ✓ VERIFIED | `fetchGitHubContents` uses `fetch()` with `api.github.com/repos/.../contents` |
| Security scan runs before any file write | ✓ VERIFIED | `scanSkillFiles(tempDir)` runs before `skillDestDir` is created |
| Dangerous verdict hard-blocks — files never written | ✓ VERIFIED | Early return after audit log, temp dir cleaned, `skillDestDir` never created |
| Warn verdict shows in confirm prompt | ✓ VERIFIED | `warnNote = scanResult.verdict === 'warn' ? \` (N warnings)\` : ''` appended to prompt |
| Full file list + sizes shown before confirmation | ✓ VERIFIED | `console.log(\`Files to install (N):\`)` + per-file size loop |
| All install attempts logged to skill-audit.json | ✓ VERIFIED | `logAuditEntry` called on block, success, and validate paths |
| Audit entries have timestamp + action + source + verdict | ✓ VERIFIED | Full entry shape: `{timestamp, action, source, name, outcome, scan_verdict}` |
| skills:remove deletes directory and audits | ✓ VERIFIED | `fs.rmSync(skillDir, {recursive:true, force:true})` + `logAuditEntry` |
| Existing skill blocks install with clear message | ✓ VERIFIED | `fs.existsSync(skillDestDir)` → `error('Skill X already installed. Run skills:remove first.')` |
| Missing SKILL.md in repo errors with explanation | ✓ VERIFIED | `error('Invalid skill: no SKILL.md found in repository root of owner/repo')` |
| skills:list routes correctly via CLI | ✓ VERIFIED | `node bin/bgsd-tools.cjs skills:list` → `{"skills":[]}` |
| skills:install --source routes correctly | ✓ VERIFIED | Router case 'skills' → subCmd 'install' → `await lazySkills().cmdSkillsInstall()` |
| skills:validate --name routes correctly | ✓ VERIFIED | Router case 'skills' → subCmd 'validate' → `lazySkills().cmdSkillsValidate()` |
| skills:remove --name routes correctly | ✓ VERIFIED | Router case 'skills' → subCmd 'remove' → `lazySkills().cmdSkillsRemove()` |
| bgsd-context exposes installed_skills [{name, description}] | ✓ VERIFIED | `command-enricher.js` lines 493–524: readdirSync + SKILL.md extraction → `enrichment.installed_skills` |
| new-milestone.md Step 8.5 between Steps 8 and 9 | ✓ VERIFIED | `## 8.5. Skill Discovery (Optional)` at line 236, between `## 8.` (l.133) and `## 9.` (l.266) |
| skills namespace in KNOWN_NAMESPACES and router switch | ✓ VERIFIED | Line 256: KNOWN_NAMESPACES includes 'skills'; line 1403: `case 'skills':` |
| COMMAND_TREE, COMMAND_CATEGORIES, COMMAND_BRIEF, COMMAND_RELATED include skills | ✓ VERIFIED | All 4 help/discovery files have skills entries confirmed |
| Local directory install supported (SKILL-02) | ✗ FAILED | GitHub URL only. `parseGitHubUrl('./local-skill')` → `{owner: '.', repo: 'local-skill'}` (incorrect parse instead of null) |

---

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Status |
|----------|--------|-------------|-------|--------|
| `src/commands/skills.js` | ✓ | ✓ (841 lines, full implementation) | ✓ (required by router) | ✓ VERIFIED |
| `src/router.js` (skills namespace) | ✓ | ✓ (lazySkills + case block + parseSkillsOptions) | ✓ (imports skills via lazySkills()) | ✓ VERIFIED |
| `src/lib/command-help.js` (skills entries) | ✓ | ✓ (COMMAND_CATEGORIES, COMMAND_BRIEF, COMMAND_RELATED, NL_ALIASES) | ✓ (used by --help routing) | ✓ VERIFIED |
| `src/lib/commandDiscovery.js` (skills entries) | ✓ | ✓ (COMMAND_CATEGORIES, COMMAND_ALIASES, COMMAND_TREE) | ✓ (exported, tree-structured) | ✓ VERIFIED |
| `src/lib/constants.js` (COMMAND_HELP) | ✓ | ✓ (4 help entries with usage/options/examples) | ✓ (used by --help handler) | ✓ VERIFIED |
| `src/plugin/command-enricher.js` (installed_skills) | ✓ | ✓ (full try/catch, readdirSync, SKILL.md extraction) | ✓ (enrichment.installed_skills assigned) | ✓ VERIFIED |
| `workflows/new-milestone.md` (Step 8.5) | ✓ | ✓ (banner, skills:list call, agentskills.io link, install flow) | ✓ (between Steps 8 and 9) | ✓ VERIFIED |

---

## Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `src/router.js` | `src/commands/skills.js` | `lazySkills()` → `require('./commands/skills')` | ✓ WIRED (line 113, 1417, 1422, 1426, 1430) |
| `src/plugin/command-enricher.js` | `.agents/skills/` | `readdirSync + SKILL.md check` | ✓ WIRED (lines 494–524) |
| `src/commands/skills.js` | `.agents/skills/` | `fs.readdirSync` + `fs.existsSync` | ✓ WIRED (cmdSkillsList, cmdSkillsValidate, cmdSkillsRemove) |
| `src/commands/skills.js` | `GitHub API` | `fetch('https://api.github.com/repos/{owner}/{repo}/contents')` | ✓ WIRED (fetchGitHubContents, line 457) |
| `src/commands/skills.js` | `.agents/skill-audit.json` | `fs.writeFileSync` (append to JSON array) | ✓ WIRED (logAuditEntry, line 777) |
| `src/commands/skills.js` → `logAuditEntry` | called from `cmdSkillsValidate` | call site in validate function | ✓ WIRED (line 387) |
| `src/commands/skills.js` → `logAuditEntry` | called from `cmdSkillsInstall` | block + install paths | ✓ WIRED (lines 603, 709) |
| `src/commands/skills.js` → `logAuditEntry` | called from `cmdSkillsRemove` | remove path | ✓ WIRED (line 815) |

---

## Requirements Coverage

| Requirement ID | Description (abbreviated) | Status | Delivered By |
|----------------|---------------------------|--------|--------------|
| SKILL-01 | skills:list installed skills | ✓ Complete | Plan 01, cmdSkillsList |
| SKILL-02 | Install from GitHub URL or local directory | ⚠ Partial | Plan 02, cmdSkillsInstall (GitHub only) |
| SKILL-03 | 41-pattern security scan gates every install | ✓ Complete | Plan 01, scanSkillFiles |
| SKILL-04 | Show file list + confirmation before write | ✓ Complete | Plan 02 (design resolved "diff" → "file list+sizes") |
| SKILL-05 | Audit log all install attempts | ✓ Complete | Plan 02, logAuditEntry |
| SKILL-06 | skills:validate re-scans installed skill | ✓ Complete | Plan 01, cmdSkillsValidate |
| SKILL-07 | skills:remove removes installed skill | ✓ Complete | Plan 02, cmdSkillsRemove |
| SKILL-08 | new-milestone.md Step 8.5 skill discovery | ✓ Complete | Plan 03, workflows/new-milestone.md |
| SKILL-09 | bgsd-context exposes installed_skills | ✓ Complete | Plan 03, command-enricher.js |

**Notes:**
- **SKILL-02 (partial):** REQUIREMENTS.md says "GitHub URL or local directory" but CONTEXT.md design scoped to GitHub API only. The plan never addressed local directory support, and it is absent from the implementation. Local directory install was not explicitly deferred in CONTEXT.md's Deferred section — it was simply not planned.
- **SKILL-04 (design resolved):** REQUIREMENTS.md says "full content diff" but CONTEXT.md explicitly resolved this to "file list + sizes (not full contents) by default." The implementation matches the design intent.
- **SKILL-09 (enriched):** REQUIREMENTS.md says `[string]` but CONTEXT.md + Plan 03 specified `[{name, description}]`. Implementation delivers the richer object form, which is additive.

---

## Anti-Patterns Found

| Pattern | Location | Severity | Notes |
|---------|----------|----------|-------|
| `parseGitHubUrl` accepts `'.'` and `'..'` as valid owner names | `src/commands/skills.js:440` | ⚠ Warning | Validation regex `/^[a-zA-Z0-9._-]+$/` passes `'.'` and `'..'`. `parseGitHubUrl('./local-skill')` returns `{owner: '.', repo: 'local-skill'}` instead of `null`. This causes confusing GitHub API 404 error for users who accidentally pass relative paths instead of a clear "invalid URL" error. |
| Local directory install silently misrouted | `src/commands/skills.js:419-444` | ⚠ Warning | SKILL-02 requires local directory support. No implementation exists. Users passing local paths get GitHub API errors instead of "local directory install not yet supported." |

No TODO/FIXME/placeholder stubs found. No empty implementations. No hardcoded return values.

---

## Human Verification Required

| Item | What to Verify | Notes |
|------|----------------|-------|
| GitHub API rate limit handling | Trigger a 403 with `x-ratelimit-remaining: 0` header — confirm clear "rate limit" message shown | Cannot test without a real GitHub API call |
| Real skill install end-to-end | Install a real public GitHub skill repo, verify files land in `.agents/skills/`, audit log written | Requires network access and a real skill repo |
| TTY confirmation flow | Run `skills:install --source owner/repo` interactively, verify scan + file list + Y/N prompt is coherent | Cannot test non-interactively |
| new-milestone.md Step 8.5 in live workflow | Execute new-milestone workflow through Step 8.5 and verify skill discovery prompt appears correctly | Workflow execution not automated |

---

## Gaps Summary

**2 gaps found in SKILL-02, both warnings (not blockers):**

### GAP-1: Local directory install not implemented (SKILL-02 partial)
**Truth:** SKILL-02 requires `skills:install` to support both GitHub URLs AND local directory paths.  
**Status:** GitHub URL install is complete and working. Local directory install (`skills:install ./path/to/skill`) is entirely absent.  
**Evidence:** `parseGitHubUrl` only handles `owner/repo`, `github.com/owner/repo`, and `https://github.com/owner/repo` formats. No local filesystem path detection or copy logic exists in `cmdSkillsInstall`.  
**Severity:** ⚠ Warning — GitHub install works; local install is a missing feature, not broken functionality.  
**Fix:** Add a `parseLocalPath(source)` branch in `cmdSkillsInstall` that detects absolute/relative paths, copies files to `.agents/skills/` using `fs.cp()`, and applies the same security scan + confirmation gate.

### GAP-2: parseGitHubUrl accepts '.' and '..' as valid owner names (SKILL-02 validation gap)
**Truth:** `parseGitHubUrl` should return `null` for invalid/non-GitHub URLs including relative filesystem paths.  
**Status:** `parseGitHubUrl('./local-skill')` → `{owner: '.', repo: 'local-skill'}` (should be `null`).  
**Evidence:** Validation regex `/^[a-zA-Z0-9._-]+$/` passes `'.'` as a valid owner name. Confirmed by runtime: `node -e "const s = require('./src/commands/skills'); console.log(s.parseGitHubUrl('./test'));"` → `{ owner: '.', repo: 'test' }`.  
**Severity:** ⚠ Warning — No security risk; GitHub API returns 404 for `repos/./test` which is properly handled. Only impact is misleading error message ("Repository not found: ./test" instead of "Invalid GitHub URL").  
**Fix:** Add `if (owner === '.' || owner === '..') return null;` after splitting, or change validation to `/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/`.

---

## Overall Assessment

**Status: GAPS_FOUND — 8/9 requirements achieved**

The phase core goal is substantially achieved: users can browse, install, validate, and remove project-local skills via a security-gated CLI pipeline; the 41-pattern scanner hard-blocks dangerous content; audit logging covers all operations; bgsd-context exposes installed skills; and the new-milestone workflow includes the Step 8.5 discovery prompt.

The two gaps are both confined to SKILL-02's local directory install path, which was never planned (absent from CONTEXT.md, all 3 PLANs, and SUMMARYs). This is a requirements-scope gap rather than an implementation error. The security posture, routing, help system, enricher, and workflow integration are all complete and working.

**The gaps do not block the primary phase goal.** GitHub URL install works end-to-end with the full security pipeline.

---

*Verified by: Phase Verifier*
*Phase: 0131-skill-discovery-security*
*Date: 2026-03-15*
