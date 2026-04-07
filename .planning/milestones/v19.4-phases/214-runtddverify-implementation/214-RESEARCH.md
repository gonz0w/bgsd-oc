# Phase 214: runTddVerify Implementation - Research

**Researched:** 2026-04-06
**Domain:** TDD verification integration, Node.js child_process spawn, workflow orchestration
**Confidence:** HIGH

## Summary

Phase 214 replaces the `runTddVerify` placeholder in `workflows/execute-phase.md:265-268` with actual TDD verification logic. The placeholder returns `{verified: true}` without any verification — this was intentional per Phase 210's design (actual TDD logic runs in execute-plan subagents), but GAP-I2 identifies that `fanInTddParallel` bounded parallel fan-out doesn't actually verify when called directly.

The TDD validators (`execute:tdd validate-red/green/refactor`) are already implemented in `bin/bgsd-tools.cjs` (lines 2577-2583). The implementation needs to:
1. Read the plan to extract TDD target commands from `<feature><tdd-targets>`
2. Spawn the appropriate `execute:tdd validate-*` commands for each stage
3. Return structured verification results matching the existing `{plan_id, verified}` contract

**Primary recommendation:** Implement `runTddVerify` to read TDD targets from plan frontmatter/body, invoke CLI validators via child_process.spawn, and aggregate RED/GREEN/REFACTOR stage results.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js child_process.spawn | built-in | Execute CLI validators | Already used in `fanInParallelSpawns` at execute-phase.md:180 |
| PlanningCache | existing | TDD mutex keys already defined | `getTddMutexKeys()` at planning-cache.js:35 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs.readFileSync | built-in | Read plan files to extract TDD targets | Parsing `<feature><tdd-targets>` section |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct require of bgsd-tools.cjs | Spawn CLI via child_process | Spawn keeps CLI boundary clean; already pattern in `fanInParallelSpawns` |
| Reading cached plan metadata | Re-parsing plan file each time | Plan already read by fanInTddParallel caller |

## Architecture Patterns

### Recommended Project Structure
The implementation lives in `workflows/execute-phase.md` as a replacement for the existing placeholder at lines 265-268.

### Pattern 1: Bounded Parallel Verification
- `fanInTddParallel` coordinates bounded parallel verification via `Promise.all` with `workerLimit` slice
- Each worker calls `runTddVerify(plan, cwd)` which spawns validators
- Mutex-protected cache reads/writes already exist in `fanInTddParallel`

### Pattern 2: CLI Validator Contract
- `execute:tdd validate-red --test-cmd "cmd"` → returns `{stage:"red", command, exitCode, failed, semanticFailure, ...}`
- `execute:tdd validate-green --test-cmd "cmd" --test-file "file"` → returns `{stage:"green", command, exitCode, passed, testFileUnmodified, method, ...}`
- `execute:tdd validate-refactor --test-cmd "cmd" --prev-count N` → returns `{stage:"refactor", command, exitCode, passed, testCount, prevCount, countUnchanged, ...}`
- All validators write `*-TDD-AUDIT.json` sidecar via `Qd()` function

### Anti-Patterns to Avoid
- **Don't block on synchronous exec** — use async spawn pattern matching `fanInParallelSpawns`
- **Don't duplicate mutex logic** — `fanInTddParallel` already handles mutex reads/writes around the `runTddVerify` call
- **Don't modify the return contract** — existing code expects `{plan_id, verified}` shape (or `{plan_id, error, verified: false}` on failure)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI invocation | Custom HTTP client | child_process.spawn | Already used in `fanInParallelSpawns`; consistent pattern |
| TDD audit writes | Custom file writer | Built-in `Qd()` in validators | Validators already write `*-TDD-AUDIT.json` |
| Test count parsing | Custom regex | Built-in `PP()` function | Already in bgsd-tools.cjs |

## Common Pitfalls

