<!-- section: purpose -->
<purpose>
Execute all plans in a phase using wave-based parallel execution. Orchestrator stays lean — delegates plan execution to subagents.
</purpose>

<core_principle>
Orchestrator coordinates, not executes. Each subagent loads full execute-plan context with fresh 200k window. Discover → deps → waves → spawn → checkpoints → results.
</core_principle>

<required_reading>
Read STATE.md before starting.
</required_reading>
<!-- /section -->

<process>

<!-- section: initialize -->
<step name="initialize" priority="first">
<skill:bgsd-context-init />

Parse `<bgsd-context>` JSON for: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `parallelization`, `branching_strategy`, `branch_name`, `executor_model`, `verifier_model`, `verification_route` (from `decisions.verification-routing.value`), `verification_required_proof`, `verification_default_reason`, `verification_downgrade`, `commit_docs`, `pre_flight_validation`, `workspace_enabled`, `workspace_config`, `workspace_active`, `file_overlaps`, `handoff_tool_context`, `capability_level` (from `handoff_tool_context.capability_level`, may be `UNKNOWN`), `resume_summary`.

**`phase_number` is the authoritative phase — it comes from the user's argument as resolved by the bGSD plugin. Never infer or auto-select a different phase.**

**Phase number is required.** If `phase_number` is null or `phase_found` is false:
```
ERROR: Phase number required.
Usage: /bgsd-execute-phase <phase-number> [flags]
Example: /bgsd-execute-phase 92
Use /bgsd-inspect progress to see available phases.
```
Exit.

Extract flags from `$ARGUMENTS`:
```bash
PHASE_NUMBER="${phase_number}"  # from <bgsd-context> — user-provided arg
GAPS_ONLY="false"
[[ "$ARGUMENTS" == *"--gaps-only"* ]] && GAPS_ONLY="true"
CI_FLAG=""
[[ "$ARGUMENTS" == *"--ci"* && "$ARGUMENTS" != *"--no-ci"* ]] && CI_FLAG="force"
[[ "$ARGUMENTS" == *"--no-ci"* ]] && CI_FLAG="skip"
```

`plan_count` 0 → error: no plans found for phase. No STATE.md but `.planning/` exists → offer reconstruct. `parallelization` false → sequential.
</step>
<!-- /section -->

<!-- section: handoff_gating -->
<step name="gate_chain_continuation">
```
Task(
  prompt="Determine execution continuation action. resume_summary: {resume_summary}, latest_valid_step: {latest_valid_step}, resume_valid: {resume_valid}, stale_sources: {stale_sources}",
  subagent_type="bgsd-context-bootstrapper",
  model="gpt-5.4-nano",
  description="Validate handoff continuation"
)
```
</step>
<!-- /section -->

<!-- section: handle_branching -->
<step name="handle_branching">
**Pre-computed decision:** Use `decisions.branch-handling` value (skip/create/update/use-existing) if present.

**Fallback:** If `branching_strategy` is `"none"`: skip. Otherwise:
```bash
jj bookmark create "$BRANCH_NAME" -r @ 2>/dev/null || jj bookmark set "$BRANCH_NAME" -r @
```
</step>
<!-- /section -->

<!-- section: validate_phase -->
<step name="validate_phase">
Report: "Found {plan_count} plans in {phase_dir} ({incomplete_count} incomplete)"
</step>
<!-- /section -->

<!-- section: preflight -->
<step name="preflight_dependency_check">
```bash
DEPS=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:validate-dependencies "${PHASE_NUMBER}" 2>/dev/null)
```
Issues → yolo: log, proceed. Interactive: present, ask proceed/stop.
</step>

<step name="preflight_state_validation">
Skip if `pre_flight_validation` false or `--skip-validate`. Run `verify:state validate --fix` then `verify:state validate`. Display fixed count, status table on warnings/errors. Errors → yolo: continue with banner. Interactive: ask fix or `--skip-validate`.
</step>

