# Phase 207: Fresh-Context Chaining - Research

**Researched:** 2026-04-06
**Domain:** Workflow orchestration — CLI chaining with fresh context windows, disk-based handoff, and checkpoint preservation
**Confidence:** HIGH

## Summary

Phase 207 implements `/bgsd-deliver-phase --fresh-step-context`, a new CLI orchestrator that chains discuss → research → plan → execute → verify workflow steps, each running in a fresh context window with compact disk-based handoff. The key insight from the WORKFLOW-ACCELERATION-PRD is that the right optimization is "one chained workflow with tiny handoffs" — not one giant agent session.

The command does NOT yet exist — this phase creates it. It extends existing infrastructure: `phase:snapshot` (v16.1), `phase-handoff.js` artifact system (v16.1), `PlanningCache` (v16.1), and `jj-workspace.js` proof gate (v19.3). No new npm dependencies. The chain preserves stop points at checkpoints and interactive decisions, and works after `/clear` since all state lives on disk.

**Primary recommendation:** Build the deliver:phase command as a new workflow + CLI handler that spawns each step via CLI (not agent-to-agent within one session), reads from phase:snapshot + handoff artifacts, writes compact output, and chains to the next step. The JJ workspace proof gate (`collectWorkspaceProof`) must run before any accelerated dispatch and is never bypassed.

## Standard Stack

### Core (already exist, no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:child_process` (built-in) | Node 22.5+ | Spawn each workflow step as fresh CLI process | Fresh context window per step; each step is a separate process |
| `phase-handoff.js` | existing | Durable handoff artifacts in `.planning/phase-handoffs/{phase}/{step}.json` | Already implements the handoff contract with versioning, validation, run_id tracking |
| `jj-workspace.js` | existing | Triple-match workspace proof gate via `collectWorkspaceProof()` | Never bypassed; proof check may be cached (30s TTL) but gate itself is mandatory |
| `helpers.js:buildPhaseSnapshotInternal` | existing | Compact phase context snapshot replacing repeated discovery | Single CLI call replaces repeated phase/artifact lookups |
| `PlanningCache` | existing | SQLite-backed mtime cache for plan reads | Already used by phase:snapshot and execute-phase |

### Supporting (existing, no changes needed)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `state.js:cmdStateHandoff` | `verify:state handoff write/validate/clear` subcommands | Write and validate handoff artifacts at step boundaries |
| `execute-phase.md` workflow | Wave-based parallel execution with checkpoint handling | Reference for step orchestration patterns |
| `transition.md` workflow | Phase completion and advancement | Reference for next-phase chaining |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agent-to-agent spawning within one session | Separate CLI process per step | CLI processes give true fresh context and context clearing; in-session agents share context budget |
| Custom handoff format | Reuse existing XX-HANDOFF.json | Existing format is validated, versioned, and already wired to PlanningCache |
| Bypass JJ proof for speed | Cache JJ proof result | Proof may be cached with TTL for performance but never bypassed |

## Architecture Patterns

### Recommended Project Structure

```
src/
  commands/
    deliver.js           # NEW: deliver:phase command handler
workflows/
  deliver-phase.md       # NEW: fresh-context chaining workflow
```

### Pattern 1: Fresh-Context CLI Chaining

Each step runs as a separate CLI invocation, not as a spawned sub-agent within the same session:

```
/bgsd-deliver-phase 207 --fresh-step-context
  → spawn: discuss-phase 207 (fresh process)
    → write: verify:state handoff write --step discuss
  → spawn: research-phase 207 (fresh process)
    → read: verify:state handoff validate --step discuss
    → write: verify:state handoff write --step research
  → spawn: plan-phase 207 (fresh process)
    → read: verify:state handoff validate --step research
    → write: verify:state handoff write --step plan
  → spawn: execute-phase 207 (fresh process)
    → read: verify:state handoff validate --step plan
    → write: verify:state handoff write --step execute
  → spawn: verify-work 207 (fresh process)
    → read: verify:state handoff validate --step execute
```

**Key insight:** Each `spawn` is a fresh `node bin/bgsd-tools.cjs <command>` process. The orchestrator waits for each step to complete, reads its handoff artifact, then chains to the next step.