### Pitfall 1: Missing TDD targets in non-type:tdd plans
**What goes wrong:** `runTddVerify` receives a non-`type:tdd` plan and fails to find `<tdd-targets>`
**Why it happens:** The function doesn't check plan type before attempting to extract targets
**How to avoid:** Return `{verified: true}` for non-type:tdd plans (verification delegated to execute-plan subagent)
**Warning signs:** `runTddVerify` throws on plans without `<feature><tdd-targets>`

### Pitfall 2: RED/GREEN/REFACTOR command extraction
**What goes wrong:** Regex fails to extract commands from `<red>`, `<green>`, `<refactor>` tags
**Why it happens:** Commands may span multiple lines or have unusual formatting
**How to avoid:** Use whitespace-insensitive regex, test against fixture plans
**Warning signs:** Extracted command is empty or malformed

### Pitfall 3: Validator spawn failures
**What goes wrong:** `execute:tdd validate-*` command fails to spawn (missing CLI, path issues)
**Why it happens:** `cwd` mismatch, CLI not in PATH
**How to avoid:** Catch spawn errors, return `{verified: false, error}` matching existing error contract
**Warning signs:** `runTddVerify` throws unhandled rejection

## Code Examples

### Existing Placeholder (execute-phase.md:265-268)
```javascript
async function runTddVerify(plan, cwd) {
  // TDD verification runs inside execute-plan subagents; this placeholder
  // allows the bounded parallel fan-out to proceed when called directly
  return { plan_id: plan.plan_id, verified: true };
}
```

### Validator CLI Contract (bin/bgsd-tools.cjs:2577-2583)
```javascript
function nX(e,t,n,s){switch(t){
  case"validate-red":return lX(e,n,s);    // lX = validate-red
  case"validate-green":return uX(e,n,s);  // uX = validate-green  
  case"validate-refactor":return dX(e,n,s);// dX = validate-refactor
}}
```

### Validator Response Shapes
```javascript
// validate-red result
{stage:"red",command:"...",exitCode:1,failed:true,semanticFailure:true,testFileUnmodified:false,timestamp:"..."}

// validate-green result  
{stage:"green",command:"...",exitCode:0,passed:true,testFileUnmodified:true,method:"mtime+size",testCount:3,timestamp:"..."}

// validate-refactor result
{stage:"refactor",command:"...",exitCode:0,passed:true,testCount:3,prevCount:3,countUnchanged:true,timestamp:"..."}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| runTddVerify placeholder returns `{verified: true}` | Actual TDD verification via CLI validators | Phase 214 | Bounded parallel fan-out actually verifies TDD stages |

## Open Questions

1. **Should runTddVerify cache results in TDD mutex keys?** The `fanInTddParallel` already does mutex-protected reads at lines 239-241 before calling `runTddVerify`, and invalidates after. No additional caching needed in `runTddVerify` itself.

2. **Should non-type:tdd plans return early or attempt verification?** Per Phase 210 design notes, TDD verification "runs inside execute-plan subagents" — `runTddVerify` should return `{verified: true}` for non-type:tdd plans to preserve the placeholder behavior.

3. **Should the implementation read from plan frontmatter or body?** TDD targets live in `<feature><tdd-targets>` body section, not frontmatter. Frontmatter has `test_file`, `impl_files`, `steps` but not the exact commands.

## Sources

### Primary (HIGH confidence)
- `workflows/execute-phase.md:265-268` — runTddVerify placeholder location
- `bin/bgsd-tools.cjs:2577-2583` — TDD validator implementations
- `bin/bgsd-tools.cjs:329-331` — CLI help for validate-red/green/refactor
- `.planning/v19.4-MILESTONE-AUDIT.md:94` — GAP-I2 description

### Secondary (MEDIUM confidence)
- `skills/tdd-execution/SKILL.md` — TDD execution contract
- `templates/plans/tdd.md` — TDD plan template with `<tdd-targets>` structure
- `.planning/phases/210-parallel-tdd-safety/210-01-SUMMARY.md` — Phase 210 context

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:** Implementation approach (HIGH) — existing patterns well-understood; TDD target extraction (MEDIUM) — regex needs validation against fixture plans
**Research date:** 2026-04-06
**Valid until:** Phase 214 completion
