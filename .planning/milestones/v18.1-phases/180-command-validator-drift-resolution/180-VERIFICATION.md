---
phase: 180-command-validator-drift-resolution
verified: 2026-04-01T17:23:37Z
status: passed
score: 6/6
requirements_covered:
  - CLEAN-03
---

# Phase 180 Verification

## Intent Alignment

**Verdict:** aligned

Phase 180's promised user change was trustworthy milestone-close command-integrity proof. That now lands: the validator derives routed CLI inventory from the shared `src/lib/router-contract.js`, router code consumes that same contract for surfaced availability/error messaging, raw validator output names the actual shared sources it used, and repo-close proof is green.

## Goal Achievement

| Observable truth | Status | Evidence |
|---|---|---|
| `util:validate-commands --raw` no longer flags supported node-invoked routed commands like `init:execute-phase`, `init:phase-op`, `verify:validate roadmap`, and `detect:gh-preflight` as nonexistent. | ✓ VERIFIED | `tests/validate-commands.test.cjs:392-419`; `node bin/bgsd-tools.cjs util:validate-commands --raw` returned `valid: true`. |
| Redirect-bearing shell snippets, quoted/reference cases, bootstrap reconstruction snippets, and transition-style headings are classified intentionally instead of failing generically. | ✓ VERIFIED | `tests/validate-commands.test.cjs:421-444`; raw validator output remained green with named exclusions. |
| Raw validator output reports proof inventory and named exclusions so green output has inspectable meaning. | ✓ VERIFIED | `src/commands/misc/frontmatter.js:96-130`; `src/lib/commandDiscovery.js:1438-1444`; raw validator JSON included `proofInventory`. |
| The Phase 180 closure backlog across agents, workflows, and docs validates cleanly under the settled contract. | ✓ VERIFIED | `tests/validate-commands.test.cjs:446-483`; repo-close raw validator reported `groupedIssueCount: 0` across 142 surfaced files, including every Phase 180 backlog file. |
| No second proof manifest or narrowed proof scope was introduced for closure. | ✓ VERIFIED | Proof scope still comes from validator-owned `proofInventory` in `validateCommandIntegrity()` and `cmdValidateCommands()` (`src/lib/commandDiscovery.js:1438-1444`; `src/commands/misc/frontmatter.js:113-129`). |
| The validator contract is backed by a shared router command inventory that router code also consumes, and proof inventory names that real source. | ✓ VERIFIED | `src/lib/commandDiscovery.js:11-12, 879-900` imports `getRouterCommandInventory()` from `src/lib/router-contract.js`; `src/router.js:3-5, 413, 1643-1649` imports and uses router-contract helpers; `src/lib/commandDiscovery.js:1441-1443` names `src/lib/router-contract.js` in `cliContractSources`; `tests/validate-commands.test.cjs:486-510` locks this contract. |

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Evidence |
|---|---|---|---|---|
| `src/lib/router-contract.js` | ✓ | ✓ | ✓ | Defines shared router contract plus inventory/subcommand helpers (`src/lib/router-contract.js:3-174`). Wired into validator via `src/lib/commandDiscovery.js:11-12, 889-900` and router via `src/router.js:3-5, 413, 1643-1649`. |
| `src/lib/commandDiscovery.js` | ✓ | ✓ | ✓ | Validator now derives routed inventory from shared router-contract and publishes accurate proof inventory (`src/lib/commandDiscovery.js:11-12, 879-900, 1438-1444`). |
| `src/router.js` | ✓ | ✓ | ✓ | Router consumes shared contract helpers for surfaced namespace/subcommand availability messaging (`src/router.js:3-5, 413, 531, 619, 869, 1605, 1643-1649`). |
| `tests/validate-commands.test.cjs` | ✓ | ✓ | ✓ | Contains focused regressions for routed node-invoked commands, closure backlog proof, and shared router-contract assertions (`tests/validate-commands.test.cjs:392-510`). |
| `src/commands/misc/frontmatter.js` | ✓ | ✓ | ✓ | Raw validator command forwards `proofInventory` from validator result (`src/commands/misc/frontmatter.js:96-130`). |

## Key Link Verification

| From | To | Expected link | Status | Evidence |
|---|---|---|---|---|
| `src/lib/commandDiscovery.js` | `src/lib/router-contract.js` | Validator CLI inventory derives from shared routed-command contract. | WIRED | `src/lib/commandDiscovery.js:11-12, 879-900` imports and uses `getRouterCommandInventory()`. |
| `src/router.js` | `src/lib/router-contract.js` | Router consumes the same contract module for surfaced available-subcommand/namespace guidance. | WIRED | `src/router.js:3-5, 413, 1643-1649` imports and uses `formatAvailableSubcommands()` and `getTopLevelNamespaces()`. |
| `tests/validate-commands.test.cjs` | `src/lib/commandDiscovery.js` | Regressions lock proof inventory and shared-contract behavior. | WIRED | `tests/validate-commands.test.cjs:9-10, 446-510` imports validator and shared contract, asserts closure proof plus shared-contract sourcing. |
| `tests/validate-commands.test.cjs` | Phase 180 closure backlog files | Closure regression keeps the exact surfaced backlog validator-clean. | WIRED | `tests/validate-commands.test.cjs:15-25, 446-483` loads backlog files directly and asserts they appear in `proofInventory.surfacesChecked`. |

## Requirements Coverage

| Requirement | Result | Evidence |
|---|---|---|
| CLEAN-03 | Covered | Supported guidance proof is now green and trustworthy because surfaced docs/workflows/agents/runtime validate against an explicit shared command contract with accurate proof-source reporting (`.planning/ROADMAP.md:99-108`; `src/lib/commandDiscovery.js:1438-1444`; raw validator output `valid: true`). |

## Anti-Patterns Found

| Severity | Finding | Evidence |
|---|---|---|
| ℹ️ Info | Installed verifier helper commands for `verify:verify artifacts` and `verify:verify key-links` still crash with `ReferenceError: createPlanMetadataContext is not defined`, so artifact/key-link sections were manually verified from source and test evidence. | `node /Users/cam/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs verify:verify artifacts ...`; `node /Users/cam/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs verify:verify key-links ...` |

## Human Verification Required

None.

## Gaps Summary

`GAP-180-RV-01` is resolved. The validator no longer keeps a private router inventory table, it now derives routed commands from `src/lib/router-contract.js`, router code consumes that same shared contract module, proof inventory names `src/lib/router-contract.js` and `src/lib/constants.js` as its actual CLI contract sources, and both focused tests plus repo-close raw validation confirm the closure proof stays green without narrowing scope.