<step name="preflight_workspace_check">
Skip if `workspace_enabled` false. If overlaps within wave → display table (yolo: advisory, proceed; interactive: ask). Display workspace config summary. If `workspace_active` non-empty: display, consider cleanup.
</step>

<step name="preflight_convention_check">
Advisory only. Collect `files_modified` from all incomplete plans. Run `codebase context`. Flag naming convention mismatches (confidence >80%): `⚠ Convention advisory: {file_path} — project uses {pattern}`. Forward to executor prompts.
</step>
<!-- /section -->

<!-- section: discover_plans -->
<step name="discover_and_group_plans">
```bash
PLAN_INDEX=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:phase-plan-index "${PHASE_NUMBER}")
```

Parse: `plans[]`, `waves`, `incomplete`, `has_checkpoints`. Skip plans with `has_summary: true`. If `GAPS_ONLY=true`: also skip non-gap_closure plans.

Report execution plan table: Wave | Plans | What it builds.
</step>
<!-- /section -->

<!-- section: visualize_execution -->
<step name="visualize_execution_plan">
Display ASCII wave/dependency diagram:
```
📊 Execution Plan:

Wave {N} {parallel|sequential}:
  ┌─ {plan_id}-PLAN.md ({objective, 5-8 words})
  └─ {plan_id}-PLAN.md ({objective, 5-8 words})

Dependencies:
  {plan_id} depends on: {depends_on list}
```
Use `┌─`/`├─`/`└─` for parallel, `──` for single-plan waves. Skip completed plans.
</step>
<!-- /section -->

<!-- section: parallel_proof_gate -->
<step name="parallel_proof_gate">
**PARALLEL-03: JJ Workspace Proof Gate (optimized, never bypassed)**

Add constants and helper function at the top of the process section, after the parallelization section header:

```javascript
const PROOF_CACHE_TTL_MS = 30_000; // Proof valid within single wave dispatch
// Kahn waves from enrichment.decisions['phase-dependencies'].value.waves
// Maps phase-number (String) → wave-number
const kahnWaves = enrichment?.decisions?.['phase-dependencies']?.value?.waves || {};
const { collectWorkspaceProof } = require('../src/lib/jj-workspace');
let _cachedProof = null;
let _cachedProofTime = 0;

function getWorkspaceProof(cwd, workspaceName) {
  const now = Date.now();
  if (_cachedProof && (now - _cachedProofTime) < PROOF_CACHE_TTL_MS) {
    return _cachedProof;
  }
  // Fresh proof check — uses collectWorkspaceProof from jj-workspace.js
  _cachedProof = collectWorkspaceProof(cwd, workspaceName);
  _cachedProofTime = now;
  return _cachedProof;
}
```

This helper caches the workspace proof for 30 seconds within a wave dispatch. The proof check itself is never removed or short-circuited — only the cache TTL is optimized for performance within a single wave.

