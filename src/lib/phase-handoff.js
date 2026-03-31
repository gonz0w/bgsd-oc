'use strict';

const fs = require('fs');
const path = require('path');

const {
  buildDefaultPhaseHandoffSummary,
  buildPhaseHandoffExpectedFingerprint,
  buildPhaseHandoffRunId,
  buildPhaseHandoffSourceFingerprint,
  findPhaseInternal,
  normalizePhaseName,
} = require('./helpers');
const { withProjectLock } = require('./project-lock');
const { writeFileAtomic } = require('./atomic-write');

const PHASE_HANDOFF_VERSION = 1;
const PHASE_HANDOFF_KIND = 'phase-handoff';
const PHASE_HANDOFF_DIR = path.join('.planning', 'phase-handoffs');
const PHASE_HANDOFF_STEPS = ['discuss', 'research', 'plan', 'execute', 'verify'];
const PHASE_HANDOFF_STATUSES = ['pending', 'complete', 'blocked'];
const STEP_ORDER = new Map(PHASE_HANDOFF_STEPS.map((step, index) => [step, index]));

function normalizePhaseHandoffPhase(phase) {
  return normalizePhaseName(String(phase || '')).trim();
}

function isValidHandoffStep(step) {
  return STEP_ORDER.has(String(step || '').trim());
}

function getPhaseHandoffDir(cwd, phase) {
  return path.join(cwd, PHASE_HANDOFF_DIR, normalizePhaseHandoffPhase(phase));
}

function getPhaseHandoffPath(cwd, phase, step) {
  return path.join(getPhaseHandoffDir(cwd, phase), `${String(step || '').trim()}.json`);
}

function readPhaseHandoffFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function normalizeTddAuditStageList(input) {
  const source = input && typeof input === 'object'
    ? (input.phases && typeof input.phases === 'object' ? input.phases : input)
    : {};
  return ['red', 'green', 'refactor'].filter((stage) => source[stage] && typeof source[stage] === 'object');
}

function mergeHandoffContextValue(base, incoming) {
  if (incoming === undefined) return base;
  if (base === undefined) return incoming;

  if (Array.isArray(base) && Array.isArray(incoming)) {
    const combined = [...base, ...incoming];
    const byKey = new Map();
    const fallback = [];
    for (const item of combined) {
      if (item && typeof item === 'object' && typeof item.path === 'string') {
        byKey.set(item.path, item);
      } else {
        const encoded = JSON.stringify(item);
        if (!fallback.includes(encoded)) fallback.push(encoded);
      }
    }
    return [
      ...Array.from(byKey.values()),
      ...fallback.map((item) => JSON.parse(item)),
    ];
  }

  if (
    base && incoming
    && typeof base === 'object' && typeof incoming === 'object'
    && !Array.isArray(base) && !Array.isArray(incoming)
  ) {
    const merged = { ...base };
    for (const [key, value] of Object.entries(incoming)) {
      merged[key] = mergeHandoffContextValue(base[key], value);
    }
    return merged;
  }

  return incoming;
}

function mergeHandoffContexts(...contexts) {
  return contexts.reduce((acc, current) => mergeHandoffContextValue(acc, current || {}), {});
}

function discoverPhaseProofContext(cwd, phase) {
  const phaseInfo = findPhaseInternal(cwd, phase);
  if (!phaseInfo || !phaseInfo.found) return {};

  const phaseDir = path.join(cwd, phaseInfo.directory);
  if (!fs.existsSync(phaseDir)) return {};

  const auditFiles = fs.readdirSync(phaseDir)
    .filter((name) => name.endsWith('-TDD-AUDIT.json'))
    .sort();
  if (auditFiles.length === 0) return {};

  const tdd_audits = auditFiles.map((name) => {
    const relPath = path.join(phaseInfo.directory, name);
    const fullPath = path.join(cwd, relPath);
    const match = name.match(/-(\d+)-TDD-AUDIT\.json$/);
    let stages = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      stages = normalizeTddAuditStageList(parsed);
    } catch {
      stages = [];
    }
    return {
      path: relPath,
      plan: match ? match[1] : null,
      stages,
    };
  });

  return { tdd_audits };
}

