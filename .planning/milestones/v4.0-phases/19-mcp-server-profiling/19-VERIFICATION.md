---
phase: 19-mcp-server-profiling
verified: 2026-02-25T16:05:57Z
status: passed
score: 4/4 must-haves verified
---

# Phase 19: MCP Server Profiling Verification Report

**Phase Goal:** Users can see exactly how many tokens their MCP servers consume and get actionable recommendations to reduce context waste
**Verified:** 2026-02-25T16:05:57Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `mcp-profile` lists all configured servers from opencode.json and .mcp.json with transport type and command | ✓ VERIFIED | `discoverMcpServers()` reads 3 sources (.mcp.json, opencode.json, ~/.config/opencode/opencode.json) with priority dedup. Each server has name, source, transport, command fields. Live test returns 2 servers. 15+ discovery tests pass. |
| 2 | `mcp-profile` shows per-server token cost estimate and total context window percentage | ✓ VERIFIED | `estimateTokenCost()` matches against 20-server known-DB with regex patterns. Each server entry has `token_estimate`, `context_percent`, `tool_count`, `token_source` fields. `total_tokens` and `total_context_percent` in output. `--window` flag works (tested with 100000). |
| 3 | `mcp-profile` scores each server as relevant/possibly-relevant/not-relevant and recommends keep/disable/review with reasoning | ✓ VERIFIED | `scoreServerRelevance()` uses 16-entry RELEVANCE_INDICATORS with filesystem checks, env hints, always_relevant flags, and low-cost threshold. `generateRecommendations()` maps scores to keep/disable/review with human-readable reasoning. Output includes `relevance`, `recommendation`, `recommendation_reason`, `total_potential_savings`, `potential_savings_percent`, `recommendations_summary`. 8 relevance tests pass. |
| 4 | `mcp-profile --apply` disables recommended servers in config with backup, and `--restore` undoes the change | ✓ VERIFIED | `applyRecommendations()` creates `opencode.json.bak` backup via `copyFileSync`, sets `enabled: false` on disable-recommended servers from opencode.json only (skips .mcp.json). `restoreBackup()` copies .bak back and deletes it. `--dry-run` previews without modifying. 9 apply/restore tests pass including idempotency and config preservation. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/commands/mcp.js` | MCP profiling command module | ✓ VERIFIED | 405 lines. Exports: cmdMcpProfile, discoverMcpServers, estimateTokenCost, scoreServerRelevance, generateRecommendations, applyRecommendations, restoreBackup, MCP_KNOWN_SERVERS, RELEVANCE_INDICATORS + 6 internal helpers. No TODOs, no stubs, no console.log. |
| `src/router.js` | mcp-profile command routing | ✓ VERIFIED | Lines 76-77: imports `cmdMcpProfile` from `./commands/mcp`. Lines 733-746: `case 'mcp-profile'` and `case 'mcp'` with profile subcommand dispatch. |
| `src/lib/constants.js` | COMMAND_HELP entries | ✓ VERIFIED | Lines 912-938: `mcp-profile` help with all flags (--window, --apply, --dry-run, --restore, --raw). Line 932: `mcp` subcommand help. |
| `bin/gsd-tools.cjs` | Bundled output | ✓ VERIFIED | 500.5 KB (512,509 bytes). Within ~500KB budget. |
| `bin/gsd-tools.test.cjs` | Comprehensive test suite | ✓ VERIFIED | 32 test cases across 5 describe blocks: server discovery (15 tests), mcp subcommand syntax (1), relevance scoring (8), apply and restore (9). All pass (436 total test suite: 436 pass, 0 fail). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/commands/mcp.js | .mcp.json | fs.readFileSync + JSON.parse | ✓ WIRED | Line 70: reads `data.mcpServers`, Line 72: iterates entries, Line 96: `path.join(cwd, '.mcp.json')` |
| src/commands/mcp.js | opencode.json | fs.readFileSync + JSON.parse | ✓ WIRED | Line 81: reads `data.mcp`, Line 83: iterates entries, Line 97: `path.join(cwd, 'opencode.json')` |
| src/router.js | src/commands/mcp.js | require + case dispatch | ✓ WIRED | Line 77: `require('./commands/mcp')`, Lines 733-746: two case routes |
| scoreServerRelevance | project filesystem | fs.existsSync checks | ✓ WIRED | Line 204: `fs.existsSync(path.join(cwd, file))` for indicator files |
| generateRecommendations | scoreServerRelevance | function call per server | ✓ WIRED | Line 229: `scoreServerRelevance(server, cwd)` called in map |
| cmdMcpProfile | generateRecommendations | enriches server list | ✓ WIRED | Line 358: `generateRecommendations(serverResults, cwd, contextWindow)` |
| applyRecommendations | opencode.json | fs.writeFileSync after backup | ✓ WIRED | Line 282: `copyFileSync(cfgPath, bakPath)` (backup), Line 286: `writeFileSync(cfgPath, ...)` |
| restoreBackup | opencode.json.bak | fs.copyFileSync to restore | ✓ WIRED | Line 296: `copyFileSync(bakPath, cfgPath)`, Line 297: `unlinkSync(bakPath)` |
| cmdMcpProfile | applyRecommendations | --apply flag check | ✓ WIRED | Line 305: `args.includes('--apply')`, Line 375-376: `if (hasApply && !hasDryRun) { result.apply_result = applyRecommendations(...) }` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| MCP-01 | 19-01-PLAN | CLI discovers configured MCP servers from config files | ✓ SATISFIED | `discoverMcpServers()` reads .mcp.json + opencode.json + user-level config. 15 discovery tests pass. Live output shows 2 servers. |
| MCP-02 | 19-01-PLAN | CLI estimates token cost per server from known-server database | ✓ SATISFIED | `estimateTokenCost()` matches 20-server known-DB. Unknown servers get default 1150-token estimate. Per-server `token_estimate` and `context_percent` in output. |
| MCP-03 | 19-02-PLAN | CLI scores server relevance to current project | ✓ SATISFIED | `scoreServerRelevance()` uses 16 RELEVANCE_INDICATORS with file checks, env hints, always_relevant, and low-cost threshold. 8 relevance tests pass. |
| MCP-04 | 19-02-PLAN | CLI recommends disabling irrelevant servers with token savings | ✓ SATISFIED | `generateRecommendations()` produces keep/disable/review per server with reasoning. `total_potential_savings` and `potential_savings_percent` in output. `recommendations_summary` counts. |
| MCP-05 | 19-03-PLAN | CLI can auto-disable servers in config files | ✓ SATISFIED | `--apply` creates backup, sets `enabled: false` on disable servers in opencode.json only. `--restore` restores from backup. `--dry-run` previews. 9 apply/restore tests pass. |

**Orphaned requirements:** None. All 5 MCP requirements mapped to Phase 19 are claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TODOs, FIXMEs, placeholders, empty implementations, or console.log found in src/commands/mcp.js |

### Human Verification Required

### 1. Live MCP Server Discovery in Multi-Config Project

**Test:** Run `node bin/gsd-tools.cjs mcp-profile --raw` from a project with both `.mcp.json` and `opencode.json` containing overlapping servers
**Expected:** Servers from both sources listed, duplicates deduplicated, correct priority (project > user-level)
**Why human:** Current test project only has 2 user-level servers. Testing with a real multi-config project would validate the full merge logic.

### 2. Apply/Restore Round-Trip on Real Config

**Test:** In a project with opencode.json containing multiple MCP servers, run `mcp-profile --apply --raw`, verify servers disabled, then `mcp-profile --restore --raw`, verify config restored exactly
**Expected:** Backup created, servers disabled, restore brings back original exactly, backup file removed
**Why human:** Automated tests use temp dirs. A real config round-trip validates production behavior.

### Gaps Summary

No gaps found. All 4 observable truths verified, all 9 key links wired, all 5 requirements satisfied, all 32 mcp-profile tests pass (436 total), no anti-patterns detected. Bundle at 500.5 KB.

---

_Verified: 2026-02-25T16:05:57Z_
_Verifier: AI (gsd-verifier)_