<!-- section: parallel_fan_in -->
async function fanInParallelSpawns(plans, cwd, options = {}) {
  const { timeout_ms = 300_000, onProgress } = options;
  const { spawn } = require('child_process');
  const { PlanningCache } = require('../src/lib/planning-cache');

  // Kahn waves from enrichment.decisions['phase-dependencies'].value.waves
  // Maps phase-number (String) → wave-number
  // Uses Kahn-derived wave when available, falls back to frontmatter.wave for backward compatibility
  const kahnWaves = enrichment?.decisions?.['phase-dependencies']?.value?.waves || {};

  // Shared cache for parallel spawn coordination (mutex-protected)
  const cache = new PlanningCache({});

  const spawns = plans.map(plan => {
    return new Promise(async resolve => {
      // Kahn wave assignment: derive phase number from plan, look up wave
      const planPhase = plan.phase || String(plan.plan_id?.match(/^(\d+)/)?.[1] || 1);
      const planWave = kahnWaves[planPhase] ?? parseInt(plan.wave, 10) ?? 1;

      // Mutex-protected cache read for shared state before spawning
      const { value: cachedResult } = await cache.getMutexValue(`spawn_${plan.plan_id}`);

      const child = spawn(
        process.execPath,
        ['bin/bgsd-tools.cjs', 'execute:plan', plan.plan_id, '--no-interactive'],
        { cwd, stdio: ['pipe', 'pipe', 'pipe'] }
      );

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeout_ms);

      child.stdout.on('data', d => { stdout += d; });
      child.stderr.on('data', d => { stderr += d; });

      child.on('close', code => {
        clearTimeout(timeout);
        // Mutex-protected cache invalidation after spawn completes
        cache.invalidateMutex(`spawn_${plan.plan_id}`);
        resolve({ plan_id: plan.plan_id, code: timedOut ? -1 : code, stdout, stderr, timedOut, wave: planWave });
      });
      child.on('error', err => {
        clearTimeout(timeout);
        cache.invalidateMutex(`spawn_${plan.plan_id}`);
        resolve({ plan_id: plan.plan_id, code: -1, stdout: '', stderr: String(err), timedOut: false, wave: planWave });
      });
    });
  });

  // Fan-in: wait for all simultaneously
  const results = await Promise.all(spawns);

  if (onProgress) {
    for (const r of results) onProgress(r);
  }

  return results;
}
```

This function coordinates independent workflow stages using Promise.all fan-in. Each plan gets its own child_process.spawn. Results are collected per-plan with structured {plan_id, code, stdout, stderr, timed_out} return values. Any single failure does NOT crash the entire wave — all results are collected and returned.

// Phase 210: Bounded parallel TDD fan-out using workerLimit
// TDD keys: tdd_audit, tdd_proof, tdd_summary (per plan, via getTddMutexKeys)
// Uses TDD mutex protection for cache key coordination across parallel workers
async function fanInTddParallel(planBatches, cwd, workerLimit) {
  const { PlanningCache } = require('../src/lib/planning-cache');
  const cache = new PlanningCache({});
  const results = [];

  for (const batch of planBatches) {
    const batchPromises = batch.slice(0, workerLimit).map(async (plan) => {
      const planPath = plan.path || plan.plan_id;
      const keys = cache.getTddMutexKeys(planPath);

      // Mutex-protected TDD cache read (non-blocking, slot-based)
      const { value: cachedAudit } = await cache.getMutexValue(keys.audit);
      const { value: cachedProof } = await cache.getMutexValue(keys.proof);
      const { value: cachedSummary } = await cache.getMutexValue(keys.summary);

      // Run TDD verification (placeholder — actual TDD logic in execute-plan subagents)
      let tddResult;
      try {
        tddResult = await runTddVerify(plan, cwd);
      } catch (err) {
        tddResult = { plan_id: plan.plan_id, error: String(err), verified: false };
      }

      // Mutex-protected TDD cache write (blocking CAS)
      cache.invalidateMutex(keys.audit);
      cache.invalidateMutex(keys.proof);
      cache.invalidateMutex(keys.summary);

      return tddResult;
    });
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  return results;
}

async function runTddVerify(plan, cwd) {
  const { spawn } = require('child_process');
  
  // Non-type:tdd plans delegate verification to execute-plan subagents
  if (plan.type !== 'tdd') {
    return { plan_id: plan.plan_id, verified: true };
  }
  
  // Read plan file to extract TDD targets from <feature><tdd-targets>
  const path = plan.path || plan.plan_id;
  const planContent = require('fs').readFileSync(path, 'utf8');
  
  // Extract red, green, refactor commands using whitespace-insensitive regex
  const redMatch = planContent.match(/<red>([\s\S]*?)<\/red>/i);
  const greenMatch = planContent.match(/<green>([\s\S]*?)<\/green>/i);
  const refactorMatch = planContent.match(/<refactor>([\s\S]*?)<\/refactor>/i);
  
  const redCmd = redMatch ? redMatch[1].trim() : null;
  const greenCmd = greenMatch ? greenMatch[1].trim() : null;
  const refactorCmd = refactorMatch ? refactorMatch[1].trim() : null;
  
  // Extract test_file for validate-green/validate-refactor
  const testFileMatch = planContent.match(/test_file:\s*([^\s\n]+)/i);
  const testFile = testFileMatch ? testFileMatch[1] : null;
  
  // Extract prev-count for validate-refactor (test count from GREEN phase)
  const prevCountMatch = planContent.match(/prev-count:\s*(\d+)/i);
  const prevCount = prevCountMatch ? parseInt(prevCountMatch[1], 10) : null;
  
  // Helper to spawn CLI validator
  const spawnValidator = (stage, args) => {
    return new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        ['bin/bgsd-tools.cjs', 'execute:tdd', stage, ...args],
        { cwd, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', d => { stdout += d; });
      child.stderr.on('data', d => { stderr += d; });
      
      child.on('close', (code) => {
        let result;
        try {
          result = JSON.parse(stdout);
        } catch {
          result = { stage, exitCode: code, error: stderr || 'parse error' };
        }
        resolve(result);
      });
      child.on('error', (err) => {
        resolve({ stage, exitCode: -1, error: String(err) });
      });
    });
  };
  
  // Run RED stage
  const redResult = redCmd 
    ? await spawnValidator('validate-red', ['--test-cmd', redCmd])
    : { stage: 'red', verified: false, error: 'No red command found' };
  
  // Run GREEN stage (only if RED passed semantically)
  const greenResult = (redResult.failed || redResult.semanticFailure) && greenCmd
    ? await spawnValidator('validate-green', ['--test-cmd', greenCmd, '--test-file', testFile || ''])
    : { stage: 'green', verified: false, skipped: true };
  
  // Run REFACTOR stage (only if GREEN passed)
  const refactorResult = (greenResult.passed && greenResult.testFileUnmodified) && refactorCmd
    ? await spawnValidator('validate-refactor', ['--test-cmd', refactorCmd, '--prev-count', String(prevCount || greenResult.testCount || 0)])
    : { stage: 'refactor', verified: false, skipped: true };
  
  // Aggregate results: verified if all stages passed
  const verified = redResult.failed === true && 
                   greenResult.passed === true && 
                   greenResult.testFileUnmodified === true &&
                   refactorResult.passed === true &&
                   refactorResult.countUnchanged === true;
  
  return {
    plan_id: plan.plan_id,
    verified,
    stages: { red: redResult, green: greenResult, refactor: refactorResult }
  };
}
<!-- /section -->
</step>
<!-- /section -->

<!-- section: execute_waves -->
<step name="execute_waves">
// Phase 210: TDD cache warming — serial invalidation before parallel fan-out
// Runs once per phase to ensure fresh state before concurrent TDD verification
function warmTddCacheForPhase(cwd, phasePlans) {
  const { PlanningCache } = require('../src/lib/planning-cache');
  const cache = new PlanningCache({});
  const os = require('os');

  for (const plan of phasePlans) {
    const keys = cache.getTddMutexKeys(plan.path || plan.plan_id);
    cache.invalidateMutex(keys.audit);
    cache.invalidateMutex(keys.proof);
    cache.invalidateMutex(keys.summary);
  }

  // Return bounded worker count for TDD operations
  const configuredN = parseInt(process.env.TDD_WORKERS || '4', 10);
  return Math.min(configuredN, os.cpus().length);
}

// Call warmTddCacheForPhase once per phase before parallel fan-out
// Stores the returned worker bound for use in TDD parallel fan-out
let TDD_WORKER_BOUND = warmTddCacheForPhase(cwd, PLANS_FOR_PHASE);

Execute each wave in sequence. Within a wave: parallel if `PARALLELIZATION=true`.

**Per wave:**
1. Preview + verify handoff contracts: `verify:handoff --preview` and `verify:agents --verify`
2. Describe what's being built (2-3 sentences from each plan's `<objective>`)
3. Choose execution mode:

**Mode A: Workspace-based parallel** (`workspace_enabled` + parallel + multi-plan wave)

  a. `workspace add {plan_id}` for each runnable plan in the wave so every plan gets its own managed JJ workspace. If workspace creation fails or workspace mode is unavailable, fall back to Mode B sequential execution before any plan work begins.
  b. Run `workspace prove {plan_id}` immediately after workspace creation and before executor plan work starts. Treat this as the proof gate, not an advisory check.
  c. **PARALLEL-03 Proof Gate Check (after workspace prove, before parallel dispatch):**
     ```javascript
     const proof = getWorkspaceProof(cwd, workspaceName);
     if (!proof.parallel_allowed) {
       // FALLBACK TO SEQUENTIAL — proof gate preserved, never bypassed
       console.log('⚠ Proof gate: parallel_allowed=false, falling back to sequential for this wave');
       // Execute Mode B sequential for this wave instead
       return executeWaveSequential(wavePlans);
     }
     // Accelerated parallel path continues — proof was checked
     console.log('✓ Proof gate passed, proceeding with parallel dispatch');
     ```

  d. **PARALLEL-04 Promise.all Fan-In Dispatch:**
     ```javascript
     // Spawn all plans in parallel using Promise.all fan-in
     const waveResults = await fanInParallelSpawns(wavePlans, cwd, {
       timeout_ms: 300_000,
       onProgress: (result) => {
         console.log(`[${result.plan_id}] exit:${result.code} timed_out:${result.timedOut}`);
       }
     });

     // Check for failures — report but don't block healthy siblings
     const failures = waveResults.filter(r => r.code !== 0);
     if (failures.length > 0) {
       console.log(`⚠ ${failures.length} plans failed in wave`);
       for (const f of failures) {
         console.log(`  ${f.plan_id}: code=${f.code} timed_out=${f.timedOut}`);
         if (f.stderr) console.log(`  stderr: ${f.stderr.slice(0, 200)}`);
       }
     }
     ```

  e. Only if proof succeeds may the workflow continue with workspace-parallel execution. Operator-facing proof/fallback guidance must name the intended workspace, observed executor cwd, observed `jj workspace root`, and one generic fallback reason.
  f. If proof fails or workspace mode is unavailable, downgrade to Mode B sequential execution before any plan work, summary creation, plan-local outputs, or other repo-relative work begin.
  g. Inject codebase context (same as Mode B).
  h. Spawn in workspace dirs: `Task(subagent_type="bgsd-executor", model="{executor_model}", workdir="{workspace_path}", prompt="<objective>Execute plan {plan_number} of phase {phase_number}-{phase_name}. Running in JJ workspace at {workspace_path}.</objective> Tool capability: {capability_level} — agent receives full tool decisions via bgsd-context injection. ...same execution_context, files_to_read, codebase_context, success_criteria as Mode B...")`
  i. Monitor each workspace independently: check `{workspace_path}/.planning/phases/{phase_dir}/{plan_id}-SUMMARY.md`, track commit/summary status per workspace, and keep the plan → workspace mapping visible in wave reporting.
  j. Wait. Separate healthy finalized siblings, healthy-but-blocked `staged_ready` siblings, and failed or recovery-needed workspaces explicitly. Report partial-wave outcomes honestly instead of collapsing the whole wave into one success/failure bit, and show the canonical recovery summary first whenever a blocker exists.
  k. Sequential reconcile (smallest plan/workspace name first): run `workspace reconcile {plan_id}` for every completed workspace. The returned status/recovery preview stays diagnostic only: reconcile healthy workspaces immediately in preview form, but workspace reconcile remains preview-only and must surface a normalized `result_manifest` with summary/proof paths, inspection guidance, shared-planning violation classification, and canonical recovery-summary references. Keep summary-first inspection by default, require direct proof review for major completion claims or risky runtime/shared-state work, and make the canonical recovery summary name the exact gating sibling plus next command before operators inspect deeper proof artifacts. Leave stale/divergent/failed workspaces retained for inspection and recovery follow-up without blocking healthy siblings.
  k.1. For a healthy reconcile-ready workspace with complete proof and no ambiguity, auto-call `execute:finalize-plan {plan_id}` from trusted main-checkout state by default instead of adding a routine manual approval stop.
  k.2. If a wave still has a blocker after healthy siblings reconcile, keep the canonical recovery summary as the default inspection surface and rerun recovery or `execute:finalize-wave {phase_number} --wave {wave}` from trusted main-checkout state once the gating sibling is resolved instead of teaching workspace-local retries.
  k.3. Reserve human review for explicit exception cases only: ambiguity, intent conflict, missing proof, or quarantined/policy-violating boundary behavior. Those cases must stop before shared planning writes and remain inspectable for follow-up.
  l. Cleanup: keep failed or divergent workspaces during recovery work, and only let `workspace cleanup` remove obsolete failed workspaces after successful phase completion confirms they are no longer needed.

**Mode B: Standard execution** (workspace disabled OR single-plan OR no parallelization)

  Before each executor, inject codebase context if available:
  ```bash
  PLAN_FILES=$(node bgsd-tools.cjs util:frontmatter "${PLAN_PATH}" --field files_modified 2>/dev/null)
  [ -n "$PLAN_FILES" ] && CODEBASE_CTX=$(node bgsd-tools.cjs util:codebase context --files ${PLAN_FILES} --plan ${PLAN_PATH} 2>/dev/null)
  ```

  Spawn:
  ```
  Task(
    subagent_type="bgsd-executor", model="{executor_model}",
    prompt="
      <objective>
      Execute plan {plan_number} of phase {phase_number}-{phase_name}.
      Commit each task atomically. Create SUMMARY.md. In workspace mode, keep shared planning updates behind finalize instead of mutating STATE.md or ROADMAP.md directly.
      </objective>

      <execution_context>
      @__OPENCODE_CONFIG__/bgsd-oc/workflows/execute-plan.md
      @__OPENCODE_CONFIG__/bgsd-oc/templates/summary.md
      Load checkpoints.md sections 'types' and 'guidelines' via extract-sections if plan has autonomous: false.
      Load tdd.md only if plan type is 'tdd'.
      </execution_context>

      Verification route: {verification_route}. Apply it as: `skip` = structural proof only, `light` = named focused proof plus smoke regression, `full` = named focused proof plus one broad regression gate at plan end or overall verification.

      Use the normalized proof bundle as the source of truth: behavior proof, regression proof, and human verification buckets must report `required` versus `not required` honestly instead of inferring proof scope from plan size.

      If focused verification needs test execution, prefer explicit `node --test <file>...` file lists or direct smoke scripts over `npm test --test-name-pattern`. If a broad gate is already red from unrelated legacy failures, record that baseline separately from the touched-slice proof.

      If a broad node:test file hangs after the targeted regressions already passed, record the attempted gate once, stop retrying the same hanging file, and fall back to rebuilt-runtime plus focused touched-surface checks that directly prove the plan truths.

      For command-surface or docs-heavy work, preserve exact canonical route callouts unless the regression contract is intentionally updated, and validate command-integrity proof against the actual touched surfaced files rather than curated snippets alone. Keep slice regressions scoped to the files and command surfaces the plan owns.

      When changed deliverables include generated runtime artifacts (for example `plugin.js` or `bin/bgsd-tools.cjs`), verify against the repo-local current checkout plus the rebuilt local runtime in this repo. Never trust stale generated artifacts: run `npm run build`, then rerun the focused proof against the rebuilt local runtime before reporting success.

      If the declared proof lives in a shared docs or oversized test file, pair any broad file-level gate with one isolated focused smoke command so the touched slice still has attributable evidence when the broad file has unrelated failures or hangs.

      If the phase exposes an explicit phase-intent block, require verification to report a separate Intent Alignment verdict before or alongside Requirement Coverage using the locked ladder `aligned | partial | misaligned`. If the core expected user change did not land, the verdict cannot be `partial`. If the phase lacks the explicit phase-intent block, require `not assessed` / unavailable wording with a plain reason instead of a guessed verdict.

      Tool capability: {capability_level} — agent receives full tool decisions via bgsd-context injection.

      <files_to_read>
      - {phase_dir}/{plan_file} (Plan)
      - .planning/STATE.md (State)
      - .planning/config.json (Config, if exists)
      - ./AGENTS.md (Project instructions, if exists)
      </files_to_read>

      <codebase_context>
      {CODEBASE_CTX}
      </codebase_context>
      <!-- Include <codebase_context> ONLY if CODEBASE_CTX is non-empty. Omit entirely if unavailable. -->

      <success_criteria>
      - [ ] All tasks executed
      - [ ] Each task committed individually
      - [ ] SUMMARY.md created in plan directory
      - [ ] STATE.md updated with position and decisions
      - [ ] ROADMAP.md updated with plan progress
      </success_criteria>
    "
  )
  ```

4. **Spot-check:** Verify first 2 files from `key-files.created`. Because `execute:commit` returns git commit hashes, check commits with `jj log --no-graph -T 'commit_id.shortest(8) ++ " " ++ description.first_line() ++ "\n"' | grep "{phase}-{plan}"` ≥1 commit. Check for `## Self-Check: FAILED`. Fail → report, ask "Retry?" or "Continue?".

