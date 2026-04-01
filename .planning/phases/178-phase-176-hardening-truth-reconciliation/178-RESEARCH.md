# Phase 178: Phase 176 Hardening Truth Reconciliation - Research

**Researched:** 2026-04-01
**Domain:** verification-truth reconciliation for CLI cleanup artifacts
**Confidence:** HIGH

## User Constraints

<user_constraints>
- Treat live source plus focused runnable proof as the authority; do not preserve inaccurate historical prose just because it already shipped.
- Honest reconciliation is enough. If a Phase 176 claim is false, either make it true with a narrow directly implicated fix or correct the claim.
- Bias toward narrow functional fixes only when they are the difference between “honestly documented brokenness” and a repo that is trustworthy and mostly functional for the next refactor milestone.
- Keep scope limited to Phase 176 claims, evidence, verification, and directly implicated source/runtime files.
- Produce one authoritative `176-VERIFICATION.md`, refresh materially misleading Phase 176 summaries, and update milestone-close artifacts only where they rely on stale Phase 176 claims.
- Prefer live-source checks plus focused touched-surface proof over broad whole-repo cleanup.
- Current source and runnable proof outrank summary prose when they disagree.
</user_constraints>

## Phase Requirements

<phase_requirements>
- `CLI-03` — smaller command subdomains instead of multi-thousand-line bucket modules and ambient globals.
- `SAFE-01` — supported planning/settings workflows still run after cleanup with regression proof.
- `SAFE-02` — touched cleanup paths avoid silent swallowing, unnecessary indirection, and unguarded shared mutable state.
</phase_requirements>

## Summary

Phase 178 is not a library-selection phase. It is an evidence-chain repair phase. The correct architecture is: treat the current repository as source of truth, run focused proof that directly covers the touched Phase 176 claims, then rewrite verification and summary artifacts so they match that truth. In the live repo, the strongest contradiction is that Phase 176 summaries claim ambient output globals were encapsulated, but `src/router.js`, `src/lib/output.js`, `src/plugin/debug-contract.js`, `src/commands/init.js`, `src/commands/features.js`, and related files still read or mutate `global._gsd*`. The strongest confirmed gap is that `176-VERIFICATION.md` does not exist.

The standard proof stack for this repo is already present: Node's built-in `node:test` runner, npm scripts, the repo's own `verify:verify` commands for artifact/key-link truthfulness, and `util:validate-commands` for surfaced command guidance. Use those, plus focused CLI smoke commands, instead of inventing new reconciliation machinery. Current repo evidence also shows Phase 176's old “full integration suite passes” claim is not trustworthy as written: `node --test tests/validate-commands.test.cjs` passes 15/15 and the six canonical help-route smoke commands work, but a live `npm test` run still reports many failing suites and exceeded a 10-minute timeout.

**Primary recommendation:** Plan Phase 178 as an evidence-first reconciliation slice: verify live source, verify focused CLI proof, write `176-VERIFICATION.md`, then correct every stale Phase 176 and milestone-close claim that exceeds what the repo actually proves.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | v25.8.2 runtime; repo contract `>=18` | CLI runtime and built-in test runner | Official `node:test` is stable in Node 20+ and already powers this repo's test suite. |
| `node:test` + `node:assert` | built-in | Focused runnable regression proof | Already used by `tests/validate-commands.test.cjs`, `tests/verify-metadata-truthfulness.test.cjs`, and broader repo tests. |
| npm scripts | npm 11.11.1 | Standard build/test entrypoints | `npm run build` and `npm test` are the shipped repo contracts. |
| Repo verify commands | workspace-local | Artifact/key-link/quality verification | `verify:verify artifacts`, `verify:verify key-links`, and `verify:verify quality` already encode the repo's verification contract. |
| `util:validate-commands` | workspace-local | Surfaced-guidance truth check | Existing validator already checks runnable command guidance against shipped command inventory. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Jujutsu (`jj`) | 0.39.0 | Workspace VCS in colocated Git repo | Use for normal mutation/inspection flow in this repo; keep Git mostly read-only where possible. |
| fast-glob | ^3.3.3 | File discovery in CLI internals | Reuse existing discovery paths if verification needs glob-backed checks. |
| valibot | ^1.2.0 | Contract/schema validation in repo | Use only if touched reconciliation code needs existing validation conventions. |
| esbuild | ^0.27.3 | Build pipeline dependency | Indirectly exercised through `npm run build`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Repo-native verify commands | Custom reconciliation script | Worse: duplicates existing truth-check logic and creates another thing to audit. |
| Focused touched-surface proof | Full-suite-only milestone proof | Worse for this phase: current full suite is noisy/failing and does not isolate the Phase 176 truth gap. |
| Artifact correction + narrow fixes | Broad refactor-down continuation | Violates locked scope and risks reopening the hotspot rewrite. |

## Architecture Patterns

