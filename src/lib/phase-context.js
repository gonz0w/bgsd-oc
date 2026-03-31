const fs = require('fs');
const path = require('path');
const { buildPhaseSnapshotInternal, normalizePhaseName } = require('./helpers');

function extractTaggedSection(content, tag) {
  const match = String(content || '').match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

function extractHeadingSection(content, headingPattern) {
  const lines = String(content || '').split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingPattern.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;

  const collected = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,6}\s+/.test(line) && collected.length > 0) break;
    collected.push(line);
  }
  const text = collected.join('\n').trim();
  return text || null;
}

function firstParagraph(text) {
  if (!text) return null;
  const paragraphs = String(text)
    .split(/\n\s*\n/)
    .map(chunk => chunk.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return paragraphs[0] || null;
}

function firstNarrativeParagraph(text) {
  if (!text) return null;
  const narrative = String(text)
    .split('\n')
    .filter(line => !/^\s*[-*]\s+/.test(line))
    .join('\n')
    .trim();
  return firstParagraph(narrative);
}

function extractBullets(text) {
  if (!text) return [];
  return String(text)
    .split('\n')
    .map(line => line.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim() || null)
    .filter(Boolean);
}

function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractIntentField(section, label, knownLabels) {
  if (!section) return null;
  const labelPattern = knownLabels.map(escapeRegex).join('|');
  const fieldPattern = new RegExp(
    `(?:^|\\n)\\s*[-*]?\\s*\\*\\*${escapeRegex(label)}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*[-*]?\\s*\\*\\*(?:${labelPattern}):\\*\\*|\\n\\s*##\\s+|$)`,
    'i'
  );
  const match = String(section).match(fieldPattern);
  return match ? match[1].trim() : null;
}

function parsePhaseIntentFromContext(content) {
  const contract = parsePhaseIntentContractFromContext(content);
  return contract.intent;
}

function parsePhaseIntentContractFromContext(content) {
  const phaseIntentSection = extractTaggedSection(content, 'phase_intent')
    || extractHeadingSection(content, /^##\s*Phase Intent\s*$/i);
  if (!phaseIntentSection) {
    return {
      status: 'missing_explicit_phase_intent',
      intent: null,
      reason: 'is missing an explicit `Phase Intent` block, so phase-local intent is unavailable.',
    };
  }

  const labels = ['Local Purpose', 'Expected User Change', 'Non-Goals'];
  const localPurposeSection = extractIntentField(phaseIntentSection, 'Local Purpose', labels);
  const expectedChangeSection = extractIntentField(phaseIntentSection, 'Expected User Change', labels);
  const nonGoalsSection = extractIntentField(phaseIntentSection, 'Non-Goals', labels);

  const phaseIntent = {
    purpose: firstNarrativeParagraph(localPurposeSection),
    expected_change: firstNarrativeParagraph(expectedChangeSection),
    non_goals: extractBullets(nonGoalsSection),
  };

  if (phaseIntent.non_goals.length === 0) {
    const nonGoalParagraph = firstParagraph(nonGoalsSection);
    if (nonGoalParagraph) phaseIntent.non_goals = [nonGoalParagraph];
  }

  if (!phaseIntent.purpose && !phaseIntent.expected_change && phaseIntent.non_goals.length === 0) {
    return {
      status: 'empty_explicit_phase_intent',
      intent: null,
      reason: 'has an explicit `Phase Intent` block, but it does not define usable local intent fields.',
    };
  }

  return {
    status: 'explicit_phase_intent',
    intent: phaseIntent,
    reason: null,
  };
}

function readPhaseIntent(cwd, phase) {
  const contract = readPhaseIntentContract(cwd, phase);
  return contract?.intent || null;
}

function readPhaseIntentContract(cwd, phase) {
  if (!cwd || !phase) return null;
  const snapshot = buildPhaseSnapshotInternal(cwd, phase);
  const contextPath = snapshot?.artifacts?.context;
  if (!contextPath) {
    return {
      phase: normalizePhaseName(snapshot?.phase || phase),
      source_path: null,
      status: 'missing_phase_context_artifact',
      intent: null,
      reason: 'context artifact is unavailable, so phase-local intent is unavailable.',
    };
  }

  const fullPath = path.join(cwd, contextPath);
  if (!fs.existsSync(fullPath)) {
    return {
      phase: normalizePhaseName(snapshot?.phase || phase),
      source_path: contextPath,
      status: 'missing_phase_context_file',
      intent: null,
      reason: 'context artifact is unavailable, so phase-local intent is unavailable.',
    };
  }

  const contract = parsePhaseIntentContractFromContext(fs.readFileSync(fullPath, 'utf-8'));

  return {
    phase: normalizePhaseName(snapshot.phase || phase),
    source_path: contextPath,
    ...contract,
    intent: contract.intent
      ? {
        phase: normalizePhaseName(snapshot.phase || phase),
        source_path: contextPath,
        ...contract.intent,
      }
      : null,
  };
}

function formatPhaseIntentAvailabilityWarning(phase, contract) {
  const normalizedPhase = normalizePhaseName(phase);
  const reason = contract?.reason || 'phase-local intent is unavailable.';
  return `Partial intent context: phase ${normalizedPhase} ${reason}`;
}

module.exports = {
  formatPhaseIntentAvailabilityWarning,
  parsePhaseIntentContractFromContext,
  parsePhaseIntentFromContext,
  readPhaseIntentContract,
  readPhaseIntent,
};