5. **Failures:** `classifyHandoffIfNeeded` error → spot-check; if pass → treat as success. Real failures → report → ask continue/stop.

6. Execute checkpoint plans between waves — see `checkpoint_handling`.

7. Proceed to next wave.
</step>
<!-- /section -->

<!-- section: checkpoint_handling -->
<step name="checkpoint_handling">
Plans with `autonomous: false` require user interaction.

**Auto-mode** (`config-get workflow.auto_advance`):
- human-verify → auto-approve, log `⚡ Auto-approved checkpoint`
- decision → auto-select first option, log `⚡ Auto-selected: [option]`
- human-action → present to user (can't automate auth gates)

**Standard flow:**
1. Spawn agent → runs until checkpoint → returns structured state
2. Present to user → user responds using questionTemplate() options:
   - human-verify: `questionTemplate('execute-checkpoint-verify', 'SINGLE_CHOICE')` → Pass / Fail / Needs adjustment
   - spot-check failures: `questionTemplate('execute-checkpoint-retry', 'SINGLE_CHOICE')` → Retry / Continue / Skip
   - wave completion: `questionTemplate('execute-wave-continue', 'SINGLE_CHOICE')` → Proceed to next wave / Review current / Pause
3. Spawn continuation agent (NOT resume) with completed_tasks_table, resume_task, user_response
4. Continuation verifies previous commits, continues from resume point
5. Repeat until complete

Parallel checkpoints: agent pauses while others may complete. Present checkpoint, spawn continuation, wait for all before next wave.
</step>
<!-- /section -->

<!-- section: aggregate_results -->
<step name="aggregate_results">
After all waves, report:
- Waves/Plans complete count
- Wave status table
- Plan one-liners from SUMMARYs
- Aggregated issues (or "None")

Before verification or any fresh-context continuation, write or refresh the durable `execute` handoff artifact:

```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:state handoff write \
  --phase "${PHASE_NUMBER}" \
  --step execute \
  --summary "Execution complete for Phase ${PHASE_NUMBER}" \
  --next-command "/bgsd-verify-work ${PHASE_NUMBER}"
```

If the phase already produced canonical `*-TDD-AUDIT.json` proof sidecars, the shared handoff runtime preserves deterministic proof metadata in `context` automatically so resume inspection, the execute → verify boundary, and downstream summary rendering do not silently drop TDD evidence.
</step>
<!-- /section -->

<!-- section: bundle_smoke_test -->
<step name="bundle_smoke_test">
Run npm run build smoke test to verify bundle parity:
```bash
BUILD_OUTPUT=$(npm run build 2>&1)
BUILD_EXIT=$?
if [ $BUILD_EXIT -ne 0 ]; then
  echo "BUNDLE PARITY FAILURE: $BUILD_OUTPUT"
  exit 1
fi
echo "Bundle smoke test: PASS"
```
If build fails: exit 1, do not proceed to verify_phase_goal.
</step>
<!-- /section -->

<!-- section: close_artifacts -->
<step name="close_parent_artifacts">
**Decimal/polish phases only (X.Y pattern).** Skip for whole-number phases.

1. Derive parent: `PARENT_PHASE="${PHASE_NUMBER%%.*}"`
2. Find parent UAT file via `find-phase`
3. Update gap statuses: `failed` → `resolved`
4. If all resolved: update UAT frontmatter status + timestamp
5. Move debug sessions to `.planning/debug/resolved/`
6. Commit updated artifacts
</step>
<!-- /section -->

<!-- section: ci_quality_gate if="ci_enabled" -->
<step name="ci_quality_gate">
<skill:ci-quality-gate scope="phase-${PHASE_NUMBER}" base_branch="${BASE_BRANCH:-main}" />
</step>
<!-- /section -->

<!-- section: cli_contract_validation -->
<step name="cli_contract_validation">
Run `util:validate-commands --raw` to confirm CLI contract after routing changes:
```bash
VALIDATE_OUTPUT=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs util:validate-commands --raw 2>&1)
VALIDATE_EXIT=$?
if [ $VALIDATE_EXIT -ne 0 ]; then
  echo "CLI CONTRACT DRIFT: $VALIDATE_OUTPUT"
  exit 1
fi
echo "CLI contract validation: PASS"
```
If validation fails: exit 1, do not proceed to verify_phase_goal.
</step>
<!-- /section -->

<!-- section: verify_phase_goal -->
<step name="verify_phase_goal">
```
Task(
  prompt="Verify phase {phase_number} goal achievement.
Phase directory: {phase_dir}
Phase goal: {goal from ROADMAP.md}
Phase requirement IDs: {phase_req_ids}
Check must_haves against actual codebase.
Assess intent alignment as a separate judgment from requirement coverage using the active phase intent when available.
Use the locked verdict ladder `aligned | partial | misaligned`; if the core expected user change missed, force `misaligned`.
If no explicit phase-intent block exists, report intent alignment as `not assessed` / unavailable with a plain reason instead of guessing.
Surface Intent Alignment before or alongside Requirement Coverage in VERIFICATION.md.
Cross-reference requirement IDs from PLAN frontmatter against REQUIREMENTS.md.
Create VERIFICATION.md.",
  subagent_type="bgsd-verifier",
  model="{verifier_model}"
)
```

Read status from VERIFICATION.md:
- `passed` → update_roadmap
- `human_needed` → present items for human testing
- `gaps_found` → present gap summary, offer `/bgsd-plan gaps {X}`
</step>
<!-- /section -->

<!-- section: update_roadmap -->
<step name="update_roadmap">
```bash
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs verify:validate roadmap --repair 2>/dev/null
COMPLETION=$(node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs plan:phase complete "${PHASE_NUMBER}")
node __OPENCODE_CONFIG__/bgsd-oc/bin/bgsd-tools.cjs execute:commit "docs(phase-{X}): complete phase execution" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md
```
</step>
<!-- /section -->

<!-- section: offer_next -->
<step name="offer_next">
If `gaps_found`: skip (verify_phase_goal already presented gap-closure path).

If verification passed: read and follow `transition.md` inline as part of `/bgsd-execute-phase`.

Do not surface a separate transition command. Keep the user in the same execute-phase flow unless transition itself hits a destructive confirmation or milestone-routing decision that still needs user input.

`transition.md` still includes the advisory lessons review block before the next-phase handoff, and its own auto-advance behavior still controls whether the next phase planning step chains forward automatically.
</step>
<!-- /section -->

</process>

<!-- section: resumption -->
<resumption>
Re-run `/bgsd-execute-phase {phase}` → discovers completed SUMMARYs → skips them → resumes from first incomplete plan.
</resumption>
<!-- /section -->

<!-- section: success_criteria -->
<success_criteria>
- All plans executed, all verifications pass
- Wave status and one-liners reported
- VERIFICATION.md created
- STATE.md and ROADMAP.md updated
</success_criteria>
<!-- /section -->