### Recommended Project Structure
- Keep Phase 178 centered on existing artifacts:
  - `.planning/phases/176-command-hotspot-simplification-hardening/176-VERIFICATION.md`
  - Phase 176 summary files that materially overstate shipped behavior
  - milestone-close artifacts that repeat those claims
  - only directly implicated runtime/source files if a narrow fix is required to make an important claim true

### Pattern 1: Evidence hierarchy reconciliation
1. Inspect live source for each disputed claim.
2. Run focused proof for each user-visible or workflow-visible claim.
3. Record result in one authoritative verification artifact.
4. Update summaries/audit artifacts to match the verified truth.

This matches the phase context's locked rule that source + runnable proof outrank prose.

### Pattern 2: Focused proof, not milestone-wide rerun
- Use proof that directly maps to the disputed claims:
  - `node --test tests/validate-commands.test.cjs`
  - targeted `verify:verify` artifact/key-link/quality checks
  - canonical route smoke commands
  - narrowly scoped source inspection for ambient globals and touched subdomain/barrel state
- Record broad-suite status honestly, but do not let unresolved unrelated suite failures block truthful Phase 176 reconciliation.

### Pattern 3: Claim-by-claim disposition matrix
For every stale Phase 176 claim, explicitly classify it as one of:
- **Verified true as-is**
- **Made true by narrow in-scope fix**
- **Corrected in artifacts because broader fix is out of scope**

### Anti-Patterns to Avoid
- Do not treat old summaries as evidence.
- Do not claim “full test suite pass” unless `npm test` actually completes cleanly in current repo state.
- Do not use six `--help` smoke commands alone as proof of `SAFE-01` if broader related claims are being made.
- Do not reopen general command-hotspot refactoring just because Phase 176 touched those files.
- Do not hand-author a verification report without command outputs or source citations behind each truth.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Artifact truth checking | Custom parser for PLAN/SUMMARY/VERIFICATION metadata | `verify:verify artifacts`, `verify:verify key-links`, `verify:verify quality` | Repo already has truthfulness-aware verification with missing/inconclusive handling. |
| Surfaced command validation | New regex scanner for slash commands | `util:validate-commands` and its existing tests | Existing validator already understands runnable vs reference-style guidance. |
| Regression proof harness | Ad hoc shell-only smoke script | `node:test` suites plus a small number of explicit CLI smoke commands | Aligns with shipped repo test architecture and produces repeatable results. |
| VCS workflow model | Custom Git-only workflow assumptions | Existing JJ colocated workflow | Repo is explicitly JJ/workspace-first. |
| Evidence storage format | Another reconciliation doc shape | `176-VERIFICATION.md` as authoritative artifact | Matches milestone audit gap and downstream planner expectations. |

## Common Pitfalls

### Pitfall 1: Trusting historical summaries over live source
**What goes wrong:** Plans close the phase by copying old claims into new artifacts.  
**Why it happens:** Summary prose is faster to scan than code and command output.  
**How to avoid:** Every claim in `176-VERIFICATION.md` needs a current source citation and/or runnable proof.  
**Warning signs:** Phrases like “already completed” or “as proven in Phase 176 summary” without fresh evidence.

### Pitfall 2: Overclaiming regression proof
**What goes wrong:** Focused tests pass, but artifacts say the whole suite passes.  
**Why it happens:** Teams conflate targeted proof with full-suite health.  
**How to avoid:** Separate “focused Phase 176 proof passed” from “full repo suite status.” Record both honestly.  
**Warning signs:** `npm test` failures/timeouts coexist with “all workflows verified” language.

### Pitfall 3: Fixing too much code in the name of reconciliation
**What goes wrong:** Phase 178 becomes a stealth refactor milestone.  
**Why it happens:** Once contradictions are found, it is tempting to clean everything nearby.  
**How to avoid:** Only fix code when directly implicated by the Phase 176 audit gap and necessary for a trustworthy mostly functional repo.  
**Warning signs:** New tasks start touching unrelated validators, docs drift, or adjacent command families.

### Pitfall 4: Ignoring colocated JJ/Git workflow constraints
**What goes wrong:** Verification or repair steps mutate with Git in ways that confuse the workspace.  
**Why it happens:** Many tools assume pure Git repos.  
**How to avoid:** Prefer JJ for mutations; keep Git mostly read-only unless there is a specific reason otherwise.  
**Warning signs:** Plans rely on staging-area semantics or mutating Git workflows JJ docs explicitly de-emphasize.

### Pitfall 5: Treating missing verification metadata as a docs-only issue
**What goes wrong:** `176-VERIFICATION.md` gets created, but it does not actually prove anything.  
**Why it happens:** The existence of the file gets mistaken for satisfied verification.  
**How to avoid:** Use the repo's truthfulness pattern: actionable artifacts, key links, explicit command outputs, and status language that distinguishes missing vs inconclusive vs verified.  
**Warning signs:** Verification sections lack commands, paths, or source-to-claim mapping.

## Code Examples

Verified patterns from official sources and live repo.

### Node official: built-in focused test execution
```bash
node --test
```