### Pattern 2: Handoff-Driven Resume

Every step reads the latest valid handoff artifact before deciding what to do:

```
function getHandoffForStep(cwd, phase, step) {
  const entries = listPhaseHandoffArtifacts(cwd, phase);
  const validation = buildPhaseHandoffValidation(entries, { phase });
  return validation.latest_valid_artifact; // null if no valid artifact
}
```

If `latest_valid_artifact.step >= current_step`, the step is already complete — skip to next.

### Pattern 3: JJ Proof Gate on Every Accelerated Path

From `execute-phase.md` lines 128-155 — proof gate is mandatory even on accelerated paths:

```javascript
const PROOF_CACHE_TTL_MS = 30_000; // Proof valid within single wave dispatch
function getWorkspaceProof(cwd, workspaceName) {
  const now = Date.now();
  if (_cachedProof && (now - _cachedProofTime) < PROOF_CACHE_TTL_MS) {
    return _cachedProof;
  }
  _cachedProof = collectWorkspaceProof(cwd, workspaceName);
  _cachedProofTime = now;
  return _cachedProof;
}
```

The proof check may be cached but is **never removed or short-circuited**.

### Pattern 4: Checkpoint Preservation in Handoff

Checkpoints (plans with `autonomous: false`) must survive the chain. The handoff artifact carries `resume_target` which stores the checkpoint state:

```javascript
// In phase-handoff.js buildPhaseHandoffPayload:
resume_target: {
  ...baseResumeTarget,
  ...explicitResumeTarget,  // Contains checkpoint state from prior step
}
```

### Anti-Patterns to Avoid

1. **Agent-to-agent spawning within one session** — defeats fresh-context guarantee; context budget accumulates
2. **Bypassing JJ proof gate** — even `--fast` or `--fresh-step-context` must run proof; only the cache TTL is optimized
3. **In-memory state between steps** — all state must be on disk; `/clear` can happen mid-chain and resume must work
4. **Custom handoff format** — use existing `phase-handoff.js` contract with versioning and validation

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fresh context per step | Custom process spawning | `child_process.spawn` with fresh CLI invocation | Native Node.js, zero dependency |
| Phase snapshot | Custom phase discovery | `buildPhaseSnapshotInternal` from helpers.js | Already cached, already tested |
| Handoff artifact format | New JSON contract | `phase-handoff.js` with versioning and validation | Already shipped v16.1; validated, run_id tracked |
| JJ workspace proof | Custom proof logic | `collectWorkspaceProof` from jj-workspace.js | Triple-match proof already implemented |
| Checkpoint state | Custom checkpoint tracking | `resume_target` in handoff artifact | Already wired in phase-handoff.js |
| Handoff validation | Custom validation logic | `buildPhaseHandoffValidation` from phase-handoff.js | Handles stale sources, run_id grouping |

## Common Pitfalls

### Pitfall 1: JJ Proof Gate Bypass
**What goes wrong:** Acceleration flags (`--fast`, `--fresh-step-context`) inadvertently skip the workspace proof check, allowing parallel execution from wrong cwd.
**Why it happens:** Pressure to make accelerated paths fast; proof check adds latency.
**How to avoid:** The proof gate is a hard requirement on all paths. Only the cache TTL is optimizable (30s within a wave dispatch). The gate itself is never removed.
**Warning signs:** Any code path that calls parallel dispatch without `collectWorkspaceProof` first.

### Pitfall 2: Handoff Artifact Drift
**What goes wrong:** Markdown artifacts and handoff JSON diverge — step thinks context is complete but artifact says otherwise.
**Why it happens:** Step writes to markdown but not to handoff, or vice versa.
**How to avoid:** Markdown is canonical for human review; handoff is generated deterministically from step outputs via `verify:state handoff write`. The orchestrator reads only handoff, not markdown.
**Warning signs:** `buildPhaseHandoffValidation` returns `stale_sources: true`.

### Pitfall 3: Checkpoint State Lost in Chain
**What goes wrong:** User responds to a checkpoint during discuss, but the response is lost when research or plan step runs.
**Why it happens:** Checkpoint response stored in agent session memory, not in handoff artifact.
**How to avoid:** `execute-phase.md` checkpoint_handling step spawns a continuation agent with `completed_tasks_table`, `resume_task`, and `user_response`. This continuation state must be written to handoff `resume_target`.
**Warning signs:** Checkpoint plans (`autonomous: false`) skip their interactive step on resume.