function validatePhaseHandoffArtifact(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, errors: ['Artifact must be a JSON object'], artifact: null };
  }

  const artifact = {
    version: Number(input.version || PHASE_HANDOFF_VERSION),
    kind: input.kind || PHASE_HANDOFF_KIND,
    phase: normalizePhaseHandoffPhase(input.phase || ''),
    step: String(input.step || '').trim(),
    status: String(input.status || 'complete').trim(),
    run_id: String(input.run_id || '').trim(),
    source_fingerprint: String(input.source_fingerprint || '').trim(),
    created_at: input.created_at || input.updated_at || new Date().toISOString(),
    updated_at: input.updated_at || new Date().toISOString(),
    summary: input.summary ? String(input.summary) : '',
    resume_target: input.resume_target && typeof input.resume_target === 'object' && !Array.isArray(input.resume_target)
      ? input.resume_target
      : {},
    context: input.context && typeof input.context === 'object' && !Array.isArray(input.context)
      ? input.context
      : {},
  };

  if (artifact.version !== PHASE_HANDOFF_VERSION) errors.push(`Unsupported handoff version: ${artifact.version}`);
  if (artifact.kind !== PHASE_HANDOFF_KIND) errors.push(`Unsupported handoff kind: ${artifact.kind}`);
  if (!artifact.phase) errors.push('phase is required');
  if (!isValidHandoffStep(artifact.step)) errors.push(`step must be one of: ${PHASE_HANDOFF_STEPS.join(', ')}`);
  if (!PHASE_HANDOFF_STATUSES.includes(artifact.status)) errors.push(`status must be one of: ${PHASE_HANDOFF_STATUSES.join(', ')}`);
  if (!artifact.run_id) errors.push('run_id is required');
  if (!artifact.source_fingerprint) errors.push('source_fingerprint is required');
  if (Number.isNaN(Date.parse(artifact.created_at))) errors.push('created_at must be an ISO timestamp');
  if (Number.isNaN(Date.parse(artifact.updated_at))) errors.push('updated_at must be an ISO timestamp');

  return { valid: errors.length === 0, errors, artifact };
}

function listPhaseHandoffArtifacts(cwd, phase) {
  const dir = getPhaseHandoffDir(cwd, phase);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const filePath = path.join(dir, name);
      const parsed = readPhaseHandoffFile(filePath);
      const validation = validatePhaseHandoffArtifact(parsed);
      const stat = fs.statSync(filePath);
      return {
        file: path.join(PHASE_HANDOFF_DIR, normalizePhaseHandoffPhase(phase), name),
        file_path: filePath,
        step: name.replace(/\.json$/, ''),
        mtime_ms: stat.mtimeMs,
        valid: validation.valid,
        errors: validation.errors,
        artifact: validation.artifact,
      };
    })
    .sort((a, b) => {
      const aTime = a.artifact ? Date.parse(a.artifact.updated_at) : a.mtime_ms;
      const bTime = b.artifact ? Date.parse(b.artifact.updated_at) : b.mtime_ms;
      if (aTime !== bTime) return bTime - aTime;
      return (STEP_ORDER.get(b.step) ?? -1) - (STEP_ORDER.get(a.step) ?? -1);
    });
}

function selectLatestValidPhaseHandoff(entries) {
  const validEntries = entries.filter((entry) => entry.valid && entry.artifact);
  if (validEntries.length === 0) {
    return {
      selected_run_id: null,
      latest_valid_step: null,
      latest_valid_artifact: null,
      valid_entries: [],
    };
  }

  const grouped = new Map();
  for (const entry of validEntries) {
    const runId = entry.artifact.run_id;
    if (!grouped.has(runId)) grouped.set(runId, []);
    grouped.get(runId).push(entry);
  }

  let selectedRunId = null;
  let selectedEntries = [];
  let selectedTime = -1;
  let selectedStepRank = -1;

  for (const [runId, runEntries] of grouped.entries()) {
    const newest = runEntries.reduce((best, current) => {
      const bestTime = best ? Date.parse(best.artifact.updated_at) : -1;
      const currentTime = Date.parse(current.artifact.updated_at);
      if (currentTime !== bestTime) return currentTime > bestTime ? current : best;
      return (STEP_ORDER.get(current.artifact.step) ?? -1) > (STEP_ORDER.get(best.artifact.step) ?? -1) ? current : best;
    }, null);
    const newestTime = newest ? Date.parse(newest.artifact.updated_at) : -1;
    const newestStepRank = newest ? (STEP_ORDER.get(newest.artifact.step) ?? -1) : -1;
    if (
      newestTime > selectedTime ||
      (newestTime === selectedTime && newestStepRank > selectedStepRank) ||
      (newestTime === selectedTime && newestStepRank === selectedStepRank && String(runId) > String(selectedRunId || ''))
    ) {
      selectedRunId = runId;
      selectedEntries = runEntries;
      selectedTime = newestTime;
      selectedStepRank = newestStepRank;
    }
  }

  const latestValidArtifact = selectedEntries.reduce((best, current) => {
    if (!best) return current;
    const bestRank = STEP_ORDER.get(best.artifact.step) ?? -1;
    const currentRank = STEP_ORDER.get(current.artifact.step) ?? -1;
    if (currentRank !== bestRank) return currentRank > bestRank ? current : best;
    return Date.parse(current.artifact.updated_at) > Date.parse(best.artifact.updated_at) ? current : best;
  }, null);

  return {
    selected_run_id: selectedRunId,
    latest_valid_step: latestValidArtifact ? latestValidArtifact.artifact.step : null,
    latest_valid_artifact: latestValidArtifact ? latestValidArtifact.artifact : null,
    valid_entries: selectedEntries,
  };
}

