'use strict';

const { spawnSync } = require('child_process');
const { buildPhaseSnapshotInternal } = require('../lib/helpers');
const { listPhaseHandoffArtifacts, buildPhaseHandoffValidation } = require('../lib/phase-handoff');
const { collectWorkspaceProof } = require('../lib/jj-workspace');

/**
 * Deliver a phase using fresh-context chaining workflow.
 * Chains discuss → research → plan → execute → verify, each step running
 * in a fresh CLI process with disk-based handoff. Session can be cleared
 * mid-chain and resume works from disk truth.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {string} phaseArg - Phase number/name to deliver
 * @param {object} options - Options: { fresh_step_context: boolean, fast: boolean }
 * @param {boolean} raw - Raw output mode flag
 */
function cmdDeliverPhase(cwd, phaseArg, options = {}, raw = false) {
  // STEPS constant from phase-handoff.js PHASE_HANDOFF_STEPS
  const STEPS = ['discuss', 'research', 'plan', 'execute', 'verify'];

  // Validate phase argument
  const phase = phaseArg || 'next';
  if (!phase) {
    console.error('Phase argument required. Usage: bgsd-tools deliver:phase <phase> [--fresh-step-context] [--fast]');
    return;
  }

  // JJ Proof Gate (mandatory, never bypassed)
  const proof = collectWorkspaceProof(cwd, null);
  if (!proof.parallel_allowed) {
    console.log('⚠ Proof gate failed, cannot proceed');
    console.log('Intended root:', proof.intended_root);
    console.log('Observed cwd:', proof.observed_cwd);
    return;
  }

  // Determine starting step from handoff artifacts (resume support)
  const entries = listPhaseHandoffArtifacts(cwd, phase);
  const validation = buildPhaseHandoffValidation(entries, { phase });
  const startStepIdx = validation.latest_valid_artifact
    ? STEPS.indexOf(validation.latest_valid_artifact.step) + 1
    : 0;

  // Fresh-context CLI chaining loop
  for (let i = startStepIdx; i < STEPS.length; i++) {
    const step = STEPS[i];

    // Skip if already complete (has valid artifact)
    if (validation.valid_artifacts.some(a => a.step === step)) {
      console.log(`Skipping ${step} (already complete)`);
      continue;
    }

    // Build phase snapshot for this step (provides compact phase context)
    const snapshot = buildPhaseSnapshotInternal(cwd, phase);
    if (!snapshot.found) {
      console.error(`Phase ${phase} not found. Check .planning/phases/ for valid phases.`);
      return;
    }

    // Run step in fresh process via spawnSync
    console.log(`Running ${step}...`);
    const result = spawnSync('node', [
      'bin/bgsd-tools.cjs', `${step}-phase`, phase
    ], { cwd, stdio: 'inherit' });

    // Handle checkpoint (interactive decision) - result.status is 'checkpoint' string
    if (result.status === 'checkpoint') {
      // Write checkpoint state to handoff for resume
      const nextCommand = STEPS[i + 1] ? `${STEPS[i + 1]}-phase ${phase}` : null;
      spawnSync('node', [
        'bin/bgsd-tools.cjs', 'verify:state', 'handoff', 'write',
        '--phase', phase,
        '--step', step,
        '--summary', `Checkpoint at ${step}`,
        '--next-command', nextCommand || '',
      ], { cwd });
      console.log(`Checkpoint reached at ${step}. Resume with /bgsd-deliver-phase ${phase}`);
      return;
    }

    // Non-zero exit without checkpoint marker = failure
    if (result.status !== 0 && result.status !== null) {
      console.error(`Step ${step} failed with exit ${result.status}`);
      return;
    }

    // Write step result to handoff artifact
    const nextCommand = STEPS[i + 1] ? `${STEPS[i + 1]}-phase ${phase}` : null;
    spawnSync('node', [
      'bin/bgsd-tools.cjs', 'verify:state', 'handoff', 'write',
      '--phase', phase,
      '--step', step,
      '--summary', `Step ${step} complete`,
      '--next-command', nextCommand || '',
    ], { cwd });
  }

  console.log(`Phase ${phase} delivery complete.`);
}

module.exports = { cmdDeliverPhase };