### Pitfall 4: /clear Breaks Mid-Chain Resume
**What goes wrong:** User runs `/clear` during discuss, then tries to resume — session is gone but chain state is unclear.
**Why it happens:** Orchestrator relies on session transcript instead of disk artifacts.
**How to avoid:** All chain state lives in handoff artifacts and phase snapshots. Orchestrator reads from disk on every step start. Session clear is safe because disk truth is the source of truth.
**Warning signs:** Any orchestrator code that reads from process memory or session state instead of handoff artifacts.

### Pitfall 5: Phase Snapshot Staleness
**What goes wrong:** Snapshot cached at chain start becomes stale as steps modify plans or artifacts.
**Why it happens:** Snapshot taken once at chain start, not refreshed per step.
**How to avoid:** Snapshot is the initial context carrier. Each step should re-call `phase:snapshot` or use the handoff artifact's `context` field for incremental updates rather than relying on a stale snapshot.
**Warning signs:** Step reports phase context missing when it should be present; artifact paths don't match current disk state.

## Code Examples

### Example: Handoff-Aware Step Orchestration (pseudo-code)

```javascript
// deliver:phase command handler (new src/commands/deliver.js)
const { buildPhaseSnapshotInternal } = require('../lib/helpers');
const { listPhaseHandoffArtifacts, buildPhaseHandoffValidation } = require('../lib/phase-handoff');

const STEPS = ['discuss', 'research', 'plan', 'execute', 'verify'];

function cmdDeliverPhase(cwd, phase, options) {
  const snapshot = buildPhaseSnapshotInternal(cwd, phase);
  const { fresh_step_context } = options;
  
  // Determine starting step from handoff
  const entries = listPhaseHandoffArtifacts(cwd, phase);
  const validation = buildPhaseHandoffValidation(entries, { phase });
  const startStepIdx = validation.latest_valid_artifact
    ? STEPS.indexOf(validation.latest_valid_artifact.step) + 1
    : 0;
  
  // Chain through steps
  for (let i = startStepIdx; i < STEPS.length; i++) {
    const step = STEPS[i];
    
    // Skip if step already complete (from prior partial run)
    if (validation.valid_artifacts.some(a => a.step === step)) {
      console.log(`Skipping ${step} (already complete)`);
      continue;
    }
    
    // Run step in fresh process
    console.log(`Running ${step}...`);
    const result = spawnSync('node', ['bin/bgsd-tools.cjs', `${step}-phase`, phase], { cwd });
    
    // Check for checkpoint/interactive decision
    if (result.exitCode === 'checkpoint') {
      // Write checkpoint state to handoff and pause
      writeHandoffCheckpoint(cwd, phase, step, result.checkpoint_data);
      console.log(`Checkpoint reached at ${step}. Run /bgsd-deliver-phase ${phase} to resume.`);
      return;
    }
    
    // Write step result to handoff
    spawnSync('node', [
      'bin/bgsd-tools.cjs', 'verify:state', 'handoff', 'write',
      '--phase', phase,
      '--step', step,
      '--summary', `Step ${step} complete`,
      '--next-command', `${STEPS[i+1]}-phase ${phase}`,
    ], { cwd });
  }
  
  console.log(`Phase ${phase} delivery complete.`);
}
```

### Example: JJ Proof Gate (from execute-phase.md)

```javascript
const PROOF_CACHE_TTL_MS = 30_000;
const { collectWorkspaceProof } = require('../src/lib/jj-workspace');
let _cachedProof = null;
let _cachedProofTime = 0;

function getWorkspaceProof(cwd, workspaceName) {
  const now = Date.now();
  if (_cachedProof && (now - _cachedProofTime) < PROOF_CACHE_TTL_MS) {
    return _cachedProof;
  }
  _cachedProof = collectWorkspaceProof(cwd, workspaceName);
  _cachedProofTime = now;
  return _cachedProof;
}

// Before parallel dispatch:
const proof = getWorkspaceProof(cwd, workspaceName);
if (!proof.parallel_allowed) {
  console.log('⚠ Proof gate: parallel_allowed=false, falling back to sequential');
  return executeSequential(wavePlans);
}
console.log('✓ Proof gate passed, proceeding with parallel dispatch');
```