function buildPhaseHandoffValidation(entries, options = {}) {
  const selected = selectLatestValidPhaseHandoff(entries);
  const invalidEntries = entries.filter((entry) => !entry.valid);
  const expectedFingerprint = options.expected_fingerprint ? String(options.expected_fingerprint) : null;
  const staleSources = !!(
    expectedFingerprint &&
    selected.latest_valid_artifact &&
    selected.latest_valid_artifact.source_fingerprint !== expectedFingerprint
  );
  const validForResume = !!selected.latest_valid_artifact && !staleSources;

  const repairCommands = [
    `node /Users/cam/.config/opencode/bgsd-oc/bin/bgsd-tools.cjs verify:state handoff clear --phase ${options.phase || (selected.latest_valid_artifact && selected.latest_valid_artifact.phase) || '?'}`,
    'Restart the phase flow from discuss so fresh handoff artifacts can be written.',
  ];

  let repairGuidance = null;
  if (!selected.latest_valid_artifact) {
    repairGuidance = {
      action: invalidEntries.length > 0 ? 'repair' : 'restart',
      message: invalidEntries.length > 0
        ? 'No valid handoff artifacts remain. Repair by clearing the corrupted artifact set, then restart the phase flow.'
        : 'No handoff artifacts exist for this phase. Restart the phase flow to create a fresh artifact set.',
      commands: repairCommands,
    };
  } else if (staleSources) {
    repairGuidance = {
      action: 'repair',
      message: 'The latest valid handoff artifact no longer matches the expected source fingerprint. Rebuild the handoff set before resuming.',
      commands: repairCommands,
    };
  }

  return {
    valid: validForResume,
    selected_run_id: selected.selected_run_id,
    latest_valid_step: selected.latest_valid_step,
    latest_valid_artifact: selected.latest_valid_artifact,
    valid_artifacts: entries.filter((entry) => entry.valid).map((entry) => ({
      file: entry.file,
      step: entry.artifact.step,
      run_id: entry.artifact.run_id,
      updated_at: entry.artifact.updated_at,
      source_fingerprint: entry.artifact.source_fingerprint,
      status: entry.artifact.status,
    })),
    invalid_artifacts: invalidEntries.map((entry) => ({
      file: entry.file,
      step: entry.step,
      errors: entry.errors,
    })),
    stale_sources: staleSources,
    repair_guidance: repairGuidance,
  };
}

