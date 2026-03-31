'use strict';

const fs = require('fs');
const path = require('path');

const RELEASE_STATE_FILE = path.join('.planning', 'release-state.json');

function getReleaseStatePath(cwd) {
  return path.join(cwd, RELEASE_STATE_FILE);
}

function readReleaseState(cwd) {
  const filePath = getReleaseStatePath(cwd);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function computeLastSafeStep(completedSteps) {
  if (!Array.isArray(completedSteps) || completedSteps.length === 0) return null;
  return completedSteps[completedSteps.length - 1];
}

function writeReleaseState(cwd, state) {
  const filePath = getReleaseStatePath(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const normalized = {
    state_file: RELEASE_STATE_FILE,
    updated_at: new Date().toISOString(),
    completed_steps: [],
    cleanup: {
      attempted: [],
      performed: [],
    },
    ...state,
  };
  normalized.last_safe_completed_step = computeLastSafeStep(normalized.completed_steps);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2) + '\n', 'utf-8');
  return normalized;
}

function clearReleaseState(cwd) {
  const filePath = getReleaseStatePath(cwd);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

module.exports = {
  RELEASE_STATE_FILE,
  clearReleaseState,
  getReleaseStatePath,
  readReleaseState,
  writeReleaseState,
};