### npm official: package script contract
```json
{
  "scripts": {
    "test": "node test.js"
  }
}
```

### Live repo: focused command-integrity proof
```bash
node --test tests/validate-commands.test.cjs
node bin/bgsd-tools.cjs util:validate-commands --raw
```

### Live repo: artifact/key-link truthfulness pattern
```bash
node bin/bgsd-tools.cjs verify:verify artifacts \
  .planning/phases/176-command-hotspot-simplification-hardening/176-04-PLAN.md

node bin/bgsd-tools.cjs verify:verify key-links \
  .planning/phases/176-command-hotspot-simplification-hardening/176-04-PLAN.md
```

### Live repo: canonical route smoke proof
```bash
node bin/bgsd-tools.cjs plan:phase --help
node bin/bgsd-tools.cjs plan:milestone --help
node bin/bgsd-tools.cjs verify:verify --help
node bin/bgsd-tools.cjs verify:state --help
node bin/bgsd-tools.cjs review:scan --help
node bin/bgsd-tools.cjs security:scan --help
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Treat completion summaries as enough proof | Require executable, source-backed verification artifacts | Current repo already encodes this in `verify:verify` truthfulness tests | Phase 178 should upgrade Phase 176 to this standard instead of trusting prose. |
| Assume full-suite pass is the only acceptable regression proof | Use focused, claim-aligned proof and report full-suite status separately | Node `node:test` and repo verifier/validator tooling make targeted proof cheap | Lets Phase 178 restore trust without pretending unrelated failures disappeared. |
| Userland test framework required for serious CLI verification | Node built-in `node:test` is stable and already standard here | Node docs mark `node:test` stable from v20; repo uses it everywhere | No reason to add Jest/Mocha for this reconciliation phase. |
| Pure Git assumptions for CLI tooling repos | JJ/Git colocated workspaces are viable, but mutations should stay JJ-first | JJ current docs emphasize colocated compatibility with caveats | Verification/repair plans must respect workspace semantics. |

## Open Questions

- Which specific Phase 176 claims, beyond ambient-global encapsulation and full-suite-pass language, are still materially overstated after current source review?
- Is there any narrow code fix worth landing in Phase 178 to reduce trust risk, or is truthful artifact correction sufficient for all remaining contradictions?
- Should `176-VERIFICATION.md` explicitly record current full-suite failure/timeout status as out-of-scope background, or only cite focused proof relevant to `CLI-03`/`SAFE-01`/`SAFE-02`?

## Sources

### Primary (HIGH confidence)
- Live repo requirements and phase scope:
  - `.planning/REQUIREMENTS.md`
  - `.planning/phases/178-phase-176-hardening-truth-reconciliation/178-CONTEXT.md`
  - `.planning/ROADMAP.md`
  - `.planning/v18.1-MILESTONE-AUDIT.md`
- Live Phase 176 artifacts:
  - `.planning/phases/176-command-hotspot-simplification-hardening/176-01-SUMMARY.md`
  - `.planning/phases/176-command-hotspot-simplification-hardening/176-02-SUMMARY.md`
  - `.planning/phases/176-command-hotspot-simplification-hardening/176-03-SUMMARY.md`
  - `.planning/phases/176-command-hotspot-simplification-hardening/176-04-SUMMARY.md`
  - `.planning/phases/176-command-hotspot-simplification-hardening/176-04-PLAN.md`
- Live source and tests:
  - `src/router.js`
  - `src/lib/output.js`
  - `src/plugin/debug-contract.js`
  - `src/lib/commandDiscovery.js`
  - `src/commands/verify/*.js`
  - `src/commands/misc/frontmatter.js`
  - `tests/validate-commands.test.cjs`
  - `tests/verify-metadata-truthfulness.test.cjs`
  - `tests/helpers.cjs`
- Live command runs performed during research:
  - `node --test tests/validate-commands.test.cjs` → pass (15/15)
  - six canonical `--help` smoke commands → pass
  - `node bin/bgsd-tools.cjs util:validate-commands --raw` → 10 surfaced guidance issues remain
  - `npm test` → many failing suites observed; run exceeded 10-minute timeout
- Official docs:
  - Node test runner docs: https://nodejs.org/api/test.html
  - npm test docs: https://docs.npmjs.com/cli/v10/commands/npm-test

### Secondary (MEDIUM confidence)
- Jujutsu Git compatibility docs: https://jj-vcs.github.io/jj/latest/git-compatibility/
- Context7 docs for `/nodejs/node` and `/npm/cli`

### Tertiary (LOW confidence)
- None needed for core recommendations.

## Metadata

**Confidence breakdown:** HIGH for live repo contradictions, missing artifact status, focused proof stack, and Node/npm/JJ stack guidance; MEDIUM only for broader JJ workflow interpretation beyond directly observed repo use.  
**Research date:** 2026-04-01  
**Valid until:** Next meaningful source/test/artifact change affecting Phase 176 or verification tooling.