function buildPhaseHandoffPayload(cwd, input) {
  const phase = normalizePhaseHandoffPhase(input && input.phase ? input.phase : '');
  const step = String(input && input.step ? input.step : '').trim();
  const status = String(input && input.status ? input.status : 'complete').trim() || 'complete';
  const normalizedSummary = input && input.summary ? String(input.summary).trim() : '';
  const now = input && input.updated_at ? new Date(input.updated_at) : new Date();

  const existingEntries = phase ? listPhaseHandoffArtifacts(cwd, phase) : [];
  const selected = selectLatestValidPhaseHandoff(existingEntries);
  const latestArtifact = selected.latest_valid_artifact || null;
  const existingStepArtifact = selected.valid_entries
    .map((entry) => entry.artifact)
    .find((artifact) => artifact && artifact.step === step) || null;

  const explicitRunId = String(input && input.run_id ? input.run_id : '').trim();
  const explicitFingerprint = String(input && input.source_fingerprint ? input.source_fingerprint : '').trim();
  const startsNewDiscussRun = !explicitRunId && step === 'discuss';
  const runId = explicitRunId
    || (startsNewDiscussRun ? buildPhaseHandoffRunId(phase, now) : (latestArtifact && latestArtifact.run_id) || buildPhaseHandoffRunId(phase, now));
  const expectedFingerprint = phase ? buildPhaseHandoffExpectedFingerprint(cwd, phase) : '';
  const sourceFingerprint = explicitFingerprint
    || expectedFingerprint
    || ((latestArtifact && latestArtifact.run_id === runId) ? latestArtifact.source_fingerprint : buildPhaseHandoffSourceFingerprint(phase, runId));

  const explicitResumeTarget = input && input.resume_target && typeof input.resume_target === 'object' && !Array.isArray(input.resume_target)
    ? input.resume_target
    : {};
  const baseResumeTarget = existingStepArtifact && existingStepArtifact.run_id === runId && existingStepArtifact.resume_target
    ? existingStepArtifact.resume_target
    : {};
  const carriedContext = latestArtifact && latestArtifact.run_id === runId && latestArtifact.context
    ? latestArtifact.context
    : {};
  const existingStepContext = existingStepArtifact && existingStepArtifact.run_id === runId && existingStepArtifact.context
    ? existingStepArtifact.context
    : {};
  const discoveredProofContext = phase ? discoverPhaseProofContext(cwd, phase) : {};
  const explicitContext = input && input.context && typeof input.context === 'object' && !Array.isArray(input.context)
    ? input.context
    : {};

  return {
    version: input && input.version,
    kind: input && input.kind,
    phase,
    step,
    status,
    run_id: runId,
    source_fingerprint: sourceFingerprint,
    created_at: input && input.created_at
      ? input.created_at
      : (existingStepArtifact && existingStepArtifact.run_id === runId ? existingStepArtifact.created_at : undefined),
    updated_at: input && input.updated_at ? input.updated_at : now.toISOString(),
    summary: normalizedSummary || buildDefaultPhaseHandoffSummary(step, status),
    resume_target: {
      ...baseResumeTarget,
      ...explicitResumeTarget,
    },
    context: mergeHandoffContexts(carriedContext, discoveredProofContext, existingStepContext, explicitContext),
  };
}

function writePhaseHandoff(cwd, input) {
  const validation = validatePhaseHandoffArtifact(input);
  if (!validation.valid) {
    return { written: false, errors: validation.errors, artifact: validation.artifact };
  }

  return withProjectLock(cwd, () => {
    const artifact = validation.artifact;
    const dir = getPhaseHandoffDir(cwd, artifact.phase);
    const filePath = getPhaseHandoffPath(cwd, artifact.phase, artifact.step);
    fs.mkdirSync(dir, { recursive: true });

    writeFileAtomic(filePath, JSON.stringify(artifact, null, 2) + '\n');

    const entries = listPhaseHandoffArtifacts(cwd, artifact.phase);
    const replacedRuns = [];
    for (const entry of entries) {
      if (!entry.valid || !entry.artifact) continue;
      if (entry.artifact.run_id !== artifact.run_id) {
        replacedRuns.push(entry.artifact.run_id);
        fs.unlinkSync(entry.file_path);
      }
    }

    const finalEntries = listPhaseHandoffArtifacts(cwd, artifact.phase);
    const result = buildPhaseHandoffValidation(finalEntries, { phase: artifact.phase });
    return {
      written: true,
      path: path.join(PHASE_HANDOFF_DIR, artifact.phase, `${artifact.step}.json`),
      artifact,
      replaced_runs: [...new Set(replacedRuns)],
      latest_valid_step: result.latest_valid_step,
      selected_run_id: result.selected_run_id,
    };
  });
}

function clearPhaseHandoffs(cwd, phase) {
  const dir = getPhaseHandoffDir(cwd, phase);
  if (!fs.existsSync(dir)) return { cleared: true, removed: [] };
  const removed = fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
  fs.rmSync(dir, { recursive: true, force: true });
  return { cleared: true, removed: removed.map((name) => path.join(PHASE_HANDOFF_DIR, normalizePhaseHandoffPhase(phase), name)) };
}

module.exports = {
  PHASE_HANDOFF_DIR,
  PHASE_HANDOFF_KIND,
  PHASE_HANDOFF_STATUSES,
  PHASE_HANDOFF_STEPS,
  PHASE_HANDOFF_VERSION,
  buildPhaseHandoffValidation,
  clearPhaseHandoffs,
  getPhaseHandoffDir,
  getPhaseHandoffPath,
  isValidHandoffStep,
  listPhaseHandoffArtifacts,
  normalizePhaseHandoffPhase,
  readPhaseHandoffFile,
  selectLatestValidPhaseHandoff,
  validatePhaseHandoffArtifact,
  buildPhaseHandoffPayload,
  writePhaseHandoff,
};
