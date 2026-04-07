<!-- section: purpose -->
<purpose>
Fresh-context chaining workflow for /bgsd-deliver-phase --fresh-step-context.
Chains discuss → research → plan → execute → verify, each step running in
a fresh CLI process with disk-based handoff. Session can be cleared mid-chain
and resume works from disk truth.
</purpose>

<core_principle>
Each spawn is a fresh `node bin/bgsd-tools.cjs <command>` process. The
orchestrator waits for each step to complete, reads its handoff artifact,
then chains to the next step. All state lives on disk — /clear is safe.
</core_principle>
<!-- /section -->

<process>

<!-- section: initialize -->
<step name="initialize" priority="first">
<skill:bgsd-context-init />

Parse flags:
- --fresh-step-context: Enable fresh-context chaining mode
- --fast: Skip optional optimizations (but never JJ proof gate)

Validate phase argument is present.
</step>
<!-- /section -->

<!-- section: proof_gate -->
<step name="proof_gate">
**JJ Workspace Proof Gate (mandatory, never bypassed)**

Run collectWorkspaceProof to verify workspace integrity before dispatch:

```javascript
const { collectWorkspaceProof } = require('../src/lib/jj-workspace');
const proof = collectWorkspaceProof(cwd, null);
if (!proof.parallel_allowed) {
  console.log('⚠ Proof gate failed:', proof.fallback_reason);
  console.log('Intended root:', proof.intended_root);
  console.log('Observed cwd:', proof.observed_cwd);
  return; // Cannot proceed
}
console.log('✓ Proof gate passed');
```

This gate is NEVER bypassed by --fast or --fresh-step-context flags.
Only the cache TTL is optimizable within a wave dispatch.
</step>
<!-- /section -->

<!-- section: discover_handoff -->
<step name="discover_handoff">
Read existing handoff artifacts to determine starting step:

```javascript
const { listPhaseHandoffArtifacts, buildPhaseHandoffValidation } = require('../src/lib/phase-handoff');
const entries = listPhaseHandoffArtifacts(cwd, phase);
const validation = buildPhaseHandoffValidation(entries, { phase });

const STEPS = ['discuss', 'research', 'plan', 'execute', 'verify'];
const startStepIdx = validation.latest_valid_artifact
  ? STEPS.indexOf(validation.latest_valid_artifact.step) + 1
  : 0;
```

Report: "Starting from step {step} (resume from disk)"
</step>
<!-- /section -->

<!-- section: chain_steps -->
<step name="chain_steps">
For each step from startStepIdx to end:

1. **Skip if already complete:**
   ```javascript
   if (validation.valid_artifacts.some(a => a.step === step)) {
     console.log(`Skipping ${step} (already complete)`);
     continue;
   }
   ```

2. **Build phase snapshot for this step:**
   ```javascript
   const { buildPhaseSnapshotInternal } = require('../src/lib/helpers');
   const snapshot = buildPhaseSnapshotInternal(cwd, phase);
   // Snapshot provides compact phase context for the fresh process
   ```

3. **Spawn step in fresh process:**
   ```javascript
   const { spawnSync } = require('child_process');
   const result = spawnSync('node', [
     'bin/bgsd-tools.cjs', `${step}-phase`, phase
   ], { cwd, stdio: 'inherit' });
   ```

4. **Handle checkpoint (interactive decision):**
   ```javascript
   if (result.status === 'checkpoint') {
     // Write checkpoint state to handoff for resume
     spawnSync('node', [
       'bin/bgsd-tools.cjs', 'verify:state', 'handoff', 'write',
       '--phase', phase, '--step', step,
       '--summary', `Checkpoint at ${step}`,
       '--next-command', `${STEPS[i+1]}-phase ${phase}`,
     ], { cwd });
     console.log(`Checkpoint reached at ${step}. Run /bgsd-deliver-phase ${phase} to resume.`);
     return;
   }
   ```

5. **Handle step failure:**
   ```javascript
   if (result.status !== 0) {
     console.error(`Step ${step} failed with exit ${result.status}`);
     return;
   }
   ```

6. **Write step handoff:**
   ```javascript
   spawnSync('node', [
     'bin/bgsd-tools.cjs', 'verify:state', 'handoff', 'write',
     '--phase', phase, '--step', step,
     '--summary', `Step ${step} complete`,
     '--next-command', STEPS[i+1] ? `${STEPS[i+1]}-phase ${phase}` : null,
   ], { cwd });
   ```
</step>
<!-- /section -->

<!-- section: complete -->
<step name="complete">
Report: "Phase {phase} delivery complete"

All handoff artifacts written. Next phase can begin with fresh handoff set.
</step>
<!-- /section -->

</process>

<success_criteria>
- deliver:phase --fresh-step-context {phase} runs full chain
- JJ proof gate enforced on every run
- Checkpoint state survives /clear mid-chain
- Handoff artifacts written at each step boundary
- Resume works from disk truth after /clear
</success_criteria>