### Example: Handoff Validation with Resume Logic

```javascript
const entries = listPhaseHandoffArtifacts(cwd, phase);
const validation = buildPhaseHandoffValidation(entries, { phase });

if (!validation.valid) {
  // Stale or corrupted handoff — repair guidance
  console.log(`Handoff invalid: ${validation.repair_guidance.message}`);
  console.log('Repair:', validation.repair_guidance.commands.join('\n'));
  return;
}

if (validation.stale_sources) {
  // Source fingerprint changed since last run — may need to restart
  console.log('⚠ Source changed since last run. Consider restart.');
}

const latestStep = validation.latest_valid_step;
const latestArtifact = validation.latest_valid_artifact;
console.log(`Latest valid step: ${latestStep} (run_id: ${validation.selected_run_id})`);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Giant context session for entire phase | Fresh context per step via CLI chaining | v19.4 Phase 207 | Eliminates context budget pressure; enables `/clear`-safe workflows |
| Ad hoc phase discovery per step | Single `phase:snapshot` call | v16.1 | Reduced repeated CLI calls; consistent phase context |
| Per-step STATE.md mutations | Batched `verify:state complete-plan` | v16.1 | Reduced file I/O; atomic state updates |
| Markdown-only handoff | JSON handoff artifacts in `phase-handoffs/` | v16.1 | Machine-readable, validatable, resumable |
| Sequential-only execution | JJ-backed parallel with proof gate | v19.3 | Parallel speed with sequential safety |

## Open Questions

1. **Interactive discuss step**: When discuss reaches a decision checkpoint, how does the deliver pipeline surface the decision to the user and resume after? The handoff artifact's `resume_target` needs a structured decision payload format.

2. **Step failure recovery**: If a step fails mid-chain, what's the recovery protocol? Should the orchestrator auto-retry, or surface the failure and wait for user input?

3. **JJ workspace scoping for deliver**: Does deliver-phase need its own JJ workspace, or does it operate from main checkout? The existing `execute-phase` creates per-plan workspaces. The deliver orchestrator itself might not need a workspace, but each execute step does.

4. **Auto-advance mode**: The `transition.md` has `--auto` mode that auto-approves checkpoints. Should deliver-phase have an equivalent `--auto` flag that skips interactive stops?

## Sources

### Primary (HIGH confidence)
- **Local project** — `src/lib/phase-handoff.js` (handoff artifact lifecycle, versioning, validation)
- **Local project** — `src/lib/jj-workspace.js` (`collectWorkspaceProof` triple-match gate)
- **Local project** — `src/lib/helpers.js:buildPhaseSnapshotInternal` (phase context snapshot)
- **Local project** — `workflows/execute-phase.md` (parallel proof gate, checkpoint handling, wave execution)
- **Local project** — `workflows/transition.md` (phase chaining and auto-advance patterns)
- **PRD** — `.planning/research/completed/WORKFLOW-ACCELERATION-PRD.md` (fresh-context chaining requirements)

### Secondary (MEDIUM confidence)
- **Local project** — `.planning/research/SUMMARY.md` (v19.4 architecture overview, Phase 207 context)
- **Local project** — `.planning/ROADMAP.md` (Phase 207 goal and requirements)
- **Local project** — `.planning/REQUIREMENTS.md` (ACCEL-01 through ACCEL-04 traceability)

### Tertiary (LOW confidence)
- **Training data** — General context isolation patterns for CLI orchestration (verify with local code before asserting)

## Metadata

**Confidence breakdown:** Architecture patterns = HIGH (well-documented in PRD + existing code), Standard stack = HIGH (all components already exist), Pitfalls = HIGH (v19.3 lessons learned documented), Open questions = MEDIUM (need implementation experience to resolve)

**Research date:** 2026-04-06

**Valid until:** Until any of: Phase 207 implementation changes the architecture, new JJ workspace patterns emerge, or fresh-context chaining PRDs are revised
